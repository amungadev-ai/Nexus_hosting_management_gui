import { db } from "@/lib/mock/data";
import { allServiceInstances } from "@/lib/mock/services";
import ServiceDetailView from "@/components/templates/service-detail-view";

export const dynamicParams = false;

export function generateStaticParams() {
  const instanceIds = allServiceInstances().map((i) => ({ id: i.id }));
  const templateKeys = db.templates.map((t) => ({ id: t.key }));
  return [...instanceIds, ...templateKeys];
}

export default async function SelfHostedServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceDetailView instanceId={id} />;
}
