"use client";

/**
 * Deterministic mock QR block for the MFA setup step (UX-IAM-002).
 * The real product renders the server-issued otpauth:// URI; in the
 * prototype we draw a stable pseudo-QR (finder patterns + seeded module
 * grid) — deterministic per seed so server and client renders match and
 * no hydration mismatch can occur.
 */

export function QrBlock({
  seed,
  className,
  label = "Mock QR code — the real product encodes the server-issued authenticator URI",
}: {
  seed: string;
  className?: string;
  label?: string;
}) {
  const n = 21;
  const rects: React.ReactElement[] = [];

  const insideFinder = (i: number, j: number): { di: number; dj: number } | null => {
    const origins: [number, number][] = [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ];
    for (const [fr, fc] of origins) {
      if (i >= fr - 1 && i <= fr + 7 && j >= fc - 1 && j <= fc + 7) {
        const di = i - fr;
        const dj = j - fc;
        if (di >= 0 && di <= 6 && dj >= 0 && dj <= 6) return { di, dj };
        return { di: -1, dj: -1 }; // separator ring — always light
      }
    }
    return null;
  };

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const f = insideFinder(i, j);
      let dark: boolean;
      if (f !== null) {
        dark =
          f.di >= 0 &&
          (f.di === 0 || f.di === 6 || f.dj === 0 || f.dj === 6 || (f.di >= 2 && f.di <= 4 && f.dj >= 2 && f.dj <= 4));
      } else {
        dark = cellBit(seed, i, j);
      }
      if (dark) {
        rects.push(<rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} />);
      }
    }
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={n} height={n} className="fill-surface" />
      <g className="fill-ink">{rects}</g>
    </svg>
  );
}

/** FNV-1a-based stable bit per module — pure, so SSR and CSR agree. */
function cellBit(seed: string, i: number, j: number): boolean {
  let h = 2166136261;
  for (let k = 0; k < seed.length; k++) {
    h ^= seed.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (i * 131 + j * 17 + 1), 2654435761);
  h ^= h >>> 15;
  return ((h >>> 0) % 100) < 45;
}
