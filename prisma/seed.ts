/**
 * Seed script — populates the database with realistic fake data.
 *
 * Run: npm run db:seed
 * Or auto: set SEED_DATA=true in .env.local and run npm run dev
 *
 * Idempotent: deletes existing seed data before inserting.
 *
 * Generates:
 *   - 1 User (placeholder for OAuth — no real tokens)
 *   - 200 orders spread over the last 90 days
 *   - 1-3 order items per order
 *   - Tracking events for 70% of orders
 *   - 90 days of DailyMetric
 *   - A few SyncLog entries
 */

import { PrismaClient, type OrderStatus } from "@prisma/client";
import { encrypt } from "../lib/crypto";

const prisma = new PrismaClient();

// =====================================================
// Config
// =====================================================
const ORDER_COUNT = 200;
const SEED_USER_ID = "seed-user-001";

const COUNTRIES = [
  { code: "US", weight: 35 },
  { code: "GB", weight: 18 },
  { code: "CA", weight: 12 },
  { code: "AU", weight: 8 },
  { code: "FR", weight: 6 },
  { code: "DE", weight: 5 },
  { code: "NL", weight: 4 },
  { code: "IT", weight: 3 },
  { code: "ES", weight: 3 },
  { code: "JP", weight: 2 },
  { code: "SE", weight: 2 },
  { code: "BR", weight: 2 },
];

const CARRIERS = [
  { slug: "usps", weight: 30 },
  { slug: "royal-mail", weight: 18 },
  { slug: "canada-post", weight: 12 },
  { slug: "australia-post", weight: 8 },
  { slug: "la-poste", weight: 6 },
  { slug: "dhl", weight: 10 },
  { slug: "fedex", weight: 8 },
  { slug: "ups", weight: 8 },
];

const STATUSES: OrderStatus[] = [
  "DELIVERED",
  "DELIVERED",
  "DELIVERED",
  "DELIVERED",
  "DELIVERED",
  "IN_TRANSIT",
  "IN_TRANSIT",
  "PRE_TRANSIT",
  "EXCEPTION",
  "FAILED_ATTEMPT",
];

const FIRST_NAMES = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Sophia", "Elijah",
  "Charlotte", "James", "Amelia", "William", "Isabella", "Benjamin", "Mia",
  "Lucas", "Harper", "Henry", "Evelyn", "Theodore", "Abigail", "Jack",
  "Emily", "Levi", "Elizabeth", "Alexander", "Sofia", "Mason", "Avery", "Ethan",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Clark", "Lewis", "Robinson", "Walker", "Young", "King",
];

const PRODUCT_TITLES = [
  "Personalized Wooden Name Sign",
  "Custom Watercolor Portrait",
  "Handmade Ceramic Mug",
  "Custom Embroidery Hoop Art",
  "Personalized Family Print",
  "Vintage Wedding Invitation Suite",
  "Hand-knitted Baby Blanket",
  "Custom Pet Portrait Illustration",
  "Engraved Leather Bracelet",
  "Hand-poured Soy Candle Set",
  "Custom Song Lyrics Print",
  "Personalized Cutting Board",
  "Macrame Wall Hanging",
  "Custom House Portrait",
  "Handmade Soap Gift Set",
];

const VARIATIONS = [
  null,
  "Small",
  "Medium",
  "Large",
  "Color: Blush",
  "Color: Sage",
  "Frame: Black",
  "Frame: White",
  "Material: Walnut",
  "Material: Oak",
];

// =====================================================
// Helpers
// =====================================================
function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((acc, x) => acc + x.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  return new Date(
    Date.now() - Math.random() * daysAgo * 24 * 60 * 60 * 1000,
  );
}

function generateTrackingNumber(carrier: string): string {
  const prefix = carrier.toUpperCase().slice(0, 4).replace(/-/g, "");
  return `${prefix}${randomInt(100000000, 999999999)}${randomInt(10, 99)}`;
}

