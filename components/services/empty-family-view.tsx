"use client";

import React from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";

/**
 * UX-SVC-006 / UX-SVC-008 — Delivery configuration and Queue instance.
 * No delivery/queue instances ship in the demo dataset (no such template
 * exists yet), so these detail routes render the honest explanatory state:
 * the surface exists, the instance doesn't.
 */
export function EmptyFamilyView({ id, title, what, copy }: { id: string; title: string; what: string; copy: string }) {
  return (
    <Screen id={id} breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: title }]}>
      <div className="flex flex-col gap-4">
        <NotFoundInline what={what} />
        <Callout tone="info" title={`No ${title.toLowerCase()} installed`}>
          {copy}
        </Callout>
        <div className="flex gap-2">
          <ButtonLink href="/services" variant="secondary">
            Back to Platform services
          </ButtonLink>
          <ButtonLink href="/templates" variant="ghost">
            Browse templates
          </ButtonLink>
        </div>
      </div>
    </Screen>
  );
}
