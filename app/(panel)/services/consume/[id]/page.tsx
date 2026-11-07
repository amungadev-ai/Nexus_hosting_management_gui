import { allServiceInstances, templateForKey } from "@/lib/mock/services";
import ConsumeView from "@/components/services/consume-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return allServiceInstances()
    .filter((i) => templateForKey(i.template_key)?.category === "storage")
    .map((i) => ({ id: i.id }));
}

export default async function ConsumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsumeView bucketId={id} />;
}
