import { db } from "@/lib/mock/data";
import DeployWizardView from "@/components/templates/deploy-wizard-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return db.templates.map((t) => ({ id: t.key }));
}

export default async function TemplateDeployPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeployWizardView templateKey={id} />;
}
