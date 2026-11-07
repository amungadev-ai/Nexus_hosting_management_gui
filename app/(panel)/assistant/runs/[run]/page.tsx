import { RunView } from "@/components/ai/run-view";
import { aiRuns } from "@/lib/mock/ai";

export const dynamicParams = false;

export function generateStaticParams() {
  return aiRuns.map((r) => ({ run: r.id }));
}

export default async function Page({ params }: { params: Promise<{ run: string }> }) {
  const { run } = await params;
  return <RunView runId={run} />;
}
