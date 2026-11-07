"use client";

import Link from "next/link";
import { useState } from "react";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { useCapability } from "@/components/providers";
import { mailDomains, mailboxes, mailAliases, mailQueue, smtpConfig, deliverabilityRecords } from "@/lib/mock/mail";

const tools = [
  { label: "Sending & SMTP", detail: "Configure a relay and send a test message", href: "/email/external-smtp", category: "Send" },
  { label: "Email domains", detail: "Sending domains, MX and domain health", href: "/email/domains", category: "Domains" },
  { label: "Deliverability", detail: "SPF, DKIM, DMARC and PTR guidance", href: "/email/deliverability", category: "Domains" },
  { label: "Mailboxes", detail: "Create accounts, manage quota and passwords", href: "/email/mailboxes", category: "Receive" },
  { label: "Aliases & forwarders", detail: "Forward addresses and catch-all policies", href: "/email/aliases", category: "Receive" },
  { label: "Mailing lists", detail: "List membership and moderation", href: "/email/lists", category: "Receive" },
  { label: "Webmail", detail: "Launch mailbox access safely", href: "/email/webmail", category: "Receive" },
  { label: "Mail queue & logs", detail: "Deferred, bounced and retried messages", href: "/email/queue", category: "Troubleshoot" },
  { label: "Mailbox provider guidance", detail: "Choose an external mailbox provider", href: "/email/recommendation", category: "Receive" },
];

export default function EmailWorkspace() {
  const [filter, setFilter] = useState("All");
  const relay = useCapability("mail.external_smtp");
  const hosted = useCapability("mail.mailboxes");
  const alerts = deliverabilityRecords.filter((r) => r.status !== "verified").length;
  const cards = [
    { value: mailDomains.length, title: "Email domains", description: "Configured in demo", href: "/email/domains" },
    { value: smtpConfig.enabled ? "Configured" : "Not set", title: "SMTP relay", description: "Fixture configuration", href: "/email/external-smtp" },
    { value: mailboxes.length, title: "Mailboxes", description: hosted.state === "unavailable" ? "Unavailable on this profile" : "Demo fixtures · v2+", href: "/email/mailboxes" },
    { value: alerts, title: "DNS checks to review", description: "Illustrative record states", href: "/email/deliverability" },
  ];
  return <Screen id="UX-MAIL-013" breadcrumbs={[{label:"Overview",href:"/overview"},{label:"Email workspace"}]} description="Send, receive and troubleshoot email without mixing up outbound SMTP and mailbox hosting.">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl"><span className="text-xs font-bold uppercase tracking-widest text-accent">Email workspace</span><h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">What would you like to do with email?</h2><p className="mt-2 text-sm text-ink-2">Set up reliable outbound messages, connect a mailbox provider or manage self-hosted email when your server supports it.</p></div>
          <ButtonLink href="/email/setup" icon="plus">Guided email setup</ButtonLink>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[{title:"Send email from my website",text:"SMTP relay for apps, contact forms and notifications",href:"/email/setup?goal=send"},{title:"Use email at my domain",text:"External provider now; self-hosted mail when supported",href:"/email/setup?goal=receive"},{title:"Fix an email problem",text:"DNS authentication, rejected messages and delivery logs",href:"/email/setup?goal=diagnose"}].map(x=><Link key={x.href} href={x.href} className="rounded-xl border border-line bg-surface-2 p-4 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"><strong className="text-sm text-ink">{x.title} →</strong><p className="mt-1 text-xs text-ink-2">{x.text}</p></Link>)}
        </div>
      </div>
      <Callout tone="info" title="Prototype data · distinct hosting capabilities">Outbound SMTP is a v1 service on supported profiles. Self-hosted mailboxes, webmail, aliases and lists are v2+ features requiring additional capability. This interface never implies a message was delivered or a DNS record was verified by a real server.</Callout>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c=><Link key={c.title} href={c.href} className="rounded-xl border border-line bg-surface p-4 hover:border-accent"><p className="text-xs text-ink-2">{c.title}</p><p className="mt-2 text-2xl font-bold text-ink">{c.value}</p><p className="mt-1 text-xs text-ink-3">{c.description}</p></Link>)}</div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Email tools" description="Dedicated management tools remain separate, organized by what you need to accomplish.">
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter email tools">{["All","Send","Receive","Domains","Troubleshoot"].map(f=><button key={f} type="button" onClick={()=>setFilter(f)} aria-pressed={filter===f} className={`rounded-lg border px-3 py-1.5 text-xs ${filter===f?"border-accent bg-accent-soft font-semibold text-accent":"border-line text-ink-2 hover:bg-surface-2"}`}>{f}</button>)}</div>
          <div className="mt-3 divide-y divide-line">{tools.filter(t=>filter==="All"||t.category===filter).map(t=><Link key={t.href} href={t.href} className="flex items-center justify-between gap-3 py-3 hover:text-accent"><span><strong className="block text-sm">{t.label}</strong><span className="block text-xs text-ink-2">{t.detail}</span></span><span aria-hidden="true">→</span></Link>)}</div>
        </Card>
        <div className="space-y-4">
          <Card title="Capability & release readiness" description="Availability is determined by the host, not your persona label."><div className="mt-3 space-y-3 text-sm"><div className="flex justify-between gap-2"><span>External SMTP</span><strong className={relay.state==="unavailable"?"text-ink-3":"text-accent"}>{relay.state==="unavailable"?"Unavailable":"Supported profile"}</strong></div><div className="flex justify-between gap-2"><span>Self-hosted mail</span><strong className={hosted.state==="unavailable"?"text-ink-3":"text-accent"}>{hosted.state==="unavailable"?"Unavailable":"Capability present · v2+"}</strong></div></div><p className="mt-4 text-xs text-ink-3">Production access will also require role authorization and release enablement.</p></Card>
          <Card title="Troubleshooting shortcuts"><div className="mt-2 space-y-3 text-sm"><Link href="/email/deliverability" className="block text-accent hover:underline">Check SPF, DKIM and DMARC →</Link><Link href="/email/queue" className="block text-accent hover:underline">Inspect {mailQueue.length} sample queue events →</Link><Link href="/email/aliases" className="block text-accent hover:underline">Review {mailAliases.length} aliases and forwarders →</Link></div></Card>
        </div>
      </div>
    </div>
  </Screen>;
}
