import { prisma } from "../db";

export const dailyMetricsRepository = {
  async upsert(data: {
    date: Date;
    totalOrders: number;
    delivered: number;
    inTransit: number;
    exception: number;
    preTransit: number;
    failedAttempt: number;
    availablePickup: number;
    avgDeliveryDays: number | null;
    totalRevenue: number;
    byCountry: Record<string, number>;
    byCarrier: Record<string, number>;
  }) {
    return prisma.dailyMetric.upsert({
      where: { date: data.date },
      create: data,
      update: data,
    });
  },

  async findInRange(start: Date, end: Date) {
    return prisma.dailyMetric.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });
  },

  async getLatest() {
    return prisma.dailyMetric.findFirst({
      orderBy: { date: "desc" },
    });
  },
};
