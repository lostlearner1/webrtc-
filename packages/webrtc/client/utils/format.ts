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
