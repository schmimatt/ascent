"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SessionInfo {
  firstName: string;
  lastName: string;
}

export default function AuthButton() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setSession(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {session.firstName} {session.lastName?.charAt(0)}.
        </span>
        <a href="/api/auth/logout" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Sign out
        </a>
      </div>
    );
  }

  return (
    <a href="/api/auth/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
      Sign in with Whoop
    </a>
  );
}
