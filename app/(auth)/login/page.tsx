import Link from "next/link";
import { redirect } from "next/navigation";
import { Store, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";
import { hasRealEtsyCredentials } from "@/lib/env";

export const metadata = {
  title: "Sign in",
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const errorMessages: Record<string, string> = {
    oauth_failed: "OAuth authentication failed. Please try again.",
    invalid_state: "Invalid OAuth state. Please try again.",
    missing_params: "Missing required OAuth parameters.",
    access_denied: "You denied access to your Etsy account.",
  };
  const errorMessage = params.error ? errorMessages[params.error] : null;
  const hasCreds = hasRealEtsyCredentials();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-lg">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Etsy Tracker</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Track your Etsy orders and shipment statuses in one place.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          {errorMessage && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {!hasCreds && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Dev mode active</p>
              <p className="text-xs mt-1">
                Set <code className="text-xs">ETSY_API_KEY</code> and{" "}
                <code className="text-xs">ETSY_SHARED_SECRET</code> in{" "}
                <code className="text-xs">.env.local</code> to enable real OAuth.
              </p>
            </div>
          )}

          <Button
            asChild
            variant="brand"
            size="lg"
            className="w-full"
            disabled={!hasCreds}
          >
            <Link href="/api/auth/etsy">
              <span>Connect with Etsy</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          {!hasCreds && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <form action="/api/auth/dev-login" method="POST">
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Sign in as seed user (dev only)
                </Button>
              </form>
            </>
          )}

          <p className="text-xs text-center text-muted-foreground">
            We only request read access to your receipts and tracking.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Single-user app · Your data stays on your database
        </p>
      </div>
    </div>
  );
}
