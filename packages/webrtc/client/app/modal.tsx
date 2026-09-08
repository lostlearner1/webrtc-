import type { WebRTCApi } from "../../types/webrtc";
import styles from "../styles/modal.module.scss";
import type { FC } from "react";
import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { BufferType, ConnectionState, FileStatus, MessageType, TransferType } from "../../types/client";
import {
  CONNECTION_STATE,
  FILE_STATUS,
  MESSAGE_TYPE,
  TRANSFER_FROM,
  TRANSFER_TYPE,
} from "../../types/client";
import { Button, Input, Modal, Progress, Tooltip, Message as ArcoMessage } from "@arco-design/web-react";
import {
  IconCheckCircleFill,
  IconCopy,
  IconDownload,
  IconFile,
  IconFolder,
  IconPause,
  IconPlayArrow,
  IconRight,
  IconSend,
  IconToBottom,
} from "@arco-design/web-react/icon";
import type { WebRTC } from "../bridge/webrtc";
import { useMemoFn } from "laser-utils";
import { cs, getUniqueId, isString } from "laser-utils";
import { TSON } from "../utils/tson";
import { formatBytes, formatEta, formatSpeed, scrollToBottom } from "../utils/format";
import {
  ACTIVE_RECEIVER_TRACKERS,
  ACTIVE_SENDER_SESSIONS,
  FILE_HANDLE,
  FILE_MAPPER,
  FILE_STATE,
  ID_SIZE,
  STEAM_TYPE,
  StreamSenderSession,
  calculateFileHash,
  deserializeChunk,
  getMaxMessageSize,
  getReceiverTracker,
} from "../utils/binary";
import { WorkerEvent } from "../worker/event";

