import "express";

declare module "express" {
  interface Request {
    session?: {
      jwt?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    } | null;
    user?: {
      id?: string;
      name?: string;
      email?: string;
      role?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  }
}
