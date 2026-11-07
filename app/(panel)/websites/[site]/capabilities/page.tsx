import { WebsiteCapabilitiesView } from "@/components/web/website-capabilities-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-019 — Website capability strip (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.websites.map((w) => ({ site: w.id }));
}

export default async function WebsiteCapabilitiesPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <WebsiteCapabilitiesView siteId={site} />;
}
