import { WebsiteSettingsView } from "@/components/web/website-settings-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-004 — Website configuration (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.websites.map((w) => ({ site: w.id }));
}

export default async function WebsiteSettingsPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <WebsiteSettingsView siteId={site} />;
}
