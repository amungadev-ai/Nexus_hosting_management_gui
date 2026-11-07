import { HttpsPolicyView } from "@/components/dns/https-policy-view";
import { db } from "@/lib/mock/data";

/** UX-DNS-013 — HTTPS policy (dns module; route lives under websites). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.websites.map((w) => ({ site: w.id }));
}

export default async function HttpsPolicyPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <HttpsPolicyView siteId={site} />;
}
