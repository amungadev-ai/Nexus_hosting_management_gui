import { WebsiteBatchView } from "@/components/web/website-batch-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-020 — Batch jobs for site (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.websites.map((w) => ({ site: w.id }));
}

export default async function WebsiteBatchPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <WebsiteBatchView siteId={site} />;
}
