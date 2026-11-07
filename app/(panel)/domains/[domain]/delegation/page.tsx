import { DomainDelegationView } from "@/components/dns/domain-delegation-view";
import { db } from "@/lib/mock/data";

/** UX-DNS-005 — Delegation checklist (param route, static export). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.domains.map((d) => ({ domain: d.id }));
}

export default async function DomainDelegationPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return <DomainDelegationView domainId={domain} />;
}
