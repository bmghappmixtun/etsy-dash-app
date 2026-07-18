"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function TokenRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/refresh-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      toast.success("Token refreshed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={onClick} disabled={loading} variant="outline" size="sm">
      <KeyRound className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Refreshing…" : "Refresh token"}
    </Button>
  );
}
