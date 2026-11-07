import { ZoneGateView } from "@/components/dns/zone-gate-view";
import { dnsZones } from "@/lib/mock/dns";

/**
 * UX-DNS-006 — DNS zone editor. v2 surface: the page exists so the route is
 * real, but renders the honest v2 gate (UX-DNS-015 state included).
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return dnsZones().map((z) => ({ zone: z.zone }));
}

export default async function ZoneEditorPage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  return <ZoneGateView zone={zone} variant="editor" />;
}
