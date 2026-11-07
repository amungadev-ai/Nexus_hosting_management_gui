import { WebsiteStagingView } from "@/components/web/website-staging-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-005 — Staging environments (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.websites.map((w) => ({ site: w.id }));
}

export default async function WebsiteStagingPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <WebsiteStagingView siteId={site} />;
}
