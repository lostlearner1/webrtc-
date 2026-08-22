import type { FC } from "react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Modal, Button, Message, Tooltip } from "@arco-design/web-react";
import {
  IconCopy,
  IconDownload,
  IconSync,
  IconUpload,
} from "@arco-design/web-react/icon";
import QRCode from "qrcode";
import jsQR from "jsqr";
import styles from "../styles/qr-modal.module.scss";

export const parseQRCodeData = (data: string): string => {
  const trimmed = data.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const connectParam =
      url.searchParams.get("connect") ||
      url.searchParams.get("target") ||
      url.searchParams.get("id");
    if (connectParam) {
      return connectParam.trim();
    }
  } catch {
    // Not a valid URL, treat as raw text/ID
  }

  // Handle prefix schemas like ft-peer:XXXX or peer:XXXX
  const prefixMatch = trimmed.match(/^(?:ft-peer|peer):(.+)$/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim();
  }

  return trimmed;
};

export const QRCodeModal: FC<{
  id: string;
  visible: boolean;
  onClose: () => void;
}> = ({ id, visible, onClose }) => {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [activeUrl, setActiveUrl] = useState<string>("");

  useEffect(() => {
    if (!id || !visible) return;

    let baseOrigin = window.location.origin;
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const generate = (targetOrigin: string) => {
      const url = `${targetOrigin}${window.location.pathname}?connect=${id}`;
      setActiveUrl(url);
      QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: "#1d2129",
          light: "#ffffff",
        },
      })
        .then(dataUrl => {
          setQrUrl(dataUrl);
        })
        .catch(err => {
          console.error("Failed to generate QR Code", err);
        });
    };

    if (isLocalhost) {
      fetch("/api/info")
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.ips) && data.ips.length > 0) {
            const lanIp = data.ips[0];
            const port = data.port || window.location.port || "3000";
            const lanOrigin = `${window.location.protocol}//${lanIp}:${port}`;
            generate(lanOrigin);
          } else {
            generate(baseOrigin);
          }
        })
        .catch(() => {
          generate(baseOrigin);
        });
    } else {
      generate(baseOrigin);
    }
  }, [id, visible]);

  const onCopyLink = () => {
    const urlToCopy =
      activeUrl || `${window.location.origin}${window.location.pathname}?connect=${id}`;
    navigator.clipboard
      .writeText(urlToCopy)
      .then(() => {
        Message.success("Pairing link copied to clipboard");
      })
      .catch(() => {
        Message.error("Failed to copy link");
      });
  };

  const onDownloadQR = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `FileTransfer-Pairing-${id}.png`;
    a.click();
  };

  return (
    <Modal
      className={styles.qrModal}
      title="Device Pairing QR Code"
      visible={visible}
      footer={null}
      onCancel={onClose}
      maskClosable={true}
    >
      <div className={styles.qrContainer}>
        <div className={styles.qrWrapper}>
          {qrUrl ? (
            <img src={qrUrl} alt="Pairing QR Code" className={styles.qrImage} />
          ) : (
            <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
              Generating QR Code...
            </div>
          )}
        </div>
        <div className={styles.idBadge}>Device ID: {id}</div>
        <p className={styles.hint}>
          Scan this QR code from another device on your network to connect and transfer files instantly.
        </p>
        <div className={styles.actions}>
          <Button type="primary" icon={<IconCopy />} onClick={onCopyLink}>
            Copy Link
          </Button>
          <Button icon={<IconDownload />} onClick={onDownloadQR}>
            Save Image
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const QRScannerModal: FC<{
  visible: boolean;
  onClose: () => void;
  onScan: (scannedId: string) => void;
}> = ({ visible, onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleScanSuccess = useCallback(
    (rawData: string) => {
      const parsedId = parseQRCodeData(rawData);
      if (parsedId) {
        if ("vibrate" in navigator) {
          try {
            navigator.vibrate(100);
          } catch {
            // ignore vibrate errors
          }
        }
        Message.success(`Scanned Peer: ${parsedId}`);
        stopCamera();
        onScan(parsedId);
        onClose();
      } else {
        Message.warning("Could not find a valid Peer ID in this QR Code");
      }
    },
    [onClose, onScan, stopCamera]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        handleScanSuccess(code.data);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleScanSuccess]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMsg("");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg("Camera access is not supported in this browser. You can upload a QR image instead.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("Camera permission was denied. Please allow camera access or upload an image.");
      } else {
        setErrorMsg("Could not start camera. You can choose an image file to scan.");
      }
    }
  }, [facingMode, scanFrame, stopCamera]);

  useEffect(() => {
    if (visible) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [visible, startCamera, stopCamera]);

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleScanSuccess(code.data);
          } else {
            Message.error("No QR code detected in the uploaded image");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Modal
      className={styles.qrModal}
      title="Scan QR Code to Connect"
      visible={visible}
      footer={null}
      onCancel={onClose}
      maskClosable={true}
    >
      <div className={styles.scannerContainer}>
        <div className={styles.videoWrapper}>
          <video ref={videoRef} playsInline muted autoPlay />
          <div className={styles.reticle}>
            <div className={styles.laser}></div>
          </div>
        </div>

        {errorMsg && <div className={styles.scannerError}>{errorMsg}</div>}

        <div className={styles.scannerControls}>
          <Tooltip content="Switch Camera">
            <Button icon={<IconSync />} onClick={toggleFacingMode}>
              Switch Camera
            </Button>
          </Tooltip>

          <Button
            icon={<IconUpload />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload QR Image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </Modal>
  );
};
