import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { redis } from "./redis";

export class SocketService {
  private io: Server | null = null;

  initialize(httpServer: HttpServer) {
    const isDev = process.env.NODE_ENV !== "production";
    const frontendUrl =
      process.env.FRONTEND_URL || (isDev ? "http://localhost:3000" : undefined);

    if (!frontendUrl && !isDev) {
      console.warn("⚠️  Socket.IO: FRONTEND_URL not set in production");
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: frontendUrl,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // Redis Subscription for inter-process events
    const subRedis = redis.duplicate();
    subRedis.subscribe("worker:notifications", (err: unknown) => {
      if (err) console.error("Failed to subscribe to worker events:", err);
      else console.log("✅ Subscribed to worker:notifications");
    });

    subRedis.on("message", (channel: string, message: string) => {
      if (channel === "worker:notifications") {
        try {
          const { userId, projectId, event, data } = JSON.parse(message);
          if (userId) this.notifyUser(userId, event, data);
          else if (projectId) this.notifyProject(projectId, event, data);
        } catch (e) {
          console.error("Error parsing worker notification:", e);
        }
      }
    });

    this.io.on("connection", (socket: Socket) => {
      // ... (rest of connection logic)
      console.log(`🔌 Client connected: ${socket.id}`);

      // Room management: Join user to their own room for private notifications
      socket.on("join_user_room", (userId: string) => {
        if (userId) {
          socket.join(`user:${userId}`);
          console.log(`👤 User ${userId} joined room user:${userId}`);
        }
      });

      // Join project room for team updates
      socket.on("join_project_room", (projectId: string) => {
        if (projectId) {
          socket.join(`project:${projectId}`);
          console.log(`📁 Socket ${socket.id} joined project:${projectId}`);
        }
      });

      socket.on("disconnect", () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Send notification to a specific user
   */
  notifyUser(userId: string, event: string, data: unknown) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  /**
   * Send notification to all members of a project
   */
  notifyProject(projectId: string, event: string, data: unknown) {
    if (this.io) {
      this.io.to(`project:${projectId}`).emit(event, data);
    }
  }
}

export const socketService = new SocketService();
