"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { JobDetailView } from "@/components/overview/job-detail-view";

function JobViewer() {
  const params = useSearchParams();
  const op = params.get("op") ?? "";
  if (!op)
    return (
      <main className="p-6">
        <p>
          Open a job from the{" "}
          <Link className="text-accent underline" href="/activity">
            activity stream
          </Link>
          .
        </p>
      </main>
    );
  return <JobDetailView jobId={op} />;
}

/** Static-export-safe route: runtime-created operation IDs cannot be dynamic
 * export paths, so the job is selected on the client (same pattern as
 * /databases/manage). */
export default function JobDetailPage() {
  return (
    <Suspense fallback={<main className="p-6 text-ink-2">Loading job…</main>}>
      <JobViewer />
    </Suspense>
  );
}
