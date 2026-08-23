import styles from "../styles/index.module.scss";
import type { FC } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BoardCastIcon, ComputerIcon, PhoneIcon } from "../layout/icon";
import { useMemoFn } from "laser-utils";
import { WebRTC } from "../bridge/webrtc";
import type { WebRTCApi } from "../../types/webrtc";
import type { ServerFn } from "../../types/signaling";
import { SERVER_EVENT } from "../../types/signaling";
import type { ConnectionState, Member } from "../../types/client";
import { CONNECTION_STATE, DEVICE_TYPE } from "../../types/client";
import { TransferModal } from "./modal";
import { QRCodeModal, QRScannerModal } from "./qr-modal";
import { Message } from "@arco-design/web-react";
import { IconQrcode, IconScan } from "@arco-design/web-react/icon";
import { ERROR_TYPE } from "../../types/server";
import { WorkerEvent } from "../worker/event";

export const App: FC = () => {
  const rtc = useRef<WebRTCApi | null>(null);
  const connection = useRef<WebRTC | null>(null);
  const [id, setId] = useState("");
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [state, setState] = useState<ConnectionState>(CONNECTION_STATE.INIT);
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const connectParam = useMemo(() => {
    const search = new URL(location.href).searchParams;
    return search.get("connect") || search.get("target");
  }, []);

  const streamMode = useMemo(() => {
    const search = new URL(location.href).searchParams;
    return search.get("mode") === "stream";
  }, []);

  // === RTC Connection Event ===
  const onOpen = useMemoFn((event: Event, targetId: string) => {
    console.log("OnOpen", event, targetId);
    setVisible(true);
    setPeerIds(prev => Array.from(new Set([...prev, targetId])));
    setState(CONNECTION_STATE.CONNECTED);
  });

  const onClose = useMemoFn((event: Event, targetId: string) => {
    console.log("OnClose", event, targetId);
    setPeerIds(prev => {
      const next = prev.filter(id => id !== targetId);
      if (next.length === 0) {
        setVisible(false);
        setState(CONNECTION_STATE.READY);
      }
      return next;
    });
  });

  const onError = useMemoFn((event: RTCErrorEvent | Event) => {
    console.log("OnError", event);
  });

  const onJoinRoom: ServerFn<typeof SERVER_EVENT.JOINED_ROOM> = useMemoFn(member => {
    console.log("JOIN ROOM", member);
    setMembers([...members, member]);
  });

  const onJoinedMember: ServerFn<typeof SERVER_EVENT.JOINED_MEMBER> = useMemoFn(event => {
    const { initialization } = event;
    console.log("JOINED MEMBER", initialization);
    setMembers([...initialization]);
  });

  const onLeftRoom: ServerFn<typeof SERVER_EVENT.LEFT_ROOM> = useMemoFn(event => {
    const { id: leaveId } = event;
    console.log("LEFT ROOM", leaveId);
    const instance = rtc.current?.getInstance(leaveId);
    // FIX: 移动端切换后台可能会导致 signaling 关闭
    // 但是此时 RTC 仍处于连接活跃状态 需要等待信令切换到前台重连
    // 这种情况下后续的状态控制由 RTC 的 OnClose 等事件来处理更新
    if (peerIds.includes(leaveId) && instance?.connection.connectionState !== "connected") {
      rtc.current?.close(leaveId);
    }
    setMembers(members.filter(member => member.id !== leaveId));
  });

  const onReceiveOffer: ServerFn<typeof SERVER_EVENT.FORWARD_OFFER> = useMemoFn(event => {
    const { origin } = event;
    if (!peerIds.includes(origin)) {
      setPeerIds(prev => Array.from(new Set([...prev, origin])));
      setVisible(true);
      setState(CONNECTION_STATE.CONNECTING);
    }
  });

  const onNotifyError: ServerFn<typeof SERVER_EVENT.NOTIFY_ERROR> = useMemoFn(event => {
    const { code, message } = event;
    Message.error(message);
    switch (code) {
      case ERROR_TYPE.PEER_BUSY:
        setState(CONNECTION_STATE.READY);
        break;
    }
  });

  // === RTC Connection INIT ===
  useLayoutEffect(() => {
    const webrtc = new WebRTC({ wss: location.host });
    webrtc.onOpen = onOpen;
    webrtc.onClose = onClose;
    webrtc.onError = onError;
    webrtc.signaling.on(SERVER_EVENT.JOINED_ROOM, onJoinRoom);
    webrtc.signaling.on(SERVER_EVENT.JOINED_MEMBER, onJoinedMember);
    webrtc.signaling.on(SERVER_EVENT.LEFT_ROOM, onLeftRoom);
    webrtc.signaling.on(SERVER_EVENT.FORWARD_OFFER, onReceiveOffer);
    webrtc.signaling.on(SERVER_EVENT.NOTIFY_ERROR, onNotifyError);
    webrtc.onReady = ({ rtc: instance }) => {
      rtc.current = instance;
      setState(CONNECTION_STATE.READY);
      if (connectParam && connectParam !== webrtc.id) {
        Message.info(`Auto-connecting to device: ${connectParam}`);
        instance.connect(connectParam);
        setVisible(true);
        setPeerIds(prev => Array.from(new Set([...prev, connectParam])));
        setState(CONNECTION_STATE.CONNECTING);
      }
    };
    setId(webrtc.id);
    connection.current = webrtc;
    return () => {
      webrtc.signaling.off(SERVER_EVENT.JOINED_ROOM, onJoinRoom);
      webrtc.signaling.off(SERVER_EVENT.JOINED_MEMBER, onJoinedMember);
      webrtc.signaling.off(SERVER_EVENT.LEFT_ROOM, onLeftRoom);
      webrtc.signaling.off(SERVER_EVENT.FORWARD_OFFER, onReceiveOffer);
      webrtc.signaling.off(SERVER_EVENT.NOTIFY_ERROR, onNotifyError);
      webrtc.destroy();
    };
  }, [
    connectParam,
    onClose,
    onError,
    onJoinRoom,
    onJoinedMember,
    onLeftRoom,
    onNotifyError,
    onOpen,
    onReceiveOffer,
  ]);

  const onPeerConnection = (member: Member) => {
    if (rtc.current && !peerIds.includes(member.id)) {
      rtc.current.connect(member.id);
      setVisible(true);
      setPeerIds(prev => Array.from(new Set([...prev, member.id])));
      setState(CONNECTION_STATE.CONNECTING);
    }
  };

  const onScanPeer = (targetId: string) => {
    if (!targetId) return;
    if (targetId === id) {
      Message.warning("Cannot connect to your own device ID");
      return;
    }
    if (rtc.current && !peerIds.includes(targetId)) {
      rtc.current.connect(targetId);
      setVisible(true);
      setPeerIds(prev => Array.from(new Set([...prev, targetId])));
      setState(CONNECTION_STATE.CONNECTING);
    }
  };

  const onManualRequest = () => {
    setVisible(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.boardCastIcon}>{BoardCastIcon}</div>
        <div>
          {streamMode && WorkerEvent.isTrustEnv() && "STREAM - "}Local ID: {id}
        </div>
        <div className={styles.actionGroup}>
          <div className={styles.actionButton} onClick={() => setQrCodeVisible(true)}>
            <IconQrcode style={{ marginRight: 4, alignSelf: "center" }} />
            Show QR
          </div>
          <div className={styles.actionButton} onClick={() => setScannerVisible(true)}>
            <IconScan style={{ marginRight: 4, alignSelf: "center" }} />
            Scan QR
          </div>
        </div>
        <div className={styles.manualEntry} onClick={onManualRequest}>
          Request To Establish P2P Connection By ID
        </div>
      </div>
      {members.length === 0 && (
        <div className={styles.prompt}>Open Another Device On The LAN To Transfer Files</div>
      )}
      <div className={styles.deviceGroup}>
        {members.map(member => (
          <div key={member.id} className={styles.device} onClick={() => onPeerConnection(member)}>
            <div className={styles.icon}>
              {member.device === DEVICE_TYPE.MOBILE ? PhoneIcon : ComputerIcon}
            </div>
            <div className={styles.name}>{member.id}</div>
          </div>
        ))}
      </div>
      {visible && (
        <TransferModal
          stream={streamMode}
          connection={connection}
          rtc={rtc}
          id={id}
          setId={setId}
          peerIds={peerIds}
          setPeerIds={setPeerIds}
          state={state}
          setState={setState}
          visible={visible}
          setVisible={setVisible}
        ></TransferModal>
      )}
      {qrCodeVisible && (
        <QRCodeModal
          id={id}
          visible={qrCodeVisible}
          onClose={() => setQrCodeVisible(false)}
        />
      )}
      {scannerVisible && (
        <QRScannerModal
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onScan={onScanPeer}
        />
      )}
    </div>
  );
};
