import { AppLogsView } from "@/components/web/app-logs-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-016 — Application logs (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function AppLogsPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppLogsView appId={app} />;
}
