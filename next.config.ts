import type { NextConfig } from "next";

/**
 * NexusPanel GUI prototype.
 *
 * ARCHITECTURAL CONSTRAINT (DEC-001 / Stage 4 ADR-002b): the real panel is a
 * static SPA served by Nginx/Caddy — no Node runtime on the server. This
 * prototype therefore uses Next.js ONLY as a static-site exporter
 * (`output: "export"`). No SSR, no server actions, no API routes, no ISR.
 * The build output in `out/` is plain static files.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
