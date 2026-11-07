import { PlanView } from "@/components/ai/plan-view";
import { aiPlans } from "@/lib/mock/ai";

export const dynamicParams = false;

export function generateStaticParams() {
  return aiPlans.map((p) => ({ plan: p.id }));
}

export default async function Page({ params }: { params: Promise<{ plan: string }> }) {
  const { plan } = await params;
  return <PlanView planId={plan} />;
}
