import type { Member } from "../types/server";
import os from "os";
import type http from "http";

export const updateMember = <T extends keyof Member>(
  map: Map<string, Member>,
  id: string,
  key: T,
  value: Member[T]
) => {
  const instance = map.get(id);
  if (instance) {
    map.set(id, { ...instance, [key]: value });
  } else {
    console.warn(`UpdateMember: ${id} Not Found`);
  }
};

export const getLocalIp = () => {
  const result: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const key in interfaces) {
    const networkInterface = interfaces[key];
    if (!networkInterface) continue;
    for (const inf of networkInterface) {
      if (inf.family === "IPv4" && !inf.internal) {
        result.push(inf.address);
      }
    }
  }
  return result;
};

export const getIpByRequest = (request: http.IncomingMessage) => {
  let ip = "";
  if (request.headers["x-real-ip"]) {
    ip = request.headers["x-real-ip"].toString();
  } else if (request.headers["x-forwarded-for"]) {
    const forwarded = request.headers["x-forwarded-for"].toString();
    const [firstIp] = forwarded.split(",");
    ip = firstIp ? firstIp.trim() : "";
  } else {
    ip = request.socket.remoteAddress || "";
  }

  // Strip IPv6 prefix if present (e.g. ::ffff:10.193.212.221 -> 10.193.212.221)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // Group local/LAN devices into matching rooms for automatic peer discovery
  if (ip === "::1" || ip === "127.0.0.1" || !ip) {
    ip = "127.0.0.1";
  } else if (ip.startsWith("192.168.")) {
    ip = "192.168.0.0";
  } else if (ip.startsWith("10.")) {
    ip = "10.0.0.0";
  } else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
    ip = "172.16.0.0";
  }

  return ip;
};
