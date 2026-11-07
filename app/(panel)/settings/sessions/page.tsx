"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionDevice } from "@/lib/types";
import { isApiError, listSessions, revokeAllOtherSessions, revokeSession } from "@/lib/api/iam";
import { currentUser } from "@/lib/api/me";
import { formatDate, formatRelative } from "@/lib/format";
import { useNow, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { DataTable, TableCard } from "@/components/ui/table";
import { StepUpDialog } from "@/components/iam/step-up-dialog";

/**
 * UX-IAM-009 — Sessions and devices. Inventory with last-active freshness
 * (DS-025). Revoking one device is a targeted destructive action with an
 * exact-target confirm (DS-010); "Revoke all others" is high-risk: step-up
 * MFA (POST /me/step-up, bound to action + resource) plus a typed
 * confirmation. Revoking the CURRENT session signs you out.
 */
export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionDevice[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listSessions()
      .then((rows) => {
        if (alive) setSessions(rows);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen
      id="UX-IAM-009"
      breadcrumbs={[{ label: "Settings" }, { label: "Sessions" }]}
      actions={
        <RevokeAllOthersAction
          onRevoked={() => setSessions((prev) => (prev === null ? prev : prev.filter((s) => s.current)))}
          onError={setBulkError}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {loadFailed && <Callout tone="danger">GET /me/sessions failed — device metadata stays redacted either way.</Callout>}
        {bulkError !== null && <Callout tone="danger">{bulkError}</Callout>}
        {sessions === null && !loadFailed ? (
          <SkeletonTable rows={3} cols={6} />
        ) : sessions !== null ? (
          <SessionsTable sessions={sessions} setSessions={setSessions} />
        ) : null}
        <Callout tone="warning" title="Revoking your current session signs you out.">
          You will land on the sign-in screen and can start a fresh session — every other device
          keeps its independent session until revoked here. All revocations are audited.
        </Callout>
      </div>
    </Screen>
  );
}

function SessionsTable({
  sessions,
  setSessions,
}: {
  sessions: SessionDevice[];
  setSessions: React.Dispatch<React.SetStateAction<SessionDevice[] | null>>;
}) {
  const now = useNow();
  const router = useRouter();
  const { push } = useToast();
  const [revoking, setRevoking] = useState<SessionDevice | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current);

  const confirmRevoke = async () => {
    if (revoking === null) return;
    setError(null);
    try {
      await revokeSession(revoking.id);
      setSessions((prev) => (prev === null ? prev : prev.filter((s) => s.id !== revoking.id)));
      push("success", `Session revoked — ${revoking.device}`, `${revoking.browser} at ${revoking.location} is signed out immediately. The revocation was audited.`);
    } catch (e) {
      setError(isApiError(e) ? e.problem.detail : "Revoking the session failed.");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <>
      {error !== null && <Callout tone="danger">{error}</Callout>}
      <TableCard
        title="Active sessions"
        rowKey={(s) => s.id}
        rows={sessions}
        caption="Devices with an authenticated session on your account"
        emptyState={
          <div className="px-4 py-10 text-center text-sm text-ink-2">
            No sessions — sign in again from any device to create one.
          </div>
        }
        columns={[
          {
            key: "device",
            header: "Device",
            sortable: true,
            className: "sticky left-0 bg-surface",
            render: (s) => (
              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                {s.device}
                {s.current && <Chip tone="success">Current</Chip>}
              </span>
            ),
          },
          { key: "browser", header: "Browser" },
          { key: "location", header: "Location" },
          { key: "created_at", header: "Created", sortable: true, render: (s) => formatDate(s.created_at) },
          {
            key: "last_active_at",
            header: "Last active",
            render: (s) => (
              <span title={formatDate(s.last_active_at)}>{formatRelative(s.last_active_at, now)}</span>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (s) =>
              s.current ? (
                <Button variant="secondary" size="sm" onClick={() => setSigningOut(true)}>
                  Sign out
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setRevoking(s)}>
                  Revoke
                </Button>
              ),
          },
        ]}
      />
      <p className="text-xs text-ink-2">
        {others.length === 1
          ? "1 other device is signed in."
          : `${others.length} other devices are signed in.`}{" "}
        Device metadata is redacted in list responses (Stage 6 §2) — locations are city-level.
      </p>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
        title={revoking !== null ? `Revoke session — ${revoking.device}` : "Revoke session"}
        body={
          revoking !== null
            ? `${revoking.browser} at ${revoking.location} is signed out immediately. If that device is mid-task it will be returned to the sign-in screen.`
            : ""
        }
        confirmLabel="Revoke session"
        destructive
      />

      <ConfirmDialog
        open={signingOut}
        onClose={() => setSigningOut(false)}
        onConfirm={() => router.push("/auth/sign-in")}
        title="Sign out of this browser?"
        body="This ends your current session and returns you to the sign-in screen. Your other devices stay signed in."
        confirmLabel="Sign out"
        destructive
      />
    </>
  );
}

/** "Revoke all others": step-up MFA first, then the typed confirmation. */
function RevokeAllOthersAction({
  onRevoked,
  onError,
}: {
  onRevoked: (revokedCount: number) => void;
  onError: (message: string | null) => void;
}) {
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const { push } = useToast();

  const revokeAll = async () => {
    onError(null);
    setRunning(true);
    try {
      const n = await revokeAllOtherSessions();
      onRevoked(n);
      push("success", `Revoked ${n} other session${n === 1 ? "" : "s"}`, "Every other device was signed out; the bulk revocation is in the audit chain.");
    } catch (e) {
      onError(isApiError(e) ? e.problem.detail : "The bulk revocation failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        icon="log-out"
        loading={running}
        onClick={() => {
          onError(null);
          setStepUpOpen(true);
        }}
      >
        Revoke all others
      </Button>
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onVerified={() => setConfirmOpen(true)}
        action="session.revoke_all"
        resourceId={currentUser().id}
        resourceLabel="all sessions except this one"
      />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void revokeAll()}
        title="Revoke all other sessions"
        body="Every device except this browser is signed out immediately. Jobs those devices are watching stay in Activity → Jobs — revocation never cancels server-side operations."
        confirmLabel="Revoke all other sessions"
        destructive
        typedConfirmation="revoke all"
      />
    </>
  );
}
