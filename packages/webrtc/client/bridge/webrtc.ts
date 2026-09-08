import type { WebRTCCallback, WebRTCOptions } from "../../types/webrtc";
import { WebRTCInstance } from "./instance";
import { SignalingServer } from "./signaling";
import { getUniqueId } from "laser-utils";
import { CLINT_EVENT, SERVER_EVENT } from "../../types/signaling";

export class WebRTC {
  /** 连接 id */
  public readonly id: string;
  /** RTC 实例集合 */
  private instances = new Map<string, WebRTCInstance>();
  /** 信令服务器 */
  public readonly signaling: SignalingServer;
  /** Ready 事件 */
  public onReady: WebRTCCallback;
  /** RTC Open 事件 */
  public onOpen: (event: Event, targetId: string) => void;
  /** RTC Message 事件 */
  public onMessage: (event: MessageEvent<string | ArrayBuffer>, targetId: string) => void;
  /** RTC Error 事件 */
  public onError: (event: RTCErrorEvent | Event, targetId: string) => void;
  /** RTC Close 事件 */
  public onClose: (event: Event, targetId: string) => void;
  /** RTC Connection State Change 事件 */
  public onConnectionStateChange: (pc: RTCPeerConnection, targetId: string) => void;

  constructor(options: WebRTCOptions) {
    this.onReady = () => null;
    this.onOpen = () => null;
    this.onMessage = () => null;
    this.onError = () => null;
    this.onClose = () => null;
    this.onConnectionStateChange = () => null;
    const STORAGE_KEY = "WEBRTC-ID";
    // https://socket.io/docs/v4/server-socket-instance/#socketid
    this.id = sessionStorage?.getItem(STORAGE_KEY) || getUniqueId(8);
    sessionStorage?.setItem(STORAGE_KEY, this.id);
    this.signaling = new SignalingServer(options.wss, this.id);
    this.signaling.socket.on("connect", this.onConnection);
    this.signaling.on(SERVER_EVENT.FORWARD_OFFER, this.onReceiveOffer);
    this.signaling.on(SERVER_EVENT.FORWARD_MESSAGE, this.onReceiveRelayMessage);
  }

  public createInstance = (targetId: string) => {
    if (this.instances.has(targetId)) {
      this.instances.get(targetId)?.destroy();
      this.instances.delete(targetId);
    }
    const onOpen = (e: Event, id: string) => {
      this.onOpen(e, id);
    };
    const onMessage = (event: MessageEvent<string | ArrayBuffer>, id: string) => {
      this.onMessage(event, id);
    };
    const onError = (event: RTCErrorEvent | Event, id: string) => {
      this.onError(event, id);
    };
    const onClose = (e: Event, id: string) => {
      const instance = this.instances.get(id);
      instance?.destroy();
      this.instances.delete(id);
      this.onClose(e, id);
    };
    const onConnectionStateChange = (pc: RTCPeerConnection, id: string) => {
      this.onConnectionStateChange(pc, id);
    };
    const instance = new WebRTCInstance({
      id: this.id,
      targetId,
      signaling: this.signaling,
      onOpen: onOpen as any,
      onMessage: onMessage as any,
      onError: onError as any,
      onClose: onClose as any,
      onConnectionStateChange,
    });
    this.instances.set(targetId, instance);
    return instance;
  };

  private onConnection = () => {
    const onConnect = async (targetId: string) => {
      let instance = this.instances.get(targetId);
      if (
        !instance ||
        instance.connection.currentLocalDescription ||
        instance.connection.currentRemoteDescription
      ) {
        instance = this.createInstance(targetId);
      }
      instance.createRemoteConnection(targetId);
      return instance.ready;
    };
    const onSendMessage = async (
      message: string | Blob | ArrayBuffer | ArrayBufferView,
      targetId?: string
    ) => {
      const buffer = message instanceof Blob ? await message.arrayBuffer() : message;
      if (targetId) {
        const instance = this.instances.get(targetId);
        if (
          instance &&
          !instance.isFallbackConnected &&
          instance.channel &&
          instance.channel.readyState === "open"
        ) {
          instance.channel.send(buffer as any);
        } else {
          // Seamless Local Relay Fallback
          this.signaling.emit(CLINT_EVENT.SEND_MESSAGE, {
            origin: this.id,
            target: targetId,
            message: buffer as any,
          });
        }
      } else {
        // Broadcast
        for (const [id, instance] of this.instances.entries()) {
          if (
            instance &&
            !instance.isFallbackConnected &&
            instance.channel &&
            instance.channel.readyState === "open"
          ) {
            instance.channel.send(buffer as any);
          } else {
            this.signaling.emit(CLINT_EVENT.SEND_MESSAGE, {
              origin: this.id,
              target: id,
              message: buffer as any,
            });
          }
        }
      }
    };
    const onClose = (targetId?: string) => {
      if (targetId) {
        this.instances.get(targetId)?.destroy();
        this.instances.delete(targetId);
      } else {
        for (const instance of this.instances.values()) {
          instance.destroy();
        }
        this.instances.clear();
      }
    };
    this.onReady({
      signaling: this.signaling,
      rtc: {
        connect: onConnect,
        send: onSendMessage,
        close: onClose,
        getInstance: (targetId: string) => this.instances.get(targetId) || null,
        getInstances: () => this.instances,
      },
    });
  };

  private onReceiveOffer = (params: any) => {
    const { origin } = params;
    let instance = this.instances.get(origin);
    if (!instance) {
      instance = this.createInstance(origin);
      instance.onReceiveOffer(params);
    }
  };

  private onReceiveRelayMessage = (params: any) => {
    const { message, origin } = params;
    this.onMessage(new MessageEvent("message", { data: message }), origin);
  };

  public destroy = () => {
    this.signaling.socket.off("connect", this.onConnection);
    this.signaling.off(SERVER_EVENT.FORWARD_OFFER, this.onReceiveOffer);
    this.signaling.off(SERVER_EVENT.FORWARD_MESSAGE, this.onReceiveRelayMessage);
    this.signaling.destroy();
    for (const instance of this.instances.values()) {
      instance.destroy();
    }
    this.instances.clear();
  };
}
