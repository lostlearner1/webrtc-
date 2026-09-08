export const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
};

export const formatSpeed = (bytesPerSec: number) => {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSec)}/s`;
};

export const formatEta = (seconds: number) => {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s left`;
};

export const scrollToBottom = (listRef: React.RefObject<HTMLDivElement>) => {
  if (listRef.current) {
    const el = listRef.current;
    Promise.resolve().then(() => {
      el.scrollTop = el.scrollHeight;
    });
  }
};

export const formatTime = (date = new Date()) => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const PEER_GRADIENTS = [
  "linear-gradient(135deg, #165DFF 0%, #00B42A 100%)",
  "linear-gradient(135deg, #722ED1 0%, #165DFF 100%)",
  "linear-gradient(135deg, #FF7D00 0%, #F53F3F 100%)",
  "linear-gradient(135deg, #0FC6C2 0%, #165DFF 100%)",
  "linear-gradient(135deg, #EB2F96 0%, #722ED1 100%)",
  "linear-gradient(135deg, #00B42A 0%, #0FC6C2 100%)",
];

export const getPeerColor = (id: string) => {
  if (!id) return PEER_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PEER_GRADIENTS[Math.abs(hash) % PEER_GRADIENTS.length];
};
