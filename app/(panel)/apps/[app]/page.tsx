import { AppDetailView } from "@/components/web/app-detail-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-009 — Application overview (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function ApplicationPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppDetailView appId={app} />;
}
