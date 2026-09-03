import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface OrdersListFilters {
  startDate?: Date;
  endDate?: Date;
  country?: string;
  status?: OrderStatus;
  carrier?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "deliveryDate" | "lastTrackingUpdate" | "status";
  sortOrder?: "asc" | "desc";
}

export const ordersRepository = {
  /**
   * Upsert an order by etsyReceiptId. Replaces order items entirely.
   */
  async upsert(data: {
    etsyReceiptId: bigint;
    buyerName: string;
    buyerEmail?: string | null;
    country: string;
    countryName: string;
    price: number;
    currency: string;
    createdAt: Date;
    trackingNumber?: string | null;
    trackingCarrier?: string | null;
    trackingSlug?: string | null;
    status: OrderStatus;
    receiptStatus?: string | null;
    wasShipped?: boolean;
    wasDelivered?: boolean;
    deliveryDate?: Date | null;
    shippedDate?: Date | null;
    lastTrackingUpdate?: Date | null;
    items: {
      etsyListingId: bigint;
      title: string;
      quantity: number;
      price: number;
      variation?: string | null;
    }[];
  }) {
    const { items, ...orderData } = data;

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.upsert({
        where: { etsyReceiptId: data.etsyReceiptId },
        create: {
          ...orderData,
          etsyReceiptId: data.etsyReceiptId,
          orderItems: {
            create: items.map((item) => ({
              etsyListingId: item.etsyListingId,
              title: item.title,
              quantity: item.quantity,
              price: item.price,
              variation: item.variation,
            })),
          },
        },
        update: {
          ...orderData,
          orderItems: {
            deleteMany: {},
            create: items.map((item) => ({
              etsyListingId: item.etsyListingId,
              title: item.title,
              quantity: item.quantity,
              price: item.price,
              variation: item.variation,
            })),
          },
        },
      });
      return order;
    });
  },

  /**
   * Update just the tracking fields (called by tracking refresh job).
   */
  async updateTracking(
    id: string,
    data: {
      status: OrderStatus;
      lastTrackingUpdate?: Date | null;
      deliveryDate?: Date | null;
      shippedDate?: Date | null;
    },
  ) {
    return prisma.order.update({
      where: { id },
      data,
    });
  },

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: true,
        trackingEvents: {
          orderBy: { eventDate: "desc" },
        },
      },
    });
  },

  async findByEtsyReceiptId(receiptId: bigint) {
    return prisma.order.findUnique({
      where: { etsyReceiptId: receiptId },
    });
  },

  async findByTrackingNumber(trackingNumber: string) {
    return prisma.order.findFirst({
      where: { trackingNumber },
    });
  },

  async list(filters: OrdersListFilters = {}) {
    const {
      startDate,
      endDate,
      country,
      status,
      carrier,
      search,
      page = 1,
      pageSize = 25,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const where: Prisma.OrderWhereInput = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(country && { country }),
      ...(status && { status }),
      ...(carrier && { trackingCarrier: carrier }),
      ...(search && {
        OR: [
          { buyerName: { contains: search, mode: "insensitive" as const } },
          { trackingNumber: { contains: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: { select: { id: true, title: true, quantity: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  /**
   * For tracking refresh: orders that aren't delivered and haven't been
   * checked in the last hour.
   */
  async listForTrackingRefresh(limit: number = 50) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return prisma.order.findMany({
      where: {
        trackingNumber: { not: null },
        // Hybrid: skip if Etsy already says delivered (terminal truth).
        // was_delivered flag is unreliable, so also check receiptStatus.
        wasDelivered: false,
        receiptStatus: { notIn: ["Completed", "completed", "Canceled", "canceled"] },
        status: { not: "DELIVERED" },
        OR: [
          { lastTrackingUpdate: null },
          { lastTrackingUpdate: { lt: oneHourAgo } },
        ],
      },
      orderBy: { lastTrackingUpdate: "asc" },
      take: limit,
    });
  },

  /**
   * Counts for KPI cards. Single SQL query, very fast.
   */
  async getStatusCounts(filters: OrdersListFilters = {}) {
    const { startDate, endDate } = filters;
    const where: Prisma.OrderWhereInput = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
    };
    const counts = await prisma.order.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });
    const result: Record<OrderStatus, number> = {
      DELIVERED: 0,
      IN_TRANSIT: 0,
      EXCEPTION: 0,
      PRE_TRANSIT: 0,
      FAILED_ATTEMPT: 0,
      AVAILABLE_FOR_PICKUP: 0,
      UNKNOWN: 0,
      OUT_FOR_DELIVERY: 0,
      CUSTOMS_HOLD: 0,
      RETURNING: 0,
      RETURNED: 0,
      DAMAGED: 0,
      LOST: 0,
      REJECTED: 0,
      DESTROYED: 0,
      CANCELLED: 0,
    };
    for (const c of counts) {
      result[c.status] = c._count.status;
    }
    return result;
  },

  async getCountryCounts(filters: OrdersListFilters = {}) {
    const { startDate, endDate } = filters;
    const where: Prisma.OrderWhereInput = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
    };
    const counts = await prisma.order.groupBy({
      by: ["country", "countryName"],
      where,
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 20,
    });
    return counts.map((c) => ({
      country: c.country,
      countryName: c.countryName,
      count: c._count.country,
    }));
  },

  async getCarrierCounts(filters: OrdersListFilters = {}) {
    const { startDate, endDate } = filters;
    const where: Prisma.OrderWhereInput = {
      trackingCarrier: { not: null },
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
    };
    const counts = await prisma.order.groupBy({
      by: ["trackingCarrier"],
      where,
      _count: { trackingCarrier: true },
      orderBy: { _count: { trackingCarrier: "desc" } },
    });
    return counts
      .filter((c) => c.trackingCarrier !== null)
      .map((c) => ({
        carrier: c.trackingCarrier!,
        count: c._count.trackingCarrier,
      }));
  },

  async getAverageDeliveryDays(filters: OrdersListFilters = {}) {
    const { startDate, endDate } = filters;
    const orders = await prisma.order.findMany({
      where: {
        status: "DELIVERED",
        deliveryDate: { not: null },
        shippedDate: { not: null },
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
      },
      select: {
        shippedDate: true,
        deliveryDate: true,
      },
    });

    if (orders.length === 0) return null;
    const totalDays = orders.reduce((acc, o) => {
      if (!o.shippedDate || !o.deliveryDate) return acc;
      const ms = o.deliveryDate.getTime() - o.shippedDate.getTime();
      return acc + ms / (1000 * 60 * 60 * 24);
    }, 0);
    return totalDays / orders.length;
  },

  async getTotalRevenue(filters: OrdersListFilters = {}) {
    const { startDate, endDate, country } = filters;
    const where: Prisma.OrderWhereInput = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(country && { country }),
    };
    const result = await prisma.order.aggregate({
      where,
      _sum: { price: true },
      _count: true,
    });
    return {
      total: result._sum.price?.toString() ?? "0",
      count: result._count,
    };
  },
};
