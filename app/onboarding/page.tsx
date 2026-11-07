"use client";

import Link from "next/link";
import { RouterIntro } from "@/app/page";
import { BareLayout } from "@/components/iam/bare-layout";
import { Card } from "@/components/ui/card";
import { Stepper } from "@/components/ui/nav";
import { Icon } from "@/components/ui/icons";

/**
 * UX-IAM-003 — First-run router (bare screen). FLOW-013 entry: the six-card
 * "What do you want to run?" router, reused verbatim from the landing
 * (app/page.tsx exports RouterIntro), framed by the three-step onboarding
 * stepper. The router is context-free — it appears before any organization
 * context exists — so this screen is deliberately outside the panel shell.
 */
export default function OnboardingPage() {
  return (
    <BareLayout screenId="UX-IAM-003" width="wide">
      <div className="flex flex-col gap-5">
        <Stepper
          steps={["1. What do you want to run", "2. Connect your domain", "3. You're live"]}
          current={0}
        />

        <RouterIntro />

        <Card className="border-dashed">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-2">
              <Icon name="info" size={14} className="mr-1.5 inline text-info" />
              The router appears before any organization context exists — there is nothing to
              scope to yet. After your first path completes you land on the service portfolio
              with a short follow-up checklist (first site live, connect a domain, enable
              backups, invite a collaborator).
            </p>
            <p className="text-sm">
              <Link href="/overview" className="font-medium text-accent hover:underline">
                Skip — show me the portfolio
                <Icon name="arrow-right" size={13} className="ml-1 inline" />
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </BareLayout>
  );
}
