import { AppRuntimeView } from "@/components/web/app-runtime-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-013 — Runtime configuration (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function AppRuntimePage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppRuntimeView appId={app} />;
}
