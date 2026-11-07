import { mailboxes } from "@/lib/mock/mail";
import { MailboxDetailView } from "@/components/mail/mailbox-detail-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return mailboxes.map((m) => ({ box: m.id }));
}

export default async function MailboxPage({ params }: { params: Promise<{ box: string }> }) {
  const { box } = await params;
  return <MailboxDetailView mailboxId={box} />;
}
