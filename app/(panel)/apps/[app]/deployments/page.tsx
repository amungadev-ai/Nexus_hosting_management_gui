import { AppDeploymentsView } from "@/components/web/app-deployments-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-010 — Deployment history (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function AppDeploymentsPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppDeploymentsView appId={app} />;
}
