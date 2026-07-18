import { ordersRepository } from "../repositories/orders.repository";
import { dailyMetricsRepository } from "../repositories/daily-metrics.repository";
import type { OrdersListFilters } from "../repositories/orders.repository";
import { prisma } from "../db";

/**
 * Analytics service: pre-computes daily metrics, exposes aggregated views.
 */

export const analyticsService = {
  /**
   * Get current dashboard overview.
   */
  async getOverview(filters: OrdersListFilters = {}) {
    const [statusCounts, revenue, avgDelivery] = await Promise.all([
      ordersRepository.getStatusCounts(filters),
      ordersRepository.getTotalRevenue(filters),
      ordersRepository.getAverageDeliveryDays(filters),
    ]);

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const delivered = statusCounts.DELIVERED;
    const inTransit = statusCounts.IN_TRANSIT;
    const exception = statusCounts.EXCEPTION + statusCounts.FAILED_ATTEMPT;
    const preTransit = statusCounts.PRE_TRANSIT;

    return {
      total,
      delivered,
      inTransit,
      exception,
      preTransit,
      deliveredPct: total > 0 ? (delivered / total) * 100 : 0,
      inTransitPct: total > 0 ? (inTransit / total) * 100 : 0,
      exceptionPct: total > 0 ? (exception / total) * 100 : 0,
      avgDeliveryDays: avgDelivery,
      revenue: revenue.total,
      revenueCount: revenue.count,
    };
  },

  /**
   * Top countries for charts.
   */
  async getCountries(filters: OrdersListFilters = {}) {
    return ordersRepository.getCountryCounts(filters);
  },

  /**
   * Carrier breakdown.
   */
  async getCarriers(filters: OrdersListFilters = {}) {
    return ordersRepository.getCarrierCounts(filters);
  },

  /**
   * Time series: orders per day. Reads from pre-computed DailyMetric
   * for performance.
   */
  async getTimeSeries(days: number = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const metrics = await dailyMetricsRepository.findInRange(start, new Date());

    // Fill missing days with zero
    const result: { date: string; orders: number; delivered: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const metric = metrics.find(
        (m) => m.date.toISOString().slice(0, 10) === iso,
      );
      result.push({
        date: iso,
        orders: metric?.totalOrders ?? 0,
        delivered: metric?.delivered ?? 0,
      });
    }
    return result;
  },

  /**
   * Compute and store daily metrics for a given date (default: yesterday).
   */
  async computeDailyMetrics(date: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        status: true,
        country: true,
        trackingCarrier: true,
        price: true,
        shippedDate: true,
        deliveryDate: true,
      },
    });

    const delivered = orders.filter((o) => o.status === "DELIVERED");
    const inTransit = orders.filter((o) => o.status === "IN_TRANSIT");
    const exception = orders.filter(
      (o) => o.status === "EXCEPTION" || o.status === "FAILED_ATTEMPT",
    );
    const preTransit = orders.filter(
      (o) => o.status === "PRE_TRANSIT" || o.status === "AVAILABLE_FOR_PICKUP",
    );
    const failedAttempt = orders.filter((o) => o.status === "FAILED_ATTEMPT");
    const availablePickup = orders.filter(
      (o) => o.status === "AVAILABLE_FOR_PICKUP",
    );

    // Avg delivery days
    const deliveredWithDates = delivered.filter(
      (o) => o.shippedDate && o.deliveryDate,
    );
    const avgDeliveryDays =
      deliveredWithDates.length > 0
        ? deliveredWithDates.reduce((acc, o) => {
            const ms = o.deliveryDate!.getTime() - o.shippedDate!.getTime();
            return acc + ms / (1000 * 60 * 60 * 24);
          }, 0) / deliveredWithDates.length
        : null;

    // By country
    const byCountry: Record<string, number> = {};
    for (const o of orders) {
      byCountry[o.country] = (byCountry[o.country] ?? 0) + 1;
    }

    // By carrier
    const byCarrier: Record<string, number> = {};
    for (const o of orders) {
      if (o.trackingCarrier) {
        byCarrier[o.trackingCarrier] = (byCarrier[o.trackingCarrier] ?? 0) + 1;
      }
    }

    // Total revenue
    const totalRevenue = orders.reduce(
      (acc, o) => acc + Number(o.price.toString()),
      0,
    );

    return dailyMetricsRepository.upsert({
      date: start,
      totalOrders: orders.length,
      delivered: delivered.length,
      inTransit: inTransit.length,
      exception: exception.length,
      preTransit: preTransit.length,
      failedAttempt: failedAttempt.length,
      availablePickup: availablePickup.length,
      avgDeliveryDays,
      totalRevenue,
      byCountry,
      byCarrier,
    });
  },
};
