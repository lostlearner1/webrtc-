import type { BufferType, FileMeta, FileStatus } from "../../types/client";
import { FILE_STATUS } from "../../types/client";
import type { WebRTCApi } from "../../types/webrtc";

// 12B = 96bit => [A-Z] * 12
export const ID_SIZE = 12;
// 4B = 32bit = 2^32 = 4294967296
export const CHUNK_SIZE = 4;
export const STEAM_TYPE = "application/octet-stream";

export const FILE_HANDLE: Map<string, Blob> = new Map();
export const FILE_MAPPER: Map<string, BufferType[]> = new Map();
export const FILE_STATE: Map<
  string,
  FileMeta & {
    series: number;
    status?: FileStatus;
    sha256?: string;
    verified?: boolean;
    speed?: number;
    eta?: number;
  }
> = new Map();

// High Watermark & Low Watermark for DataChannel Backpressure Flow Control
export const HIGH_WATERMARK = 1024 * 1024 * 2; // 2MB
export const LOW_WATERMARK = 1024 * 512; // 512KB

export const getMaxMessageSize = (
  rtc: React.MutableRefObject<WebRTCApi | null>,
  targetId?: string,
  origin = false
) => {
  const instance = targetId
    ? rtc.current?.getInstance(targetId)
    : Array.from(rtc.current?.getInstances()?.values() || [])[0];
  let maxSize = instance?.connection.sctp?.maxMessageSize || 64 * 1024;
  // Cap at 256KB to comply with WebRTC SCTP safe payload boundaries
  maxSize = Math.min(maxSize, 256 * 1024);
  if (origin) {
    return maxSize;
  }
  return maxSize - (ID_SIZE + CHUNK_SIZE);
};

/**
 * Computes SHA-256 hash of a Blob / File using Web Crypto API.
 */
export const calculateFileHash = async (file: Blob): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (err) {
    console.error("SHA-256 Calculation Error", err);
    return "";
  }
};

/**
 * Serializes a file chunk with 12-byte File ID and 4-byte Series Sequence Index.
 */
export const serializeChunk = (
  file: Blob,
  id: string,
  series: number,
  chunkSize: number
): Blob => {
  const start = series * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const idBytes = new Uint8Array(id.split("").map(char => char.charCodeAt(0)));
  const serialBytes = new Uint8Array(4);
  serialBytes[0] = (series >> 24) & 0xff;
  serialBytes[1] = (series >> 16) & 0xff;
  serialBytes[2] = (series >> 8) & 0xff;
  serialBytes[3] = series & 0xff;
  return new Blob([idBytes, serialBytes, file.slice(start, end)]);
};

/**
 * Deserializes an incoming binary chunk to extract File ID, Series Index, and raw Data.
 */
export const deserializeChunk = async (chunk: BufferType) => {
  const buffer = chunk instanceof Blob ? await chunk.arrayBuffer() : chunk;
  const id = new Uint8Array(buffer.slice(0, ID_SIZE));
  const series = new Uint8Array(buffer.slice(ID_SIZE, ID_SIZE + CHUNK_SIZE));
  const data = buffer.slice(ID_SIZE + CHUNK_SIZE);
  const idString = String.fromCharCode(...id);
  const seriesNumber = (series[0] << 24) | (series[1] << 16) | (series[2] << 8) | series[3];
  return { id: idString, series: seriesNumber, data };
};

export interface StreamProgressUpdate {
  id: string;
  progress: number;
  series: number;
  total: number;
  speed: number; // bytes per sec
  eta: number; // seconds remaining
  status: FileStatus;
}

/**
 * Active Streaming Sender Session: Manages pipelined backpressure transmission with pause/resume support.
 */
export class StreamSenderSession {
  public id: string;
  public file: Blob;
  public targetId?: string;
  public chunkSize: number;
  public total: number;
  public currentSeries = 0;
  public isPaused = false;
  public isCancelled = false;
  public isStreaming = false;

  private startTime = 0;
  private lastSampleTime = 0;
  private lastSampleBytes = 0;
  private bytesSent = 0;
  private onProgressCb?: (update: StreamProgressUpdate) => void;
  private onFinishCb?: (id: string) => void;

  constructor(
    id: string,
    file: Blob,
    chunkSize: number,
    targetId?: string,
    onProgress?: (update: StreamProgressUpdate) => void,
    onFinish?: (id: string) => void
  ) {
    this.id = id;
    this.file = file;
    this.chunkSize = chunkSize;
    this.targetId = targetId;
    this.total = Math.ceil(file.size / chunkSize);
    this.onProgressCb = onProgress;
    this.onFinishCb = onFinish;
  }

  public pause() {
    this.isPaused = true;
    this.emitProgress(FILE_STATUS.PAUSED, 0, 0);
  }

  public resume(startSeries?: number) {
    if (typeof startSeries === "number" && startSeries >= 0) {
      this.currentSeries = startSeries;
      this.bytesSent = Math.min(startSeries * this.chunkSize, this.file.size);
    }
    this.isPaused = false;
  }

  public cancel() {
    this.isCancelled = true;
    this.isPaused = true;
    this.emitProgress(FILE_STATUS.ERROR, 0, 0);
  }

