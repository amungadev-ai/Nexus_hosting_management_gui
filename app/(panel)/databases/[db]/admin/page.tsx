import { databases } from "@/lib/mock/databases";
import { DatabaseAdminView } from "@/components/databases/views";

export const dynamicParams = false;

export function generateStaticParams() {
  return databases.map((d) => ({ db: d.id }));
}

export default async function DatabaseAdminPage({ params }: { params: Promise<{ db: string }> }) {
  const { db } = await params;
  return <DatabaseAdminView dbId={db} />;
}
