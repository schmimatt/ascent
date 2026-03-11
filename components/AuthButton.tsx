"use client";

import { useEffect, useState } from "react";

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
        <span className="text-xs text-muted">
          {session.firstName} {session.lastName?.charAt(0)}.
        </span>
        <a
          href="/api/auth/logout"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Sign out
        </a>
      </div>
    );
  }

  return (
    <a
      href="/api/auth/login"
      className="text-xs px-3 py-1.5 rounded-lg bg-accent-start/20 text-accent-start hover:bg-accent-start/30 transition-colors"
    >
      Sign in with Whoop
    </a>
  );
}
