"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function HealthRefreshButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.refresh()}
    >
      <RefreshCw className="h-3.5 w-3.5 mr-1" />
      Refresh
    </Button>
  );
}
