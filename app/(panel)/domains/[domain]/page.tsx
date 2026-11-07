import { DomainDetailView } from "@/components/dns/domain-detail-view";
import { db } from "@/lib/mock/data";

/**
 * UX-DNS-003 — Domain detail (param route). Static export: params are
 * generated from the shared domain fixtures only.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.domains.map((d) => ({ domain: d.id }));
}

export default async function DomainDetailPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return <DomainDetailView domainId={domain} />;
}
