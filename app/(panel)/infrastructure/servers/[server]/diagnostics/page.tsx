import { db } from "@/lib/mock/data";
import { DiagnosticsView } from "@/components/infrastructure/server-views";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ server: db.server.id }];
}

export default async function ServerDiagnosticsPage({ params }: { params: Promise<{ server: string }> }) {
  const { server } = await params;
  return <DiagnosticsView serverId={server} />;
}
