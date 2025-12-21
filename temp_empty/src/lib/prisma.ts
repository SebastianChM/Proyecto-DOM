import { PrismaClient } from "@prisma/client";
import { env } from "../config/env"; // Uses typed config

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Standardize global implementation
export default prisma;
