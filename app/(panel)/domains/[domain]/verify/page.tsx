import { DomainVerifyView } from "@/components/dns/domain-verify-view";
import { db } from "@/lib/mock/data";

/** UX-DNS-004 — Ownership verification (param route, static export). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.domains.map((d) => ({ domain: d.id }));
}

export default async function DomainVerifyPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return <DomainVerifyView domainId={domain} />;
}
