import { databases } from "@/lib/mock/databases";
import { DatabaseServiceView } from "@/components/databases/views";

export const dynamicParams = false;

export function generateStaticParams() {
  return databases.map((d) => ({ db: d.id }));
}

export default async function DatabaseServicePage({ params }: { params: Promise<{ db: string }> }) {
  const { db } = await params;
  return <DatabaseServiceView dbId={db} />;
}
