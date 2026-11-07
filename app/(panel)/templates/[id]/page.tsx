import { db } from "@/lib/mock/data";
import TemplateDetailView from "@/components/templates/template-detail-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return db.templates.map((t) => ({ id: t.key }));
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateDetailView templateKey={id} />;
}
