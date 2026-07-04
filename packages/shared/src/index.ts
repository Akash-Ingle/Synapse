export * from "./roles.js";
export * from "./dto.js";
export * from "./ai.js";
export * from "./queues.js";

/** Shared API response envelope helpers. */
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}
