import { AppDomainsView } from "@/components/web/app-domains-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-017 — Domains attached to resource (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function AppDomainsPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppDomainsView appId={app} />;
}