  public async startStreaming(rtc: React.MutableRefObject<WebRTCApi | null>) {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.lastSampleTime = Date.now();
    this.lastSampleBytes = this.bytesSent;

    while (this.currentSeries < this.total && !this.isCancelled) {
      if (this.isPaused) {
        // Wait until unpaused
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      if (!rtc.current) {
        break;
      }

      // Check DataChannel backpressure
      const instance = this.targetId
        ? rtc.current.getInstance(this.targetId)
        : Array.from(rtc.current.getInstances()?.values() || [])[0];

      const channel = instance?.channel;
      if (channel) {
        if (channel.readyState !== "open") {
          // Channel not ready, wait briefly
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }

        if (channel.bufferedAmount >= HIGH_WATERMARK) {
          channel.bufferedAmountLowThreshold = LOW_WATERMARK;
          await new Promise<void>(resolve => {
            const onLow = () => {
              channel.removeEventListener("bufferedamountlow", onLow);
              resolve();
            };
            channel.addEventListener("bufferedamountlow", onLow);
            // Fallback timeout in case event is missed
            setTimeout(onLow, 200);
          });
        }
      }

      // Slice & Serialize Chunk
      const chunkBlob = serializeChunk(this.file, this.id, this.currentSeries, this.chunkSize);
      const chunkBuffer = await chunkBlob.arrayBuffer();

      if (this.targetId) {
        rtc.current.send(chunkBuffer, this.targetId);
      } else {
        rtc.current.send(chunkBuffer);
      }

      this.currentSeries++;
      const chunkActualSize = Math.min(
        this.chunkSize,
        this.file.size - (this.currentSeries - 1) * this.chunkSize
      );
      this.bytesSent += chunkActualSize;

      // Telemetry Speed & ETA calculation (sampled every 300ms)
      const now = Date.now();
      const elapsed = now - this.lastSampleTime;
      if (elapsed >= 300 || this.currentSeries >= this.total) {
        const deltaBytes = this.bytesSent - this.lastSampleBytes;
        const currentSpeed = (deltaBytes / (elapsed / 1000)) || 0; // Bytes/sec
        const remainingBytes = Math.max(0, this.file.size - this.bytesSent);
        const eta = currentSpeed > 0 ? Math.ceil(remainingBytes / currentSpeed) : 0;

        this.lastSampleTime = now;
        this.lastSampleBytes = this.bytesSent;
        this.emitProgress(
          this.currentSeries >= this.total ? FILE_STATUS.COMPLETED : FILE_STATUS.TRANSFERRING,
          currentSpeed,
          eta
        );
      }

      // Yield event loop slightly to keep UI smooth and allow message parsing
      if (this.currentSeries % 8 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    this.isStreaming = false;
    if (this.currentSeries >= this.total && !this.isCancelled) {
      this.emitProgress(FILE_STATUS.COMPLETED, 0, 0);
      this.onFinishCb?.(this.id);
    }
  }

  private emitProgress(status: FileStatus, speed: number, eta: number) {
    const progress = Math.min(100, Math.floor((this.currentSeries / this.total) * 100));
    this.onProgressCb?.({
      id: this.id,
      progress,
      series: this.currentSeries,
      total: this.total,
      speed,
      eta,
      status,
    });
  }
}

export const ACTIVE_SENDER_SESSIONS: Map<string, StreamSenderSession> = new Map();

/**
 * Receiver file tracker for calculating speed and managing reassembly.
 */
export interface ReceiverTracker {
  id: string;
  name: string;
  size: number;
  total: number;
  receivedCount: number;
  bytesReceived: number;
  lastSampleTime: number;
  lastSampleBytes: number;
  currentSpeed: number;
  eta: number;
  sha256Expected?: string;
  status: FileStatus;
}

export const ACTIVE_RECEIVER_TRACKERS: Map<string, ReceiverTracker> = new Map();

/**
 * Helper to get or initialize receiver tracker
 */
export const getReceiverTracker = (
  id: string,
  name: string,
  size: number,
  total: number,
  sha256Expected?: string
): ReceiverTracker => {
  let tracker = ACTIVE_RECEIVER_TRACKERS.get(id);
  if (!tracker) {
    tracker = {
      id,
      name,
      size,
      total,
      receivedCount: 0,
      bytesReceived: 0,
      lastSampleTime: Date.now(),
      lastSampleBytes: 0,
      currentSpeed: 0,
      eta: 0,
      sha256Expected,
      status: FILE_STATUS.TRANSFERRING,
    };
    ACTIVE_RECEIVER_TRACKERS.set(id, tracker);
  }
  return tracker;
};

// Legacy compatibility helper
export const serializeNextChunk = (
  instance: React.MutableRefObject<WebRTCApi | null>,
  id: string,
  series: number,
  targetId?: string
) => {
  const file = FILE_HANDLE.get(id);
  const chunkSize = getMaxMessageSize(instance, targetId);
  if (!file) return new Blob([new ArrayBuffer(chunkSize)]);
  return serializeChunk(file, id, series, chunkSize);
};

export const sendChunkMessage = async (
  rtc: React.MutableRefObject<WebRTCApi | null>,
  chunk: BufferType,
  targetId?: string
) => {
  const buffer = chunk instanceof Blob ? await chunk.arrayBuffer() : chunk;
  if (rtc.current && buffer) {
    if (targetId) {
      rtc.current.send(buffer, targetId);
    } else {
      rtc.current.send(buffer);
    }
  }
};
