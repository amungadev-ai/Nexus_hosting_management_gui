import { AppDeploymentDetailView } from "@/components/web/app-deployment-detail-view";
import { webDeployments } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/** UX-WEB-011 — Deployment detail (param route). */
export const dynamicParams = false;

// With two dynamic segments the leaf's generateStaticParams runs without
// parent context under `output: export`, so it must enumerate full
// {app, deploy} pairs itself; filtering by params.app yields [] and fails the build.
export function generateStaticParams() {
  return webDeployments.map((d) => ({ app: d.app_id, deploy: d.id }));
}

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ app: string; deploy: string }>;
}) {
  const { deploy } = await params;
  return <AppDeploymentDetailView deployId={deploy} />;
}