const COUNTRY_NAME: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  FR: "France",
  DE: "Germany",
  NL: "Netherlands",
  IT: "Italy",
  ES: "Spain",
  JP: "Japan",
  SE: "Sweden",
  BR: "Brazil",
};

function generateOrder(i: number) {
  const country = weightedPick(COUNTRIES);
  const carrier = weightedPick(CARRIERS);
  const status = pick(STATUSES);
  const createdAt = randomDate(90);
  const buyerName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

  const itemCount = randomInt(1, 3);
  const items = Array.from({ length: itemCount }).map(() => ({
    etsyListingId: BigInt(randomInt(100000000, 999999999)),
    title: pick(PRODUCT_TITLES),
    quantity: randomInt(1, 3),
    price: parseFloat((Math.random() * 80 + 15).toFixed(2)),
    variation: pick(VARIATIONS),
  }));

  const price = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Status-dependent tracking fields
  const hasTracking = Math.random() < 0.75;
  const trackingNumber = hasTracking ? generateTrackingNumber(carrier.slug) : null;
  const trackingCarrier = hasTracking ? carrier.slug : null;
  const trackingSlug = hasTracking ? carrier.slug : null;

  // Date calculations
  let shippedDate: Date | null = null;
  let deliveryDate: Date | null = null;
  let lastTrackingUpdate: Date | null = null;

  if (status === "DELIVERED") {
    const shipDelay = randomInt(1, 4); // 1-4 days after order
    shippedDate = new Date(createdAt.getTime() + shipDelay * 24 * 60 * 60 * 1000);
    const deliveryDelay = randomInt(3, 14);
    deliveryDate = new Date(
      shippedDate.getTime() + deliveryDelay * 24 * 60 * 60 * 1000,
    );
    lastTrackingUpdate = deliveryDate;
  } else if (
    status === "IN_TRANSIT" ||
    status === "EXCEPTION" ||
    status === "FAILED_ATTEMPT"
  ) {
    const shipDelay = randomInt(1, 5);
    shippedDate = new Date(createdAt.getTime() + shipDelay * 24 * 60 * 60 * 1000);
    lastTrackingUpdate = new Date(
      shippedDate.getTime() + randomInt(1, 10) * 24 * 60 * 60 * 1000,
    );
  } else if (status === "PRE_TRANSIT" || status === "AVAILABLE_FOR_PICKUP") {
    lastTrackingUpdate = new Date(
      createdAt.getTime() + randomInt(0, 3) * 24 * 60 * 60 * 1000,
    );
  }

  return {
    etsyReceiptId: BigInt(1000000 + i),
    buyerName,
    buyerEmail: `${buyerName.toLowerCase().replace(" ", ".")}@example.com`,
    country: country.code,
    countryName: COUNTRY_NAME[country.code] ?? country.code,
    price,
    currency: "USD",
    createdAt,
    trackingNumber,
    trackingCarrier,
    trackingSlug,
    status,
    shippedDate,
    deliveryDate,
    lastTrackingUpdate,
    items,
  };
}

