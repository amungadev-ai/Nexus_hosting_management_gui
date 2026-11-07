import { hostingPackages } from "@/lib/mock/commercial";
import { PackageEditorView } from "@/components/commercial/package-editor-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return hostingPackages.map((p) => ({ package: p.id }));
}

export default async function PackagePage({ params }: { params: Promise<{ package: string }> }) {
  const { package: pkg } = await params;
  return <PackageEditorView packageId={pkg} />;
}
