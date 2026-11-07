"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CapabilityRecord,
  NotificationItem,
  Operation,
  PersonaId,
  PresentationMode,
  ProfileId,
} from "@/lib/types";
import { db } from "@/lib/mock/data";
import { capabilitiesFor } from "@/lib/profiles";
import { landingFor } from "@/lib/api/me";
import { operations } from "@/lib/operations";

/**
 * The demo session context: persona, presentation mode, server profile,
 * theme, density, organization — plus the live operation stream and toasts.
 * Everything here is presentation-level: persona ≠ permission, and the API
 * (mocked in lib/api/*) is the only authorization authority.
 */

export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

export interface Toast {
  id: string;
  kind: "success" | "info" | "error";
  title: string;
  body?: string;
}

interface SessionState {
  persona: PersonaId;
  setPersona: (p: PersonaId) => void;
  presentation: PresentationMode;
  setPresentation: (m: PresentationMode) => void;
  profile: ProfileId;
  setProfile: (p: ProfileId) => void;
  firstRun: boolean;
  setFirstRun: (v: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  organizationId: string;
  setOrganizationId: (id: string) => void;
  supportAccess: boolean;
  setSupportAccess: (v: boolean) => void;
}

const SessionContext = createContext<SessionState | null>(null);
const ToastContext = createContext<{
  toasts: Toast[];
  push: (kind: Toast["kind"], title: string, body?: string) => void;
  dismiss: (id: string) => void;
} | null>(null);
const OperationsContext = createContext<{
  list: Operation[];
  trayOpen: boolean;
  setTrayOpen: (v: boolean) => void;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
} | null>(null);

function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* prototype: ignore corrupt storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key]
  );
  return [value, update];
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = usePersisted<PersonaId>("nx.persona", "self_hoster");
  const [presentation, setPresentation] = usePersisted<PresentationMode>("nx.presentation", "guided");
  const [profile, setProfile] = usePersisted<ProfileId>("nx.profile", "nano");
  const [firstRun, setFirstRun] = usePersisted<boolean>("nx.firstRun", true);
  const [theme, setTheme] = usePersisted<Theme>("nx.theme", "light");
  const [density, setDensity] = usePersisted<Density>("nx.density", "comfortable");
  const [organizationId, setOrganizationId] = usePersisted<string>("nx.org", db.currentOrganization);
  const [supportAccess, setSupportAccess] = usePersisted<boolean>("nx.supportAccess", false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [opList, setOpList] = useState<Operation[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Apply theme + density to <html> (also set by the no-FOUC bootstrap script).
  useEffect(() => {
    const root = document.documentElement;
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    root.classList.toggle("density-compact", density === "compact");
  }, [theme, density]);

  // Mirror the operation engine into React state.
  useEffect(() => {
    operations.seed(db.operations);
    setOpList(operations.list());
    const unsubscribe = operations.subscribe(() => setOpList(operations.list()));
    return unsubscribe;
  }, []);

  const push = useCallback((kind: Toast["kind"], title: string, body?: string) => {
    const id = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, title, body }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const session = useMemo<SessionState>(
    () => ({
      persona,
      setPersona,
      presentation,
      setPresentation,
      profile,
      setProfile,
      firstRun,
      setFirstRun,
      theme,
      setTheme,
      density,
      setDensity,
      organizationId,
      setOrganizationId,
      supportAccess,
      setSupportAccess,
    }),
    [
      persona, setPersona, presentation, setPresentation, profile, setProfile,
      firstRun, setFirstRun, theme, setTheme, density, setDensity,
      organizationId, setOrganizationId, supportAccess, setSupportAccess,
    ]
  );

  return (
    <SessionContext.Provider value={session}>
      <ToastContext.Provider value={{ toasts, push, dismiss }}>
        <OperationsContext.Provider
          value={{ list: opList, trayOpen, setTrayOpen, focusedId, setFocusedId }}
        >
          {children}
        </OperationsContext.Provider>
      </ToastContext.Provider>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <Providers>");
  return ctx;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Providers>");
  return ctx;
}

export function useOperationStream() {
  const ctx = useContext(OperationsContext);
  if (!ctx) throw new Error("useOperationStream must be used inside <Providers>");
  return ctx;
}

/** Capability records for the current demo profile (the signed installer data). */
export function useCapabilities(): CapabilityRecord[] {
  const { profile } = useSession();
  return useMemo(() => capabilitiesFor(profile), [profile]);
}

export function useCapability(key: string): CapabilityRecord {
  const caps = useCapabilities();
  return (
    caps.find((c) => c.capability_key === key) ?? {
      capability_key: key,
      workload_category: "serving",
      ram_floor_mb: 0,
      ram_typical_mb: 0,
      ram_ceiling_mb: 0,
      cpu_weight: 100,
      cpu_max_millicores: null,
      disk_floor_gb: null,
      prerequisites: {},
      state: "available",
      reason: null,
      detected_at: new Date().toISOString(),
      source_digest: "sha256:unknown",
    }
  );
}

/** GET /me/default-landing resolved client-side (router | portfolio | fleet). */
export function useLanding(): "router" | "portfolio" | "fleet" {
  const { persona, firstRun } = useSession();
  return landingFor(persona, firstRun);
}

/** Ticking clock for relative timestamps and "last checked" lines (DS-025). */
export function useNow(intervalMs = 10000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Demo notifications (reads the shared dataset; swap for GET /notifications). */
export function useNotifications(): NotificationItem[] {
  return db.notifications;
}
