import { databases } from "@/lib/mock/databases";
import { DatabaseTransfersView } from "@/components/databases/views";

export const dynamicParams = false;

export function generateStaticParams() {
  return databases.map((d) => ({ db: d.id }));
}

export default async function DatabaseTransfersPage({ params }: { params: Promise<{ db: string }> }) {
  const { db } = await params;
  return <DatabaseTransfersView dbId={db} />;
}
