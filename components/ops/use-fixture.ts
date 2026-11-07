"use client";

import { useEffect, useState } from "react";
import { withLatency } from "@/lib/api/core";

/**
 * Simulates the network hop to /api/v1 for fixture-backed lists so every
 * list screen can render its honest loading skeleton before the populated
 * default state. Fixtures are synchronous; the latency is presentation only.
 */
export function useFixture<T>(produce: () => T): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    withLatency(() => produce()).then((v) => {
      if (live) setValue(v);
    });
    return () => {
      live = false;
    };
    // Run once per mount — the fixture set is static for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}
