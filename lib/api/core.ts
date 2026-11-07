import type { Page, Problem } from "@/lib/types";

/**
 * Mock API core — mirrors the Stage 6 contract so screens are written
 * against real shapes. When the Go control plane exists, each lib/api/*
 * module swaps its internals for fetch("/api/v1/…") calls; nothing else
 * in the app changes.
 */

export function requestId(): string {
  return `req_01J${rand(10)}`;
}

export function rand(n: number): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function newId(prefix: string): string {
  return `${prefix}_01J${rand(10)}`;
}

export function problem(
  status: number,
  code: string,
  title: string,
  detail: string,
  extra?: Partial<Problem>
): Problem {
  return {
    type: `https://docs.nexuspanel.example/problems/${code.toLowerCase().replace(/_/g, "-")}`,
    title,
    status,
    code,
    detail,
    request_id: requestId(),
    ...extra,
  };
}

export class ApiError extends Error {
  readonly problem: Problem;
  constructor(p: Problem) {
    super(p.detail);
    this.name = "ApiError";
    this.problem = p;
  }
}

/** Throw-first error helper: `failWith(problem(409, …))` — never returns. */
export function failWith(p: Problem): never {
  throw new ApiError(p);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulate network latency around a synchronous fixture computation. */
export async function withLatency<T>(produce: () => T, ms?: number): Promise<T> {
  await sleep(ms ?? 160 + Math.floor(Math.random() * 280));
  return produce();
}

/** Single-resource envelope. */
export function ok<T>(data: T): { data: T; meta: { request_id: string } } {
  return { data, meta: { request_id: requestId() } };
}

/** Cursor-pagination list envelope (Stage 6 §1: page.next_cursor). */
export function paginated<T>(rows: T[], limit = 25, cursor?: string | null): Page<T> {
  const offset = cursor ? parseInt(Buffer.from(cursor, "base64").toString("utf8"), 10) || 0 : 0;
  const slice = rows.slice(offset, offset + limit);
  const next = offset + slice.length < rows.length ? offset + slice.length : null;
  return {
    data: slice,
    page: {
      next_cursor: next !== null ? Buffer.from(String(next)).toString("base64") : null,
      has_more: next !== null,
    },
    meta: { request_id: requestId() },
  };
}
