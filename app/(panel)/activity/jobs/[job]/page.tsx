import { db } from "@/lib/mock/data";
import { JobDetailView } from "@/components/overview/job-detail-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return db.operations.map((op) => ({ job: op.id }));
}

export default async function JobDetailPage({ params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  return <JobDetailView jobId={job} />;
}
