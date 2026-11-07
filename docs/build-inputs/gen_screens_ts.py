#!/usr/bin/env python3
"""Generate lib/screens.ts (typed screen registry) from scripts/spec/screens.json."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(ROOT, "scripts", "spec", "screens.json")
OUT = os.path.join(ROOT, "nexuspanel-gui", "lib", "screens.ts")

BARE_PREFIXES = ("/auth/", "/setup/", "/onboarding")


def app_path(route: str) -> str | None:
    """Route string -> app/ file directory path, or None for state screens/landing."""
    if route in ("/",) or "(state)" in route:
        return None
    p = route
    while ":" in p:
        i = p.find(":")
        j = i
        while j < len(p) and p[j] not in "/?":
            j += 1
        p = p[:i] + "[" + p[i + 1 : j] + "]" + p[j:]
    p = p.rstrip("/") or "/"
    if any(p == b.rstrip("/") or p.startswith(b) for b in BARE_PREFIXES):
        return p  # bare group: app/auth/sign-in etc.
    return p  # (panel) group


def ts_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def main() -> None:
    data = json.load(open(SPEC, encoding="utf-8"))
    modules = {m["id"]: m for m in data["modules"]}

    lines = []
    lines.append("// GENERATED from Stage 3 §8 by scripts/gen_screens_ts.py — do not edit by hand.")
    lines.append("// The canonical behavioral spec is NexusPanel_Stage 3 v2.0; this registry is")
    lines.append("// the prototype's single source of truth for screen IDs, routes and audiences.")
    lines.append("")
    lines.append("export type ScreenKind = \"page\" | \"state\";")
    lines.append("export type ScreenPhase = \"v1\" | \"v2\";")
    lines.append("")
    lines.append("export interface ScreenDef {")
    lines.append("  id: string;")
    lines.append("  route: string;")
    lines.append("  /** app-router directory for the page file; null for route states and the landing. */")
    lines.append("  app_path: string | null;")
    lines.append("  title: string;")
    lines.append("  module: string;")
    lines.append("  module_title: string;")
    lines.append("  spec_section: string;")
    lines.append("  audiences: string[];")
    lines.append("  summary: string;")
    lines.append("  actions: string[];")
    lines.append("  phase: ScreenPhase;")
    lines.append("  kind: ScreenKind;")
    lines.append("  notes?: string;")
    lines.append("}")
    lines.append("")
    lines.append("export interface ModuleDef { id: string; title: string; spec_section: string }")
    lines.append("")
    lines.append("export const MODULES: ModuleDef[] = [")
    for m in data["modules"]:
        lines.append(
            f"  {{ id: {ts_str(m['id'])}, title: {ts_str(m['title'])}, spec_section: {ts_str(m['spec_section'])} }},"
        )
    lines.append("];")
    lines.append("")
    lines.append("export const SCREENS: ScreenDef[] = [")
    for s in data["screens"]:
        ap = app_path(s["route"])
        kind = "state" if ap is None and "(state)" in s["route"] else "page"
        notes = s.get("notes") or ""
        fields = [
            f"id: {ts_str(s['id'])}",
            f"route: {ts_str(s['route'])}",
            f"app_path: {ts_str(ap) if ap else 'null'}",
            f"title: {ts_str(s['title'])}",
            f"module: {ts_str(s['module'])}",
            f"module_title: {ts_str(modules[s['module']]['title'])}",
            f"spec_section: {ts_str(s.get('spec_section', ''))}",
            f"audiences: {json.dumps(s['audiences'], ensure_ascii=False)}",
            f"summary: {ts_str(s['summary'])}",
            f"actions: {json.dumps(s.get('actions', []), ensure_ascii=False)}",
            f"phase: {ts_str(s.get('phase', 'v1'))}",
            f"kind: {ts_str(kind)}",
        ]
        if notes:
            fields.append(f"notes: {ts_str(notes)}")
        lines.append("  { " + ", ".join(fields) + " },")
    lines.append("];")
    lines.append("")
    lines.append("export function screenById(id: string): ScreenDef | undefined {")
    lines.append("  return SCREENS.find((s) => s.id === id);")
    lines.append("}")
    lines.append("")
    lines.append("export function screensByModule(moduleId: string): ScreenDef[] {")
    lines.append("  return SCREENS.filter((s) => s.module === moduleId);")
    lines.append("}")
    lines.append("")
    lines.append("export function screensForRoute(route: string): ScreenDef[] {")
    lines.append("  return SCREENS.filter((s) => s.route === route);")
    lines.append("}")
    lines.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    pages = sum(1 for s in data["screens"] if "(state)" not in s["route"] and s["route"] != "/")
    states = sum(1 for s in data["screens"] if "(state)" in s["route"])
    print(f"wrote {OUT}: {len(data['screens'])} screens ({pages} page routes, {states} route states)")


if __name__ == "__main__":
    main()
