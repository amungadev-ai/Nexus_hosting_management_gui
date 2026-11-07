import { db } from "@/lib/mock/data";
import { IncidentDetail } from "@/components/ops/incidents-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return db.incidents.map((i) => ({ incident: i.id }));
}

export default async function Page({ params }: { params: Promise<{ incident: string }> }) {
  const { incident } = await params;
  return <IncidentDetail incidentId={incident} />;
}
