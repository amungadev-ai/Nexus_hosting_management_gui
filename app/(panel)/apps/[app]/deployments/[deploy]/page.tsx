import { AppDeploymentDetailView } from "@/components/web/app-deployment-detail-view";
import { webDeployments } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/** UX-WEB-011 — Deployment detail (param route). */
export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { app: string } }) {
  return webDeployments.filter((d) => d.app_id === params.app).map((d) => ({ deploy: d.id }));
}

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ app: string; deploy: string }>;
}) {
  const { deploy } = await params;
  return <AppDeploymentDetailView deployId={deploy} />;
}
