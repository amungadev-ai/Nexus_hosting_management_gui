import { ZoneGateView } from "@/components/dns/zone-gate-view";
import { dnsZones } from "@/lib/mock/dns";

/** UX-DNS-007 — DNS zone change review (v2 gate, static export). */
export const dynamicParams = false;

export function generateStaticParams() {
  return dnsZones().map((z) => ({ zone: z.zone }));
}

export default async function ZoneReviewPage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  return <ZoneGateView zone={zone} variant="review" />;
}
