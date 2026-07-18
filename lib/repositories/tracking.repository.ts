import type { OrderStatus } from "@prisma/client";
import { prisma } from "../db";

export const trackingRepository = {
  /**
   * Idempotent insert: skips on unique conflict.
   * Returns number of NEW events inserted.
   */
  async appendEvents(
    orderId: string,
    events: {
      status: string;
      appStatus: OrderStatus;
      description: string;
      location: string | null;
      eventDate: Date;
    }[],
  ): Promise<number> {
    if (events.length === 0) return 0;

    let inserted = 0;
    for (const event of events) {
      try {
        await prisma.trackingEvent.create({
          data: {
            orderId,
            ...event,
          },
        });
        inserted++;
      } catch (err) {
        // Unique constraint violation = already exists, skip
        if (
          err instanceof Error &&
          (err.message.includes("Unique constraint") ||
            err.message.includes("P2002"))
        ) {
          continue;
        }
        throw err;
      }
    }
    return inserted;
  },

  async findByOrderId(orderId: string) {
    return prisma.trackingEvent.findMany({
      where: { orderId },
      orderBy: { eventDate: "desc" },
    });
  },

  async deleteByOrderId(orderId: string) {
    return prisma.trackingEvent.deleteMany({ where: { orderId } });
  },
};