export const TransferModal: FC<{
  stream?: boolean;
  connection: React.MutableRefObject<WebRTC | null>;
  rtc: React.MutableRefObject<WebRTCApi | null>;
  id: string;
  setId: (id: string) => void;
  peerIds: string[];
  setPeerIds: (ids: string[]) => void;
  state: ConnectionState;
  setState: (state: ConnectionState) => void;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}> = props => {
  const {
    stream = false,
    connection,
    rtc,
    state,
    peerIds,
    visible,
    setVisible,
    setPeerIds,
    setState,
  } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [toConnectId, setToConnectId] = useState("");
  const [list, setList] = useState<TransferType[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const onCancel = () => {
    rtc.current?.close();
    setState(CONNECTION_STATE.READY);
    setVisible(false);
  };

  const sendTextMessage = (message: MessageType, targetId?: string) => {
    rtc.current?.send(TSON.encode(message), targetId);
  };

  const updateFileItem = (
    id: string,
    updates: Partial<{
      progress: number;
      status: FileStatus;
      speed: number;
      eta: number;
      sha256: string;
      verified: boolean;
    }>
  ) => {
    setList(prev =>
      prev.map(item => {
        if (item.key === TRANSFER_TYPE.FILE && item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      })
    );
  };

  const onPauseTransfer = (id: string, targetId?: string) => {
    const session = ACTIVE_SENDER_SESSIONS.get(id);
    if (session) {
      session.pause();
      sendTextMessage({ key: MESSAGE_TYPE.FILE_PAUSE, id }, targetId || session.targetId);
      updateFileItem(id, { status: FILE_STATUS.PAUSED, speed: 0, eta: 0 });
    } else {
      // Receiver initiated pause
      sendTextMessage({ key: MESSAGE_TYPE.FILE_PAUSE, id }, targetId);
      updateFileItem(id, { status: FILE_STATUS.PAUSED, speed: 0, eta: 0 });
    }
  };

  const onResumeTransfer = (id: string, targetId?: string) => {
    const session = ACTIVE_SENDER_SESSIONS.get(id);
    if (session) {
      session.resume();
      sendTextMessage(
        { key: MESSAGE_TYPE.FILE_RESUME, id, series: session.currentSeries },
        targetId || session.targetId
      );
      updateFileItem(id, { status: FILE_STATUS.TRANSFERRING });
      session.startStreaming(rtc);
    } else {
      // Receiver requested resume
      const tracker = ACTIVE_RECEIVER_TRACKERS.get(id);
      const mapper = FILE_MAPPER.get(id) || [];
      const currentCount = mapper.filter(Boolean).length;
      sendTextMessage({ key: MESSAGE_TYPE.FILE_RESUME, id, series: currentCount }, targetId);
      updateFileItem(id, { status: FILE_STATUS.TRANSFERRING });
    }
  };

  const copyHash = (hash: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      ArcoMessage.success("SHA-256 hash copied to clipboard");
    }
  };

  const onMessage = useMemoFn(async (event: MessageEvent<string | BufferType>, targetId: string) => {
    if (isString(event.data)) {
      // String - Signaling / Control messages
      const data = TSON.decode(event.data);
      if (!data) return void 0;

      if (data.key === MESSAGE_TYPE.TEXT) {
        setList(prev => [...prev, { from: TRANSFER_FROM.PEER, targetId, ...data }]);
        scrollToBottom(listRef);
      } else if (data.key === MESSAGE_TYPE.FILE_START) {
        // Sender initiated a file transfer
        const { id, name, size, total, sha256 } = data;
        FILE_STATE.set(id, { series: 0, id, size, total, sha256, status: FILE_STATUS.TRANSFERRING });
        FILE_MAPPER.set(id, []);
        getReceiverTracker(id, name, size, total, sha256);

        setList(prev => [
          ...prev,
          {
            key: TRANSFER_TYPE.FILE,
            from: TRANSFER_FROM.PEER,
            targetId,
            name,
            size,
            progress: 0,
            id,
            status: FILE_STATUS.TRANSFERRING,
            sha256,
            verified: false,
          },
        ]);

        // Signal sender that receiver is ready to ingest the high-speed stream
        sendTextMessage({ key: MESSAGE_TYPE.FILE_READY, id, startSeries: 0 }, targetId);
        stream && WorkerEvent.start(id, name, size, total);
        scrollToBottom(listRef);
      } else if (data.key === MESSAGE_TYPE.FILE_READY) {
        // Receiver is ready to ingest stream
        const { id, startSeries = 0 } = data;
        const session = ACTIVE_SENDER_SESSIONS.get(id);
        if (session) {
          session.resume(startSeries);
          session.startStreaming(rtc);
        }
      } else if (data.key === MESSAGE_TYPE.FILE_PAUSE) {
        const { id } = data;
        const session = ACTIVE_SENDER_SESSIONS.get(id);
        if (session) {
          session.pause();
        }
        updateFileItem(id, { status: FILE_STATUS.PAUSED, speed: 0, eta: 0 });
      } else if (data.key === MESSAGE_TYPE.FILE_RESUME) {
        const { id, series } = data;
        const session = ACTIVE_SENDER_SESSIONS.get(id);
        if (session) {
          session.resume(series);
          session.startStreaming(rtc);
        }
        updateFileItem(id, { status: FILE_STATUS.TRANSFERRING });
      } else if (data.key === MESSAGE_TYPE.FILE_NEXT) {
        // Backward-compatibility: single chunk request
        const { id, series } = data;
        const session = ACTIVE_SENDER_SESSIONS.get(id);
        if (session && !session.isStreaming) {
          session.resume(series);
          session.startStreaming(rtc);
        }
      } else if (data.key === MESSAGE_TYPE.FILE_FINISH) {
        // Sender finished sending all chunks
        const { id, sha256 } = data;
        const fileState = FILE_STATE.get(id);
        if (fileState) {
          fileState.sha256 = sha256 || fileState.sha256;
        }
      } else if (data.key === MESSAGE_TYPE.FILE_VERIFIED) {
        // Receiver notified sender of cryptographic verification match
        const { id, verified, sha256 } = data;
        updateFileItem(id, {
          status: FILE_STATUS.COMPLETED,
          progress: 100,
          verified,
          sha256,
          speed: 0,
          eta: 0,
        });
      }
      return void 0;
    }

    if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
      // Binary - High-speed chunk arrival
      const blob = event.data;
      const { id, series, data } = await deserializeChunk(blob);
      const fileState = FILE_STATE.get(id);
      const tracker = ACTIVE_RECEIVER_TRACKERS.get(id);
      if (!fileState) return void 0;

      const { size, total } = fileState;

      if (stream) {
        await WorkerEvent.post(id, data);
      } else {
        const mapper = FILE_MAPPER.get(id) || [];
        mapper[series] = data;
        FILE_MAPPER.set(id, mapper);
      }

      if (tracker) {
        tracker.receivedCount++;
        tracker.bytesReceived += data.byteLength;

        // Sample speed every 300ms
        const now = Date.now();
        const elapsed = now - tracker.lastSampleTime;
        if (elapsed >= 300 || tracker.receivedCount >= total) {
          const deltaBytes = tracker.bytesReceived - tracker.lastSampleBytes;
          const currentSpeed = deltaBytes / (elapsed / 1000) || 0;
          const remainingBytes = Math.max(0, size - tracker.bytesReceived);
          const eta = currentSpeed > 0 ? Math.ceil(remainingBytes / currentSpeed) : 0;

          tracker.lastSampleTime = now;
          tracker.lastSampleBytes = tracker.bytesReceived;
          tracker.currentSpeed = currentSpeed;
          tracker.eta = eta;

          const progress = Math.min(100, Math.floor((tracker.receivedCount / total) * 100));
          updateFileItem(id, {
            progress,
            speed: currentSpeed,
            eta,
            status: tracker.receivedCount >= total ? FILE_STATUS.VERIFYING : FILE_STATUS.TRANSFERRING,
          });
        }
      }

      // Check if all chunks received
      const mapper = FILE_MAPPER.get(id) || [];
      const isComplete = stream ? series + 1 >= total : mapper.filter(Boolean).length >= total;

      if (isComplete) {
        updateFileItem(id, {
          progress: 100,
          status: FILE_STATUS.VERIFYING,
          speed: 0,
          eta: 0,
        });

        if (stream) {
          WorkerEvent.close(id);
        }

        // Asynchronously compute and verify cryptographic SHA-256 hash
        setTimeout(async () => {
          try {
            const assembledBlob = new Blob(mapper, { type: STEAM_TYPE });
            const computedHash = await calculateFileHash(assembledBlob);
            const expectedHash = fileState.sha256 || tracker?.sha256Expected;
            const isVerified = Boolean(!expectedHash || computedHash === expectedHash);

            updateFileItem(id, {
              status: FILE_STATUS.COMPLETED,
              progress: 100,
              verified: isVerified,
              sha256: computedHash,
              speed: 0,
              eta: 0,
            });

            // Inform sender that the file was verified
            sendTextMessage(
              {
                key: MESSAGE_TYPE.FILE_VERIFIED,
                id,
                verified: isVerified,
                sha256: computedHash,
              },
              targetId
            );
          } catch (err) {
            console.error("Verification error", err);
            updateFileItem(id, { status: FILE_STATUS.COMPLETED, progress: 100 });
          }
        }, 50);
      }
      return void 0;
    }
  });

  const onConnectionStateChange = useMemoFn((pc: RTCPeerConnection) => {
    switch (pc.connectionState) {
      case "new":
      case "connecting":
        setState(CONNECTION_STATE.CONNECTING);
        break;
      case "connected":
        setState(CONNECTION_STATE.CONNECTED);
        break;
      case "disconnected":
      case "closed":
      case "failed":
        setState(CONNECTION_STATE.READY);
        break;
    }
  });

  useEffect(() => {
    const current = connection.current;
    if (current) {
      current.onMessage = onMessage;
      current.onConnectionStateChange = onConnectionStateChange;
    }
    return () => {
      const noop = () => null;
      if (current) {
        current.onMessage = noop;
        current.onConnectionStateChange = noop;
      }
    };
  }, [connection, onConnectionStateChange, onMessage]);

  const onSendText = () => {
    if (rtc.current && text) {
      sendTextMessage({ key: MESSAGE_TYPE.TEXT, data: text }); // Broadcast
      setList(prev => [...prev, { key: TRANSFER_TYPE.TEXT, from: TRANSFER_FROM.SELF, data: text }]);
      setText("");
      scrollToBottom(listRef);
    }
  };

  const sendFilesBySlice = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    const maxChunkSize = getMaxMessageSize(rtc);
    const newItems: TransferType[] = [];

    for (const file of fileArray) {
      const name = file.name;
      const id = getUniqueId(ID_SIZE);
      const size = file.size;
      const total = Math.ceil(file.size / maxChunkSize);

      FILE_HANDLE.set(id, file);

      // Create streaming sender session with backpressure and progress tracking
      const session = new StreamSenderSession(
        id,
        file,
        maxChunkSize,
        peerIds[0], // Target peer
        update => {
          updateFileItem(update.id, {
            progress: update.progress,
            status: update.status,
            speed: update.speed,
            eta: update.eta,
          });
        },
        async finishedId => {
          const hash = await calculateFileHash(file);
          sendTextMessage({ key: MESSAGE_TYPE.FILE_FINISH, id: finishedId, sha256: hash });
          updateFileItem(finishedId, {
            progress: 100,
            status: FILE_STATUS.COMPLETED,
            sha256: hash,
            speed: 0,
            eta: 0,
          });
        }
      );

      ACTIVE_SENDER_SESSIONS.set(id, session);

      // Compute SHA-256 hash asynchronously
      calculateFileHash(file).then(sha256 => {
        sendTextMessage({
          key: MESSAGE_TYPE.FILE_START,
          id,
          name,
          size,
          total,
          sha256,
          chunkSize: maxChunkSize,
        });
        updateFileItem(id, { sha256 });
      });

      newItems.push({
        key: TRANSFER_TYPE.FILE,
        from: TRANSFER_FROM.SELF,
        name,
        size,
        progress: 0,
        id,
        status: FILE_STATUS.TRANSFERRING,
      } as const);

      // Trigger pipelined backpressure streaming
      setTimeout(() => {
        session.startStreaming(rtc);
      }, 50);
    }

    setList(prev => [...prev, ...newItems]);
    scrollToBottom(listRef);

    if (fileArray.length > 1) {
      ArcoMessage.info(`Sending ${fileArray.length} files...`);
    }
  };

  const onSendFile = () => {
    const KEY = "webrtc-file-input";
    const exist = document.querySelector(`body > [data-type='${KEY}']`) as HTMLInputElement;
    const input: HTMLInputElement = exist || document.createElement("input");
    input.value = "";
    input.setAttribute("data-type", KEY);
    input.setAttribute("type", "file");
    input.setAttribute("class", styles.fileInput);
    input.setAttribute("accept", "*");
    input.setAttribute("multiple", "true");
    !exist && document.body.append(input);
    input.onchange = e => {
      const target = e.target as HTMLInputElement;
      document.body.removeChild(input);
      const files = target.files;
      files && sendFilesBySlice(files);
    };
    input.click();
  };

  const onSendFolder = () => {
    const KEY = "webrtc-folder-input";
    const exist = document.querySelector(`body > [data-type='${KEY}']`) as HTMLInputElement;
    const input: HTMLInputElement = exist || document.createElement("input");
    input.value = "";
    input.setAttribute("data-type", KEY);
    input.setAttribute("type", "file");
    input.setAttribute("class", styles.fileInput);
    input.setAttribute("webkitdirectory", "true");
    input.setAttribute("multiple", "true");
    !exist && document.body.append(input);
    input.onchange = e => {
      const target = e.target as HTMLInputElement;
      document.body.removeChild(input);
      const files = target.files;
      files && sendFilesBySlice(files);
    };
    input.click();
  };

  const onDownloadFile = (id: string, fileName: string) => {
    const mapper = FILE_MAPPER.get(id);
    const blob =
      mapper && mapper.length
        ? new Blob(mapper, { type: STEAM_TYPE })
        : FILE_HANDLE.get(id) || new Blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const completedReceivedFiles = useMemo(() => {
    return list.filter(
      item =>
        item.key === TRANSFER_TYPE.FILE &&
        item.from === TRANSFER_FROM.PEER &&
        item.progress === 100
    );
  }, [list]);

  const onDownloadAll = () => {
    if (!completedReceivedFiles.length) return;
    completedReceivedFiles.forEach((item, index) => {
      if (item.key === TRANSFER_TYPE.FILE) {
        setTimeout(() => {
          onDownloadFile(item.id, item.name);
        }, index * 250);
      }
    });
    ArcoMessage.success(`Downloading ${completedReceivedFiles.length} files`);
  };

  const onConnectPeer = () => {
    if (toConnectId && rtc.current && !peerIds.includes(toConnectId)) {
      rtc.current.connect(toConnectId);
      setPeerIds([...peerIds, toConnectId]);
      setState(CONNECTION_STATE.CONNECTING);
    }
  };

  const onDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    files && sendFilesBySlice(files);
  };

  const enableTransfer = state === CONNECTION_STATE.CONNECTED;

  const totalFiles = list.filter(item => item.key === TRANSFER_TYPE.FILE).length;
  const inProgressFiles = list.filter(
    item => item.key === TRANSFER_TYPE.FILE && item.progress < 100
  ).length;

  return (
    <Modal
      className={styles.modal}
      title={
        <div className={styles.title}>
          <div className={styles.titleLeft}>
            <div
              className={styles.dot}
              style={{
                backgroundColor:
                  state === CONNECTION_STATE.READY
                    ? "rgb(var(--red-6))"
                    : state === CONNECTION_STATE.CONNECTING
                    ? "rgb(var(--orange-6))"
                    : state === CONNECTION_STATE.CONNECTED
                    ? "rgb(var(--green-6))"
                    : "rgb(var(--gray-6))",
              }}
            ></div>
            {peerIds.length > 0
              ? state === CONNECTION_STATE.READY
                ? "Disconnected"
                : state === CONNECTION_STATE.CONNECTING
                ? "Connecting..."
                : state === CONNECTION_STATE.CONNECTED
                ? `Group Chat: ${peerIds.join(", ")}`
                : "Unknown State"
              : "Please Establish Connection"}
          </div>
          {completedReceivedFiles.length > 1 && (
            <div className={styles.batchActions}>
              <Button
                size="mini"
                type="outline"
                icon={<IconDownload />}
                onClick={onDownloadAll}
              >
                Download All ({completedReceivedFiles.length})
              </Button>
            </div>
          )}
        </div>
      }
      visible={visible}
      footer={null}
      onCancel={onCancel}
      maskClosable={false}
    >
      {totalFiles > 1 && inProgressFiles > 0 && (
        <div className={styles.batchSummaryBar}>
          <div className={styles.batchInfo}>
            <span>
              Transferring: <strong>{inProgressFiles}</strong> of{" "}
              <strong>{totalFiles}</strong> files active
            </span>
          </div>
        </div>
      )}

      <div className={styles.modalContent} ref={listRef}>
        {list.map((item, index) => (
          <div
            key={index}
            className={cs(
              styles.messageItem,
              item.from === TRANSFER_FROM.SELF && styles.alignRight
            )}
          >
            <div className={styles.messageContent}>
              {item.from === TRANSFER_FROM.PEER && item.targetId && (
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)", marginBottom: "3px" }}>
                  {item.targetId}
                </div>
              )}
              {item.key === TRANSFER_TYPE.TEXT ? (
                <span>{item.data}</span>
              ) : (
                <div className={styles.fileMessage}>
                  <div className={styles.fileHeader}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.fileName}>
                        <IconFile className={styles.fileIcon} />
                        <span>{item.name}</span>
                      </div>
                      <div className={styles.fileSubDetails}>
                        <span>{formatBytes(item.size)}</span>
                        {item.status === FILE_STATUS.TRANSFERRING && (
                          <Fragment>
                            {Boolean(item.speed) && (
                              <span className={styles.telemetryBadge}>
                                {formatSpeed(item.speed || 0)}
                              </span>
                            )}
                            {Boolean(item.eta) && (
                              <span className={styles.telemetryBadge}>{formatEta(item.eta || 0)}</span>
                            )}
                          </Fragment>
                        )}
                        {item.status === FILE_STATUS.PAUSED && (
                          <span className={styles.telemetryBadge} style={{ background: "rgba(255, 125, 0, 0.4)" }}>
                            Paused
                          </span>
                        )}
                        {item.status === FILE_STATUS.VERIFYING && (
                          <span className={styles.telemetryBadge} style={{ background: "rgba(22, 93, 255, 0.4)" }}>
                            Verifying Checksum...
                          </span>
                        )}
                        {item.status === FILE_STATUS.COMPLETED && (
                          <span className={styles.telemetryBadge} style={{ background: "rgba(0, 180, 42, 0.4)" }}>
                            Completed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.fileActions}>
                      {item.progress < 100 && (
                        <Tooltip content={item.status === FILE_STATUS.PAUSED ? "Resume Transfer" : "Pause Transfer"}>
                          <div
                            className={styles.actionButton}
                            onClick={() =>
                              item.status === FILE_STATUS.PAUSED
                                ? onResumeTransfer(item.id, item.targetId)
                                : onPauseTransfer(item.id, item.targetId)
                            }
                          >
                            {item.status === FILE_STATUS.PAUSED ? <IconPlayArrow /> : <IconPause />}
                          </div>
                        </Tooltip>
                      )}
                      {!stream && (
                        <Tooltip content="Download File">
                          <div
                            className={cs(styles.actionButton, item.progress !== 100 && styles.disable)}
                            onClick={() => item.progress === 100 && onDownloadFile(item.id, item.name)}
                          >
                            <IconToBottom />
                          </div>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  <div className={styles.progressBarWrapper}>
                    <Progress color="#fff" trailColor="rgba(255,255,255,0.3)" percent={item.progress}></Progress>
                  </div>

                  {Boolean(item.sha256) && (
                    <div className={styles.hashIntegrityRow}>
                      <div className={styles.hashLabel}>
                        <IconCheckCircleFill style={{ color: "#00e676", fontSize: 12 }} />
                        <span>SHA-256:</span>
                      </div>
                      <Tooltip content="Click to copy full SHA-256 checksum">
                        <div className={styles.hashText} onClick={() => copyHash(item.sha256 || "")}>
                          <span>{item.sha256?.slice(0, 10)}...{item.sha256?.slice(-6)}</span>
                          <IconCopy style={{ marginLeft: 4, fontSize: 10 }} />
                        </div>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div
        className={styles.modalFooter}
        onDragEnter={() => peerIds.length > 0 && setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDropFiles}
        onDragOver={e => e.preventDefault()}
      >
        {peerIds.length > 0 ? (
          isDragging ? (
            <Fragment>Drop Multiple Files or Folders To Upload</Fragment>
          ) : (
            <Fragment>
              <div className={styles.sendFileGroup}>
                <Tooltip content="Select multiple files">
                  <Button
                    disabled={!enableTransfer}
                    type="primary"
                    icon={<IconFile />}
                    onClick={onSendFile}
                  >
                    Files
                  </Button>
                </Tooltip>
                <Tooltip content="Select entire folder">
                  <Button
                    disabled={!enableTransfer}
                    icon={<IconFolder />}
                    onClick={onSendFolder}
                  >
                    Folder
                  </Button>
                </Tooltip>
              </div>
              <Input
                value={text}
                onChange={setText}
                disabled={!enableTransfer}
                allowClear
                placeholder="Send Message or Drag & Drop Multiple Files"
                onPressEnter={onSendText}
              />
              <Button
                onClick={onSendText}
                disabled={!enableTransfer}
                type="primary"
                status="success"
                icon={<IconSend />}
              >
                Send
              </Button>
            </Fragment>
          )
        ) : (
          <Fragment>
            <Input
              value={toConnectId}
              disabled={state === CONNECTION_STATE.CONNECTING}
              onChange={setToConnectId}
              allowClear
              placeholder="Peer ID"
              onPressEnter={onSendText}
            />
            <Button
              onClick={onConnectPeer}
              disabled={!toConnectId || state === CONNECTION_STATE.CONNECTING}
              type="primary"
              icon={<IconRight />}
            >
              Connect
            </Button>
          </Fragment>
        )}
      </div>
    </Modal>
  );
};