function generateTrackingEvents(orderId: string, status: OrderStatus, shippedDate: Date | null, deliveryDate: Date | null) {
  if (!shippedDate) return [];

  const events: {
    orderId: string;
    status: string;
    appStatus: OrderStatus;
    description: string;
    location: string | null;
    eventDate: Date;
  }[] = [];

  // Info received
  events.push({
    orderId,
    status: "InfoReceived",
    appStatus: "PRE_TRANSIT",
    description: "Shipping label created",
    location: "Sender location",
    eventDate: new Date(shippedDate.getTime() - 12 * 60 * 60 * 1000),
  });

  // Picked up
  events.push({
    orderId,
    status: "InTransit",
    appStatus: "IN_TRANSIT",
    description: "Picked up by carrier",
    location: "Sender location",
    eventDate: shippedDate,
  });

  // In transit events
  if (status === "DELIVERED" || status === "IN_TRANSIT" || status === "EXCEPTION" || status === "FAILED_ATTEMPT") {
    const transitDays = status === "DELIVERED" && deliveryDate
      ? Math.floor((deliveryDate.getTime() - shippedDate.getTime()) / (1000 * 60 * 60 * 24))
      : randomInt(1, 8);

    for (let i = 1; i < Math.min(transitDays, 5); i++) {
      events.push({
        orderId,
        status: "InTransit",
        appStatus: "IN_TRANSIT",
        description: "In transit to destination",
        location: pick(["Chicago, IL", "Memphis, TN", "Louisville, KY", "Atlanta, GA", "Dallas, TX"]),
        eventDate: new Date(shippedDate.getTime() + i * 24 * 60 * 60 * 1000),
      });
    }
  }

  // Final event
  if (status === "DELIVERED" && deliveryDate) {
    events.push({
      orderId,
      status: "Delivered",
      appStatus: "DELIVERED",
      description: "Delivered to recipient",
      location: "Destination",
      eventDate: deliveryDate,
    });
  } else if (status === "EXCEPTION") {
    events.push({
      orderId,
      status: "Exception",
      appStatus: "EXCEPTION",
      description: "Address undeliverable — return to sender",
      location: "Destination hub",
      eventDate: new Date(shippedDate.getTime() + randomInt(3, 10) * 24 * 60 * 60 * 1000),
    });
  } else if (status === "FAILED_ATTEMPT") {
    events.push({
      orderId,
      status: "AttemptFail",
      appStatus: "FAILED_ATTEMPT",
      description: "Delivery attempt failed — recipient not available",
      location: "Destination",
      eventDate: new Date(shippedDate.getTime() + randomInt(2, 8) * 24 * 60 * 60 * 1000),
    });
  }

  return events;
}

function generateDailyMetrics(orders: { createdAt: Date; status: OrderStatus; country: string; trackingCarrier: string | null; price: number; shippedDate: Date | null; deliveryDate: Date | null }[]) {
  const metrics = new Map<string, {
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
    deliveryDays: number[];
  }>();

  for (let i = 0; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    metrics.set(key, {
      date: d,
      totalOrders: 0,
      delivered: 0,
      inTransit: 0,
      exception: 0,
      preTransit: 0,
      failedAttempt: 0,
      availablePickup: 0,
      avgDeliveryDays: null,
      totalRevenue: 0,
      byCountry: {},
      byCarrier: {},
      deliveryDays: [],
    });
  }

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const m = metrics.get(key);
    if (!m) continue;
    m.totalOrders++;
    m.totalRevenue += order.price;
    m.byCountry[order.country] = (m.byCountry[order.country] ?? 0) + 1;
    if (order.trackingCarrier) {
      m.byCarrier[order.trackingCarrier] = (m.byCarrier[order.trackingCarrier] ?? 0) + 1;
    }
    if (order.status === "DELIVERED") {
      m.delivered++;
      if (order.shippedDate && order.deliveryDate) {
        const days = (order.deliveryDate.getTime() - order.shippedDate.getTime()) / (1000 * 60 * 60 * 24);
        m.deliveryDays.push(days);
      }
    } else if (order.status === "IN_TRANSIT") {
      m.inTransit++;
    } else if (order.status === "EXCEPTION") {
      m.exception++;
    } else if (order.status === "PRE_TRANSIT") {
      m.preTransit++;
    } else if (order.status === "FAILED_ATTEMPT") {
      m.failedAttempt++;
    } else if (order.status === "AVAILABLE_FOR_PICKUP") {
      m.availablePickup++;
    }
  }

  for (const m of metrics.values()) {
    m.avgDeliveryDays = m.deliveryDays.length > 0
      ? m.deliveryDays.reduce((a, b) => a + b, 0) / m.deliveryDays.length
      : null;
  }

  return Array.from(metrics.values());
}

