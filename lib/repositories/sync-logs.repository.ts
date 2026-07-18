import type { SyncType, SyncStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";

export const syncLogsRepository = {
  async start(type: SyncType) {
    return prisma.syncLog.create({
      data: {
        type,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });
  },

  async complete(
    id: string,
    data: {
      status: SyncStatus;
      ordersSynced?: number;
      trackingUpdated?: number;
      errorsCount?: number;
      errorMessage?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return prisma.syncLog.update({
      where: { id },
      data: {
        ...data,
        finishedAt: new Date(),
      },
    });
  },

  async listRecent(type?: SyncType, limit: number = 20) {
    return prisma.syncLog.findMany({
      where: type ? { type } : undefined,
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },

  async getLastByType(type: SyncType) {
    return prisma.syncLog.findFirst({
      where: { type },
      orderBy: { startedAt: "desc" },
    });
  },
};
