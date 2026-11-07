"use client";

import React, { Suspense } from "react";
import { Screen } from "@/components/common/screen";
import { SkeletonTable } from "@/components/ui/feedback";
import { CodeEditorView } from "@/components/files/code-editor-view";

/** UX-FILE-003 route — /files/edit?path=…&site=… (deep-linkable editor). */
export default function FileEditPage() {
  return (
    <Screen id="UX-FILE-003" breadcrumbs={[{ label: "Files", href: "/files" }, { label: "Code editor" }]}>
      <Suspense fallback={<SkeletonTable rows={6} cols={2} />}>
        <CodeEditorView />
      </Suspense>
    </Screen>
  );
}
