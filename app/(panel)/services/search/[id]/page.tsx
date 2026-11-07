import { allServiceInstances, templateForKey } from "@/lib/mock/services";
import SearchView from "@/components/services/search-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return allServiceInstances()
    .filter((i) => templateForKey(i.template_key)?.category === "search")
    .map((i) => ({ id: i.id }));
}

export default async function SearchInstancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SearchView instanceId={id} />;
}
