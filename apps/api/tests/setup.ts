import path from "path";
import { EventEmitter } from "events";

process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../test.db")}`;
process.env.ALLOW_NO_ORIGIN = "true";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.APS_CLIENT_ID = "mock_client_id";
process.env.APS_CLIENT_SECRET = "mock_client_secret_at_least_32_chars_long";
process.env.APS_CALLBACK_URL = "http://localhost:3000/api/auth/callback";
process.env.APS_BUCKET = "mock_bucket";
process.env.SESSION_SECRET =
  "mock_session_secret_at_least_32_chars_long_enough";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.APS_WARMUP_ON_START = "false";
process.env.RUN_WORKERS = "false";

// Manual Redis mock - no external dependencies
class MockRedis extends EventEmitter {
  private data: Map<string, string> = new Map();
  public status: string = "ready";

  constructor() {
    super();
    // Emit ready event asynchronously
    setTimeout(() => {
      this.emit("ready");
    }, 0);
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.data.set(key, value);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.delete(key)) deleted++;
    }
    return deleted;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return Array.from(this.data.keys()).filter((k) => regex.test(k));
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  async quit(): Promise<"OK"> {
    this.emit("end");
    return "OK";
  }

  async disconnect(): Promise<void> {
    this.emit("end");
  }

  duplicate(): MockRedis {
    return new MockRedis();
  }
}

// Mock ioredis module
jest.mock("ioredis", () => {
  const Mock = MockRedis;
  // Support both default and named imports
  (Mock as unknown as { Redis: typeof MockRedis }).Redis = Mock;
  (Mock as unknown as { default: typeof MockRedis }).default = Mock;
  return Mock;
});

// Mock bullmq (Queue used in lib/queue.ts, Worker/Job used in workers/)
jest.mock("bullmq", () => {
  class MockQueue {
    constructor() {}
    async add() {
      return { id: "mock-job-1" };
    }
    async addBulk() {
      return [];
    }
    async close() {}
    on() {
      return this;
    }
  }
  class MockWorker extends EventEmitter {
    constructor() {
      super();
    }
    async close() {}
    on() {
      return this;
    }
  }
  class MockJob {
    id = "mock-job-1";
    data = {};
    progress = 0;
    async updateProgress(val: number) {
      this.progress = val;
    }
  }
  return { Queue: MockQueue, Worker: MockWorker, Job: MockJob };
});

// Mock uuid (ESM-only in v13+, incompatible with Jest CJS transform)
jest.mock("uuid", () => {
  let counter = 0;
  return {
    v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
    v1: () => `00000000-0000-1000-8000-${String(++counter).padStart(12, "0")}`,
  };
});
