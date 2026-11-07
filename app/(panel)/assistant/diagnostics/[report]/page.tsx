import { ReportView } from "@/components/ai/report-view";
import { diagnosticReports } from "@/lib/mock/ai";

export const dynamicParams = false;

export function generateStaticParams() {
  return diagnosticReports.map((r) => ({ report: r.id }));
}

export default async function Page({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  return <ReportView reportId={report} />;
}
