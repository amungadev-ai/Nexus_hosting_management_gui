"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PersonaId } from "@/lib/types";
import { PERSONAS, PRESENTATION_MODES } from "@/lib/personas";
import { useSession } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Card } from "@/components/ui/card";
import { Field, Select, Switch } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/nav";
import { KeyValue } from "@/components/ui/misc";

/**
 * UX-IAM-012 — Personal preferences. Theme, density, presentation mode and
 * the default persona all apply immediately through the session context
 * (persisted in localStorage for the demo; PATCH /me/preferences in the
 * real product). Presentation is layout-only — permissions are identical
 * across modes. There is no account-closure screen in the registry, so the
 * danger zone links to Organizations instead.
 */
export default function ProfilePage() {
  const session = useSession();
  const [timezone, setTimezone] = useState<string | null>(null);

  // Resolved after mount so the static prerender and the client agree.
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <Screen
      id="UX-IAM-012"
      breadcrumbs={[{ label: "Settings" }, { label: "Profile" }]}
      description="Theme, language, timezone, density and presentation preferences. Everything applies immediately — there is no separate save step."
    >
      <div className="flex flex-col gap-4">
        <Card title="Appearance">
          <div className="flex flex-col gap-5">
            <Field label="Theme" htmlFor="pref-theme" hint="Light, dark, or follow the system.">
              <SegmentedControl
                aria-label="Theme"
                value={session.theme}
                onChange={(v) => session.setTheme(v as "light" | "dark" | "system")}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">Compact density</p>
                <p className="text-xs text-ink-2">
                  Tighter tables and rows — the expert default (UXD-015). Dark mode and density
                  come from the same token set.
                </p>
              </div>
              <Switch
                checked={session.density === "compact"}
                onChange={(v) => session.setDensity(v ? "compact" : "comfortable")}
                label="Compact"
              />
            </div>
          </div>
        </Card>

        <Card title="Presentation mode">
          <div className="flex flex-col gap-3">
            <SegmentedControl
              aria-label="Presentation mode"
              value={session.presentation}
              onChange={(v) => session.setPresentation(v as "guided" | "standard" | "expert")}
              options={PRESENTATION_MODES.map((m) => ({ value: m.id, label: m.label }))}
            />
            <p className="text-sm text-ink-2">
              {PRESENTATION_MODES.find((m) => m.id === session.presentation)?.blurb}
            </p>
            <p className="rounded-control bg-info-soft px-3 py-2 text-xs text-info">
              Presentation only — permissions are identical in every mode. The API enforces what
              you may do; the interface only decides what is in front of you (UXD-033, UXT-029).
            </p>
          </div>
        </Card>

        <Card title="Workspace defaults">
          <div className="flex flex-col gap-5">
            <Field
              label="Default persona view"
              htmlFor="pref-persona"
              hint="Which job-to-be-done the interface is arranged for. Persona ≠ permission — this changes emphasis and landing, never authorization."
            >
              <Select
                id="pref-persona"
                value={session.persona}
                onChange={(e) => session.setPersona(e.target.value as PersonaId)}
                className="max-w-md"
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <KeyValue
              columns={2}
              items={[
                {
                  label: "Language",
                  value: (
                    <span>
                      English <span className="text-ink-3">(Swahili planned — copy is localization-ready)</span>
                    </span>
                  ),
                },
                { label: "Timezone", value: timezone ?? "Resolving after page load…" },
                {
                  label: "First-run state",
                  value: session.firstRun ? "Router on next landing" : "Portfolio (returning user)",
                },
              ]}
            />
          </div>
        </Card>

        <Card
          title="Danger zone"
          className="border-danger/40"
          description="Closing this panel installation removes its websites and releases the domain configuration. Closure is a guided, audited flow."
          footer={
            <span className="text-xs text-ink-3">
              The registry has no dedicated closure screen in this prototype build, so this links
              to the organization that owns the installation.
            </span>
          }
        >
          <Link
            href="/settings/organizations"
            className="font-medium text-danger hover:underline"
          >
            Manage the organization that owns this installation →
          </Link>
        </Card>
      </div>
    </Screen>
  );
}
