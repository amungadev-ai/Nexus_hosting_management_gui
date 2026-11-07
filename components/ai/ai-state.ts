"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side AI settings for the prototype (the real product keeps these
 * server-side, PATCH /settings/ai). Persisted in localStorage exactly like
 * the session preferences in providers.tsx (whose private hook is not
 * importable). The demo API key never leaves this browser and is never
 * logged; UX-AI-005's SecretField enforces the one-time reveal on top.
 */

interface AiSettingsState {
  ready: boolean;
  key: string | null; // demo key; null = not configured (UX-AI-007)
  optOut: boolean; // "Disable AI" consent flag
  hasRun: boolean; // has an analysis run happened yet (UX-AI-006 first-run)
  providerId: string;
  modelId: string;
  retention: string;
}

export interface AiSettings {
  ready: boolean;
  keyConfigured: boolean;
  key: string | null;
  optOut: boolean;
  hasRun: boolean;
  providerId: string;
  modelId: string;
  retention: string;
  saveKey: (key: string) => void;
  removeKey: () => void;
  setOptOut: (v: boolean) => void;
  markRun: () => void;
  setProvider: (id: string) => void;
  setModel: (id: string) => void;
  setRetention: (v: string) => void;
}

const KEYS = {
  key: "nx.ai.key",
  optOut: "nx.ai.optOut",
  hasRun: "nx.ai.hasRun",
  provider: "nx.ai.provider",
  model: "nx.ai.model",
  retention: "nx.ai.retention",
} as const;

function read<T>(storageKey: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(storageKey: string, value: unknown): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* prototype: storage may be unavailable — the session keeps the value */
  }
}

const DEFAULTS: AiSettingsState = {
  ready: false,
  key: null,
  optOut: false,
  hasRun: false,
  providerId: "openai",
  modelId: "gpt-5-mini",
  retention: "30d",
};

export function useAiSettings(): AiSettings {
  const [state, setState] = useState<AiSettingsState>(DEFAULTS);

  // Resolved after mount so the static prerender and the client agree.
  useEffect(() => {
    setState({
      ready: true,
      key: read<string | null>(KEYS.key, null),
      optOut: read(KEYS.optOut, false),
      hasRun: read(KEYS.hasRun, false),
      providerId: read(KEYS.provider, DEFAULTS.providerId),
      modelId: read(KEYS.model, DEFAULTS.modelId),
      retention: read(KEYS.retention, DEFAULTS.retention),
    });
  }, []);

  const saveKey = useCallback((key: string) => {
    write(KEYS.key, key);
    setState((s) => ({ ...s, key }));
  }, []);

  const removeKey = useCallback(() => {
    write(KEYS.key, null);
    setState((s) => ({ ...s, key: null }));
  }, []);

  const setOptOut = useCallback((v: boolean) => {
    write(KEYS.optOut, v);
    setState((s) => ({ ...s, optOut: v }));
  }, []);

  const markRun = useCallback(() => {
    write(KEYS.hasRun, true);
    setState((s) => (s.hasRun ? s : { ...s, hasRun: true }));
  }, []);

  const setProvider = useCallback((id: string) => {
    write(KEYS.provider, id);
    setState((s) => ({ ...s, providerId: id }));
  }, []);

  const setModel = useCallback((id: string) => {
    write(KEYS.model, id);
    setState((s) => ({ ...s, modelId: id }));
  }, []);

  const setRetention = useCallback((v: string) => {
    write(KEYS.retention, v);
    setState((s) => ({ ...s, retention: v }));
  }, []);

  return {
    ready: state.ready,
    key: state.key,
    keyConfigured: state.key !== null && state.key !== "",
    optOut: state.optOut,
    hasRun: state.hasRun,
    providerId: state.providerId,
    modelId: state.modelId,
    retention: state.retention,
    saveKey,
    removeKey,
    setOptOut,
    markRun,
    setProvider,
    setModel,
    setRetention,
  };
}
