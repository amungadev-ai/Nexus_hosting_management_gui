"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DatabaseDetailView, DatabaseUsersView, DatabaseAdminView, DatabaseTransfersView, DatabaseBackupsView, DatabaseServiceView } from "@/components/databases/views";

function DatabaseManager() {
  const params = useSearchParams();
  const id = params.get("db") ?? "";
  const tab = params.get("tab") ?? "";
  if (!id) return <main className="p-6"><p>Select a database from the <Link className="text-accent underline" href="/databases">database list</Link>.</p></main>;
  switch (tab) {
    case "users": return <DatabaseUsersView dbId={id} />;
    case "admin": return <DatabaseAdminView dbId={id} />;
    case "transfers": return <DatabaseTransfersView dbId={id} />;
    case "backups": return <DatabaseBackupsView dbId={id} />;
    case "service": return <DatabaseServiceView dbId={id} />;
    default: return <DatabaseDetailView dbId={id} />;
  }
}

/** Static-export-safe route: the database ID is selected on the client. */
export default function DatabaseManagePage() {
  return <Suspense fallback={<main className="p-6 text-ink-2">Loading database…</main>}><DatabaseManager /></Suspense>;
}
