import { DomainGuidanceView } from "@/components/dns/domain-guidance-view";
import { db } from "@/lib/mock/data";

/** UX-DNS-014 — DNS guidance, the v1 DNS mode (param route, static export). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.domains.map((d) => ({ domain: d.id }));
}

export default async function DomainGuidancePage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return <DomainGuidanceView domainId={domain} />;
}
