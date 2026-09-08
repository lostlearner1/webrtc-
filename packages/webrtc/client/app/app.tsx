import styles from "../styles/index.module.scss";
import type { FC } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BoardCastIcon, ComputerIcon, PhoneIcon } from "../layout/icon";
import { cs, useMemoFn } from "laser-utils";
import { WebRTC } from "../bridge/webrtc";
import type { WebRTCApi } from "../../types/webrtc";
import type { ServerFn } from "../../types/signaling";
import { SERVER_EVENT } from "../../types/signaling";
import type { ConnectionState, Member } from "../../types/client";
import { CONNECTION_STATE, DEVICE_TYPE } from "../../types/client";
import { TransferModal } from "./modal";
import { QRCodeModal, QRScannerModal } from "./qr-modal";
import { Button, Input, Modal, Message, Tooltip } from "@arco-design/web-react";
import {
  IconCopy,
  IconLink,
  IconQrcode,
  IconRight,
  IconScan,
  IconThunderbolt,
  IconUserGroup,
  IconWifi,
} from "@arco-design/web-react/icon";
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
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualInputId, setManualInputId] = useState("");

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

  const onCopyId = () => {
    if (id && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      Message.success(`Copied Device ID: ${id}`);
    }
  };

  const onManualConnect = () => {
    const target = manualInputId.trim();
    if (!target) return;
    if (target === id) {
      Message.warning("Cannot connect to your own device ID");
      return;
    }
    if (rtc.current && !peerIds.includes(target)) {
      rtc.current.connect(target);
      setVisible(true);
      setPeerIds(prev => Array.from(new Set([...prev, target])));
      setState(CONNECTION_STATE.CONNECTING);
      setManualModalVisible(false);
      setManualInputId("");
    }
  };

  return (
    <div className={styles.container}>
      {/* === Top Glass Navbar === */}
      <div className={styles.navbar}>
        <div className={styles.navBrand}>
          <div className={styles.brandIcon}>
            <IconThunderbolt />
          </div>
          <span className={styles.brandTitle}>AirP2P Transfer</span>
          {streamMode && WorkerEvent.isTrustEnv() && (
            <span className={styles.streamBadge}>Stream Mode</span>
          )}
        </div>

        <div className={styles.navStatus}>
          <div className={styles.beaconDot} />
          <span>LAN Mesh Online</span>
        </div>

        <div className={styles.navActions}>
          <Button
            size="small"
            type="primary"
            icon={<IconUserGroup />}
            className={styles.navBtn}
            onClick={() => setVisible(true)}
          >
            Group Room {peerIds.length > 0 && `(${peerIds.length})`}
          </Button>
          <Button
            size="small"
            type="outline"
            icon={<IconScan />}
            className={styles.navBtn}
            onClick={() => setScannerVisible(true)}
          >
            Scan QR
          </Button>
        </div>
      </div>

      {/* === Center Discovery Stage === */}
      <div className={styles.centerStage}>
        {members.length === 0 ? (
          <div className={styles.scanningCard}>
            <div className={styles.radarBeaconBox}>
              <div className={styles.radarWave}></div>
              <div className={cs(styles.radarWave, styles.radarWaveDelay)}></div>
              <div className={styles.antennaIcon}>
                <IconWifi />
              </div>
            </div>
            <div className={styles.scanningTitle}>Scanning for Nearby Devices...</div>
            <div className={styles.scanningSubtitle}>
              Open this website on your phone, tablet, or PC on the same Wi-Fi to automatically
              discover each other and start sharing.
            </div>
            <div className={styles.scanningPills}>
              <div className={styles.actionPill} onClick={() => setQrCodeVisible(true)}>
                <IconQrcode />
                <span>Show QR Code</span>
              </div>
              <div className={styles.actionPill} onClick={() => setScannerVisible(true)}>
                <IconScan />
                <span>Scan Device QR</span>
              </div>
              <div className={styles.actionPill} onClick={() => setManualModalVisible(true)}>
                <IconLink />
                <span>Connect by ID</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.discoveredSection}>
            <div className={styles.discoveredHeader}>
              <span className={styles.discoveredTitle}>Discovered Devices on LAN</span>
              <span className={styles.countBadge}>{members.length} Active</span>
            </div>
            <div className={styles.deviceGrid}>
              {members.map(member => (
                <div
                  key={member.id}
                  className={styles.deviceCard}
                  onClick={() => onPeerConnection(member)}
                >
                  <div className={styles.deviceIconBox}>
                    {member.device === DEVICE_TYPE.MOBILE ? PhoneIcon : ComputerIcon}
                  </div>
                  <div className={styles.deviceId}>{member.id}</div>
                  <div className={styles.deviceSubnetTag}>
                    {member.device === DEVICE_TYPE.MOBILE ? "Mobile Device" : "Computer / Laptop"}
                  </div>
                  <div className={styles.connectHoverBtn}>Connect & Send</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* === Bottom Control Dock === */}
      <div className={styles.bottomDock}>
        <div className={styles.dockAntenna}>
          <IconWifi />
        </div>
        <div className={styles.dockDeviceInfo}>
          <span className={styles.dockLabel}>Your Device ID</span>
          <Tooltip content="Click to copy your Device ID">
            <div className={styles.dockIdPill} onClick={onCopyId}>
              <span className={styles.dockIdText}>{id || "Generating..."}</span>
              <IconCopy className={styles.dockCopyIcon} />
            </div>
          </Tooltip>
        </div>
        <div className={styles.dockActions}>
          <Button
            size="small"
            type="primary"
            icon={<IconQrcode />}
            className={styles.dockBtn}
            onClick={() => setQrCodeVisible(true)}
          >
            Show QR
          </Button>
          <Button
            size="small"
            type="outline"
            icon={<IconScan />}
            className={styles.dockBtn}
            onClick={() => setScannerVisible(true)}
          >
            Scan QR
          </Button>
          <Button
            size="small"
            type="text"
            icon={<IconLink />}
            className={styles.dockBtn}
            onClick={() => setManualModalVisible(true)}
          >
            Enter ID
          </Button>
        </div>
      </div>

      {/* === Connect by ID Modal === */}
      {manualModalVisible && (
        <Modal
          title="Direct P2P Connection"
          visible={manualModalVisible}
          onOk={onManualConnect}
          onCancel={() => setManualModalVisible(false)}
          okText="Connect"
        >
          <div className={styles.connectModalBody}>
            <div className={styles.modalDesc}>
              Enter the target peer's Device ID to establish a direct WebRTC peer-to-peer connection:
            </div>
            <Input
              value={manualInputId}
              onChange={setManualInputId}
              allowClear
              placeholder="e.g. W4BU7bWq"
              onPressEnter={onManualConnect}
              className={styles.connectInput}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* === Transfer Modal (Chat / Multi-file stream) === */}
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
        />
      )}

      {/* === QR Code Modal === */}
      {qrCodeVisible && (
        <QRCodeModal
          id={id}
          visible={qrCodeVisible}
          onClose={() => setQrCodeVisible(false)}
        />
      )}

      {/* === QR Scanner Modal === */}
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
