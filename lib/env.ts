import { z } from "zod";

/**
 * Environment variable validation.
 * App refuses to boot if anything is missing or malformed.
 *
 * In dev mode, defaults are provided for an out-of-the-box experience.
 * In prod mode, every variable is required.
 */

const isProd = process.env.NODE_ENV === "production";

// In dev, we accept placeholder values; in prod, we enforce real secrets.
const devString = (fallback: string) =>
  isProd ? z.string().min(1) : z.string().default(fallback);

const envSchema = z.object({
  // Database
  DATABASE_URL: devString(
    "postgresql://user:password@localhost:5432/etsy_dashboard?schema=public",
  ),

  // Etsy OAuth
  ETSY_API_KEY: devString("dev_etsy_api_key_placeholder"),
  ETSY_SHARED_SECRET: devString("dev_etsy_shared_secret_placeholder"),
  ETSY_REDIRECT_URI: devString(
    "http://localhost:3000/api/auth/etsy/callback",
  ),
  ETSY_SCOPES: devString(
    "transactions_r transactions_w listings_r profile_r",
  ),
  // Etsy shop/user (look up via API or hardcode for single-user apps)
  ETSY_SHOP_ID: devString(""),
  ETSY_USER_ID: devString(""),
  ETSY_SHOP_NAME: devString(""),

  // AfterShip
  AFTERSHIP_API_KEY: devString("dev_aftership_key_placeholder"),
  AFTERSHIP_API_BASE: devString(
    "https://api.aftership.com/tracking/2024-07",
  ),

  // Encryption (32 bytes, base64)
  ENCRYPTION_KEY: devString(
    "ZGV2X2VuY3J5cHRpb25fa2V5XzMyX2J5dGVzX2Jhc2U2NF9hYWFhYQ==",
  ),

  // Session signing
  SESSION_SECRET: devString(
    "ZGV2X3Nlc3Npb25fc2VjcmV0XzMyX2J5dGVzX2Jhc2U2NF9iYmJiYg==",
  ),

  // Cron protection
  CRON_SECRET: devString(
    "ZGV2X2Nyb25fc2VjcmV0XzMyX2J5dGVzX2Jhc2U2NF9jY2NjYw==",
  ),

  // App
  NEXT_PUBLIC_APP_URL: devString("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Optional Sentry
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // Dev seed
  SEED_DATA: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  throw new Error("Invalid environment variables. Check .env.local");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

/**
 * Check if we're running with real credentials (not dev placeholders).
 * Used to gate features that would fail without real API keys.
 */
export function hasRealEtsyCredentials(): boolean {
  return (
    !env.ETSY_API_KEY.startsWith("dev_") &&
    !env.ETSY_SHARED_SECRET.startsWith("dev_")
  );
}

export function hasRealAfterShipCredentials(): boolean {
  return !env.AFTERSHIP_API_KEY.startsWith("dev_");
}
