import { WebsiteRedirectsView } from "@/components/web/website-redirects-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-006 — Redirects and aliases (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.websites.map((w) => ({ site: w.id }));
}

export default async function WebsiteRedirectsPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <WebsiteRedirectsView siteId={site} />;
}
