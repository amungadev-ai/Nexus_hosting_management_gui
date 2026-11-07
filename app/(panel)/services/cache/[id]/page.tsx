import { allServiceInstances, templateForKey } from "@/lib/mock/services";
import CacheView from "@/components/services/cache-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return allServiceInstances()
    .filter((i) => templateForKey(i.template_key)?.category === "cache")
    .map((i) => ({ id: i.id }));
}

export default async function CachePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CacheView instanceId={id} />;
}
