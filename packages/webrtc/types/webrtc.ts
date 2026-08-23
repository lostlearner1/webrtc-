import type { WebRTCInstance } from "../client/bridge/instance";
import type { SignalingServer } from "../client/bridge/signaling";

export type WebRTCOptions = { wss: string; ice?: string };
export type WebRTCCallback = (p: { signaling: SignalingServer; rtc: WebRTCApi }) => void;

export type WebRTCApi = {
  connect: (id: string) => Promise<void>;
  send: (message: string | ArrayBuffer, targetId?: string) => void;
  close: (targetId?: string) => void;
  getInstance: (targetId: string) => WebRTCInstance | null;
  getInstances: () => Map<string, WebRTCInstance>;
};

export type WebRTCInstanceOptions = {
  ice?: string;
  signaling: SignalingServer;
  id: string; // The local ID
  targetId: string; // The remote peer ID this instance connects to
  onOpen?: (event: Event, targetId: string) => void;
  onMessage?: (event: MessageEvent, targetId: string) => void;
  onError?: (event: RTCErrorEvent | Event, targetId: string) => void;
  onClose?: (event: Event, targetId: string) => void;
  onConnectionStateChange: (pc: RTCPeerConnection, targetId: string) => void;
};
