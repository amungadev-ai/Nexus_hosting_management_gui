import { db } from "@/lib/mock/data";
import { ServerDetailView } from "@/components/infrastructure/server-views";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ server: db.server.id }];
}

export default async function ServerDetailPage({ params }: { params: Promise<{ server: string }> }) {
  const { server } = await params;
  return <ServerDetailView serverId={server} />;
}
