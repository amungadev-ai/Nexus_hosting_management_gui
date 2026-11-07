import { AppGitView } from "@/components/web/app-git-view";
import { db } from "@/lib/mock/data";

/** UX-WEB-015 — Git connections (param route). */
export const dynamicParams = false;

export function generateStaticParams() {
  return db.applications.map((a) => ({ app: a.id }));
}

export default async function AppGitPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  return <AppGitView appId={app} />;
}
