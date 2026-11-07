import { allServiceInstances, templateForKey } from "@/lib/mock/services";
import StorageDetailView from "@/components/services/storage-detail-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return allServiceInstances()
    .filter((i) => templateForKey(i.template_key)?.category === "storage")
    .map((i) => ({ id: i.id }));
}

export default async function StorageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StorageDetailView bucketId={id} />;
}
