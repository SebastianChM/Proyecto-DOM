import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import type { RequestHandler } from "express";
import { redis } from "./redis";
import { logger } from "./logger";
import { env } from "../config/env";
import prisma from "./prisma";

/** Session user shape stored by express-session. */
type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  picture: string;
};

/** Safely reads the authenticated session user from a Socket.IO socket. */
function getSessionUser(socket: Socket): SessionUser | undefined {
  const req = socket.request as unknown as {
    session?: { user?: SessionUser };
  };
  return req.session?.user;
}

export class SocketService {
  private io: Server | null = null;
  private subRedis: ReturnType<typeof redis.duplicate> | null = null;

  initialize(httpServer: HttpServer, sessionMiddleware: RequestHandler): void {
    const frontendUrl = env.FRONTEND_URL;

    if (env.NODE_ENV === "production" && !frontendUrl) {
      logger.warn("[SOCKET] FRONTEND_URL not set in production");
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: frontendUrl,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // ── Session middleware ──────────────────────────────────────────────────
    // Shares the same Express session with Socket.IO so socket.request.session
    // is populated identically to HTTP routes on every handshake.
    this.io.use((socket, next) => {
      sessionMiddleware(
        socket.request as Parameters<RequestHandler>[0],
        {} as Parameters<RequestHandler>[1],
        // Adapter: Express NextFunction accepts string|Error; Socket.IO next only accepts Error.
        (err?: unknown) => {
          if (err != null) {
            next(err instanceof Error ? err : new Error(String(err)));
          } else {
            next();
          }
        },
      );
    });

    // ── Authentication guard ────────────────────────────────────────────────
    // Any socket without a valid session is rejected before entering any room.
    this.io.use((socket, next) => {
      if (!getSessionUser(socket)?.id) {
        logger.warn("[SOCKET] Unauthenticated connection rejected", {
          socketId: socket.id,
        });
        next(new Error("Authentication required"));
        return;
      }
      next();
    });

    // ── Redis Pub/Sub for inter-process events ──────────────────────────────
    this.subRedis = redis.duplicate();
    this.subRedis.subscribe("worker:notifications", (err: unknown) => {
      if (err) {
        logger.error("[SOCKET] Failed to subscribe to worker events", {
          error: err,
        });
      } else {
        logger.info("[SOCKET] Subscribed to worker:notifications");
      }
    });

    this.subRedis.on("message", (channel: string, message: string) => {
      if (channel === "worker:notifications") {
        try {
          const { userId, projectId, event, data } = JSON.parse(message) as {
            userId?: string;
            projectId?: string;
            event: string;
            data: unknown;
          };
          if (userId) this.notifyUser(userId, event, data);
          else if (projectId) this.notifyProject(projectId, event, data);
        } catch (e) {
          logger.error("[SOCKET] Error parsing worker notification", {
            error: e,
          });
        }
      }
    });

    this.io.on("connection", (socket: Socket) => {
      logger.debug("[SOCKET] Client connected", { socketId: socket.id });

      // ── join_user_room ────────────────────────────────────────────────────
      // A socket may only join its own notification room.
      // Any mismatch is treated as an impersonation attempt.
      socket.on("join_user_room", (userId: string) => {
        const sessionUser = getSessionUser(socket);
        if (!sessionUser || userId !== sessionUser.id) {
          logger.warn("[SOCKET] join_user_room rejected: identity mismatch", {
            socketId: socket.id,
            requested: userId,
            actual: sessionUser?.id,
          });
          socket.disconnect(true);
          return;
        }
        socket.join(`user:${userId}`);
        logger.debug("[SOCKET] User joined room", {
          userId,
          room: `user:${userId}`,
        });
      });

      // ── join_project_room ─────────────────────────────────────────────────
      // Verifies Prisma ProjectMember membership before admitting the socket.
      socket.on("join_project_room", async (projectId: string) => {
        const sessionUser = getSessionUser(socket);
        if (
          !sessionUser ||
          typeof projectId !== "string" ||
          !projectId.trim()
        ) {
          socket.disconnect(true);
          return;
        }
        try {
          const member = await prisma.projectMember.findFirst({
            where: { projectId, userId: sessionUser.id },
            select: { userId: true },
          });
          if (!member) {
            logger.warn("[SOCKET] join_project_room rejected: not a member", {
              socketId: socket.id,
              userId: sessionUser.id,
              projectId,
            });
            socket.disconnect(true);
            return;
          }
          socket.join(`project:${projectId}`);
          logger.debug("[SOCKET] Socket joined project room", {
            socketId: socket.id,
            projectId,
          });
        } catch (error) {
          logger.error("[SOCKET] join_project_room DB error — disconnecting", {
            error: error instanceof Error ? error.message : String(error),
          });
          socket.disconnect(true);
        }
      });

      socket.on("disconnect", () => {
        logger.debug("[SOCKET] Client disconnected", { socketId: socket.id });
      });
    });
  }

  /** Gracefully tears down the Socket.IO server and its dedicated Redis subscriber. */
  async shutdown(): Promise<void> {
    if (this.subRedis) {
      try {
        await this.subRedis.quit();
        logger.info("[SOCKET] subRedis connection closed");
      } catch (error) {
        logger.error("[SOCKET] subRedis quit error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.subRedis = null;
    }
    await new Promise<void>((resolve) => {
      if (this.io) {
        this.io.close(() => {
          logger.info("[SOCKET] Server closed");
          resolve();
        });
      } else {
        resolve();
      }
    });
    this.io = null;
  }

  notifyUser(userId: string, event: string, data: unknown): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  notifyProject(projectId: string, event: string, data: unknown): void {
    if (this.io) {
      this.io.to(`project:${projectId}`).emit(event, data);
    }
  }
}

export const socketService = new SocketService();
