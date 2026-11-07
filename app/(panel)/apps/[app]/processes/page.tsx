import { AppProcessesView } from "@/components/web/app-processes-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-014 — Processes and workers (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function AppProcessesPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppProcessesView appId={app} />;
}
