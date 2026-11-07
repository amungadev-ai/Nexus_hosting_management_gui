import { db } from "@/lib/mock/data";
import { CgroupsView } from "@/components/infrastructure/server-views";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ server: db.server.id }];
}

export default async function ServerCgroupsPage({ params }: { params: Promise<{ server: string }> }) {
  const { server } = await params;
  return <CgroupsView serverId={server} />;
}
