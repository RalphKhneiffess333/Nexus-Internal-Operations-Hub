export interface SessionDevice {
  userAgent?: string;
  ip?: string;
}

export interface Session {
  sessionId: string;
  userId: string;
  device: SessionDevice;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
}
