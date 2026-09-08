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

  // Strip IPv6 prefix if present (e.g. ::ffff:192.168.43.1 -> 192.168.43.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // Group all local/LAN/hotspot connections into the same room so localhost and mobile hotspot peers discover each other
  if (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    !ip ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.") ||
    ip.startsWith("169.254.")
  ) {
    return "local-lan-room";
  }

  return ip;
};
