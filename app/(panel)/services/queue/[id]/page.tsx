import { EmptyFamilyView } from "@/components/services/empty-family-view";

export const dynamicParams = false;

// No queue template exists in the v1 catalog — the honest empty state is the
// only content. `output: export` still requires one static param per dynamic
// route, so it is generated once for this reserved id (the view ignores it).
export function generateStaticParams() {
  return [{ id: "unavailable" }];
}

export default async function QueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EmptyFamilyView
      id="UX-SVC-008"
      title="Queue"
      what={`queue instance “${id}”`}
      copy="Queue instances (RabbitMQ-style) are planned for a later catalog drop. Workflow automation is available today as the n8n template — it covers most job-queue needs on a single VPS."
    />
  );
}
