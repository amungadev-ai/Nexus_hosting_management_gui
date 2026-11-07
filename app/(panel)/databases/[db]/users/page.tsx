import { databases } from "@/lib/mock/databases";
import { DatabaseUsersView } from "@/components/databases/views";

export const dynamicParams = false;

export function generateStaticParams() {
  return databases.map((d) => ({ db: d.id }));
}

export default async function DatabaseUsersPage({ params }: { params: Promise<{ db: string }> }) {
  const { db } = await params;
  return <DatabaseUsersView dbId={db} />;
}
