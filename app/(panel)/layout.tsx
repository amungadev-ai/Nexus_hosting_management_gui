import { AppShell } from "@/components/shell/app-shell";

/**
 * The panel shell wraps every in-panel screen (auth, setup and onboarding
 * routes live outside this group — the router appears before any
 * organization context exists, per Stage 3 §2.2).
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
