import { databases } from "@/lib/mock/databases";
import { DatabaseBackupsView } from "@/components/databases/views";

export const dynamicParams = false;

export function generateStaticParams() {
  return databases.map((d) => ({ db: d.id }));
}

export default async function DatabaseBackupsPage({ params }: { params: Promise<{ db: string }> }) {
  const { db } = await params;
  return <DatabaseBackupsView dbId={db} />;
}
