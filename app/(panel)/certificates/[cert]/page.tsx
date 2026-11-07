import { CertificateDetailView } from "@/components/dns/certificate-detail-view";
import { allCertificates } from "@/lib/mock/dns";

/** UX-DNS-012 — Certificate detail (param route, static export). */
export const dynamicParams = false;

export function generateStaticParams() {
  return allCertificates().map((c) => ({ cert: c.id }));
}

export default async function CertificateDetailPage({ params }: { params: Promise<{ cert: string }> }) {
  const { cert } = await params;
  return <CertificateDetailView certId={cert} />;
}
