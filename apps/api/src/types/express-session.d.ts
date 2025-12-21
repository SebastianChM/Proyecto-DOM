import "express-session";

declare module "express-session" {
  interface SessionData {
    token?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: {
      id: string;
      name: string;
      email: string;
      role: string;
      picture: string;
    };
  }
}
