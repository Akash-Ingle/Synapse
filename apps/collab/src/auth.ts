import jwt from "jsonwebtoken";
import { config } from "./config.js";

export interface WsIdentity {
  userId: string;
  email: string;
}

export function verifyToken(token: string): WsIdentity | null {
  try {
    const payload = jwt.verify(token, config.jwtAccessSecret) as {
      sub: string;
      email: string;
    };
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
