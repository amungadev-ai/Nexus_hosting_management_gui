import { migrations } from "@/lib/mock/support";
import { MigrationConflictsView } from "@/components/support/conflicts-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return migrations.map((m) => ({ id: m.id }));
}

export default async function MigrationConflictsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MigrationConflictsView migrationId={id} />;
}
