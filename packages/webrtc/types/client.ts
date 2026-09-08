import type { Object } from "laser-utils";

export const CONNECTION_STATE = {
  INIT: "INIT",
  READY: "READY",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
} as const;

export const DEVICE_TYPE = {
  MOBILE: "MOBILE",
  PC: "PC",
} as const;

export const MESSAGE_TYPE = {
  TEXT: "TEXT",
  FILE_START: "FILE_START",
  FILE_READY: "FILE_READY",
  FILE_NEXT: "FILE_NEXT",
  FILE_PAUSE: "FILE_PAUSE",
  FILE_RESUME: "FILE_RESUME",
  FILE_CANCEL: "FILE_CANCEL",
  FILE_PROGRESS: "FILE_PROGRESS",
  FILE_FINISH: "FILE_FINISH",
  FILE_VERIFIED: "FILE_VERIFIED",
} as const;

export const TRANSFER_TYPE = {
  TEXT: "TEXT",
  FILE: "FILE",
} as const;

export const TRANSFER_FROM = {
  SELF: "SELF",
  PEER: "PEER",
} as const;

export const FILE_STATUS = {
  PENDING: "PENDING",
  TRANSFERRING: "TRANSFERRING",
  PAUSED: "PAUSED",
  VERIFYING: "VERIFYING",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
} as const;

export type FileStatus = Object.Values<typeof FILE_STATUS>;

export type MessageTypeMap = {
  [MESSAGE_TYPE.TEXT]: { data: string };
  [MESSAGE_TYPE.FILE_START]: { name: string; sha256?: string; chunkSize?: number } & FileMeta;
  [MESSAGE_TYPE.FILE_READY]: { id: string; startSeries?: number };
  [MESSAGE_TYPE.FILE_NEXT]: { series: number } & FileMeta;
  [MESSAGE_TYPE.FILE_PAUSE]: { id: string };
  [MESSAGE_TYPE.FILE_RESUME]: { id: string; series: number };
  [MESSAGE_TYPE.FILE_CANCEL]: { id: string };
  [MESSAGE_TYPE.FILE_PROGRESS]: { id: string; series: number; progress: number };
  [MESSAGE_TYPE.FILE_FINISH]: { id: string; sha256?: string };
  [MESSAGE_TYPE.FILE_VERIFIED]: { id: string; verified: boolean; sha256: string };
};

export type TransferTypeMap = {
  [TRANSFER_TYPE.TEXT]: {
    data: string;
    from: Object.Values<typeof TRANSFER_FROM>;
    targetId?: string;
    time?: string;
  };
  [TRANSFER_TYPE.FILE]: Omit<FileMeta, "total"> & {
    name: string;
    progress: number;
    from: Object.Values<typeof TRANSFER_FROM>;
    targetId?: string;
    status?: FileStatus;
    speed?: number; // bytes per second
    eta?: number; // seconds remaining
    sha256?: string;
    verified?: boolean;
    time?: string;
  };
};

type _Spread<T extends Object.KeyType, M extends Record<Object.KeyType, unknown>> = {
  [P in T]: unknown extends M[P] ? never : M[P] & { key: P };
};
export type Spread<M extends Object.Unknown> = Object.Values<_Spread<Object.Keys<M>, M>>;
export type BufferType = Blob | ArrayBuffer;
export type MessageType = Spread<MessageTypeMap>;
export type TransferType = Spread<TransferTypeMap>;
export type Member = { id: string; device: DeviceType };
export type DeviceType = Object.Values<typeof DEVICE_TYPE>;
export type FileMeta = { id: string; size: number; total: number };
export type ConnectionState = Object.Values<typeof CONNECTION_STATE>;
