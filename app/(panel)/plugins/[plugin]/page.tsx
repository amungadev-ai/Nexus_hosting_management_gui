import { pluginCatalog } from "@/lib/mock/automation";
import { PluginDetailView } from "@/components/automation/plugin-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return pluginCatalog.map((p) => ({ plugin: p.id }));
}

export default async function Page({ params }: { params: Promise<{ plugin: string }> }) {
  const { plugin } = await params;
  return <PluginDetailView pluginId={plugin} />;
}
