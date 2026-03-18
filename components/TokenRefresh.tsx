"use client";

import { useEffect } from "react";

export function TokenRefresh() {
  useEffect(() => {
    // Fire-and-forget — refresh token on app load
    fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
