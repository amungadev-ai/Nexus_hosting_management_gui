import { AppEnvView } from "@/components/web/app-env-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-012 — Environment variables (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function AppEnvironmentPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppEnvView appId={app} />;
}
