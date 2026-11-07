import { db } from "@/lib/mock/data";
import { OrganizationDetailView } from "@/components/iam/organization-detail-view";

/**
 * UX-IAM-006 — Organization detail. Server page for the param route:
 * static export pre-renders exactly the fixture organizations
 * (dynamicParams = false) and hands the id to the client view.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.organizations.map((o) => ({ org: o.id }));
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  return <OrganizationDetailView orgId={org} />;
}
