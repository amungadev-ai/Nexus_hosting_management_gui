import { allServiceInstances, templateForKey } from "@/lib/mock/services";
import StorageKeysView from "@/components/services/storage-keys-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return allServiceInstances()
    .filter((i) => templateForKey(i.template_key)?.category === "storage")
    .map((i) => ({ id: i.id }));
}

export default async function StorageKeysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StorageKeysView bucketId={id} />;
}
