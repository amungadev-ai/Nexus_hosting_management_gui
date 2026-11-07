import { hostingAccounts } from "@/lib/mock/commercial";
import { AccountDetailView } from "@/components/commercial/account-detail-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return hostingAccounts.map((a) => ({ account: a.id }));
}

export default async function AccountPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  return <AccountDetailView accountId={account} />;
}
