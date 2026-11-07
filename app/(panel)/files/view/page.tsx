"use client";

import React, { Suspense } from "react";
import { Screen } from "@/components/common/screen";
import { SkeletonTable } from "@/components/ui/feedback";
import { FileDetailView } from "@/components/files/file-detail-view";

/** UX-FILE-002 route — /files/view?path=…&site=… (deep-linkable file detail). */
export default function FileViewPage() {
  return (
    <Screen id="UX-FILE-002" breadcrumbs={[{ label: "Files", href: "/files" }, { label: "File detail" }]}>
      <Suspense fallback={<SkeletonTable rows={4} cols={2} />}>
        <FileDetailView />
      </Suspense>
    </Screen>
  );
}