// =====================================================
// Main
// =====================================================
async function main() {
  console.log("🌱 Seeding database…");

  // Clean slate
  console.log("  → Cleaning existing data");
  await prisma.trackingEvent.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.syncLog.deleteMany({});
  await prisma.dailyMetric.deleteMany({});
  await prisma.user.deleteMany({});

  // 1) User (placeholder so the dashboard works without OAuth)
  console.log("  → Creating placeholder user");
  const dummyToken = encrypt("seed-placeholder-not-a-real-token");
  await prisma.user.create({
    data: {
      id: SEED_USER_ID,
      etsyUserId: "12345678",
      shopId: "12345678",
      shopName: "My Etsy Shop (Seed Data)",
      accessToken: dummyToken.ciphertext,
      accessTokenIv: dummyToken.iv,
      accessTokenAuth: dummyToken.authTag,
      refreshToken: dummyToken.ciphertext,
      refreshTokenIv: dummyToken.iv,
      refreshTokenAuth: dummyToken.authTag,
      tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      scopes: "transactions_r transactions_w listings_r profile_r",
    },
  });

  // 2) Orders + items + tracking events
  console.log(`  → Creating ${ORDER_COUNT} orders`);
  const orders = Array.from({ length: ORDER_COUNT }, (_, i) => generateOrder(i));

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const created = await prisma.order.create({
      data: {
        etsyReceiptId: o.etsyReceiptId,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        country: o.country,
        countryName: o.countryName,
        price: o.price,
        currency: o.currency,
        createdAt: o.createdAt,
        trackingNumber: o.trackingNumber,
        trackingCarrier: o.trackingCarrier,
        trackingSlug: o.trackingSlug,
        status: o.status,
        shippedDate: o.shippedDate,
        deliveryDate: o.deliveryDate,
        lastTrackingUpdate: o.lastTrackingUpdate,
        orderItems: {
          create: o.items,
        },
      },
    });

    if (o.trackingNumber && o.shippedDate) {
      const events = generateTrackingEvents(created.id, o.status, o.shippedDate, o.deliveryDate);
      for (const event of events) {
        await prisma.trackingEvent.create({ data: event });
      }
    }
  }

  // 3) Daily metrics
  console.log("  → Computing daily metrics (90 days)");
  const allOrders = await prisma.order.findMany({
    select: {
      createdAt: true,
      status: true,
      country: true,
      trackingCarrier: true,
      price: true,
      shippedDate: true,
      deliveryDate: true,
    },
  });
  const metrics = generateDailyMetrics(
    allOrders.map((o) => ({
      ...o,
      price: Number(o.price),
    })),
  );
  for (const m of metrics) {
    await prisma.dailyMetric.create({
      data: {
        date: m.date,
        totalOrders: m.totalOrders,
        delivered: m.delivered,
        inTransit: m.inTransit,
        exception: m.exception,
        preTransit: m.preTransit,
        failedAttempt: m.failedAttempt,
        availablePickup: m.availablePickup,
        avgDeliveryDays: m.avgDeliveryDays,
        totalRevenue: m.totalRevenue,
        byCountry: m.byCountry,
        byCarrier: m.byCarrier,
      },
    });
  }

  // 4) Some sync logs
  console.log("  → Creating sync log history");
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const type = pick(["ORDERS_SYNC", "TRACKING_REFRESH", "TOKEN_REFRESH", "DAILY_METRICS"] as const);
    const startedAt = new Date(now - i * 30 * 60 * 1000);
    const finishedAt = new Date(startedAt.getTime() + randomInt(5, 30) * 1000);
    const success = Math.random() < 0.9;
    await prisma.syncLog.create({
      data: {
        type,
        status: success ? "SUCCESS" : "PARTIAL",
        startedAt,
        finishedAt,
        ordersSynced: type === "ORDERS_SYNC" ? randomInt(0, 10) : 0,
        trackingUpdated: type === "TRACKING_REFRESH" ? randomInt(0, 25) : 0,
        errorsCount: success ? 0 : randomInt(1, 3),
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log(`   ${ORDER_COUNT} orders`);
  console.log(`   90 days of daily metrics`);
  console.log(`   20 sync log entries`);
  console.log("\n   Sign in with seed user (no real OAuth needed)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
