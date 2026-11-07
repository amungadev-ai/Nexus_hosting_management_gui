import { allServiceInstances, templateForKey } from "@/lib/mock/services";
import TransformView from "@/components/services/transform-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return allServiceInstances()
    .filter((i) => templateForKey(i.template_key)?.category === "transform")
    .map((i) => ({ id: i.id }));
}

export default async function TransformPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransformView instanceId={id} />;
}
