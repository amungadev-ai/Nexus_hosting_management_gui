import { WebsiteDetailView } from "@/components/web/website-detail-view";
import { db } from "@/lib/mock/data";

/**
 * UX-WEB-003 — Website overview (param route). Static export: the params are
 * generated from the shared website fixtures only.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.websites.map((w) => ({ site: w.id }));
}

export default async function WebsitePage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <WebsiteDetailView siteId={site} />;
}
