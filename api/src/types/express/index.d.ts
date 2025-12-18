import "express";

declare module "express" {
  interface Request {
    session?: {
      jwt?: string;
      [key: string]: any;
    } | null;
  }
}
