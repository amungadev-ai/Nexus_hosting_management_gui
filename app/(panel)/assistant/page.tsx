"use client";

import { AssistantWorkspace } from "@/components/ai/assistant-view";

/**
 * UX-AI-001 /assistant — AI assistant workspace. Client page: the workspace
 * gates itself on ai.diagnostics and renders the UX-AI-006 first-run and
 * UX-AI-007 needs-key states in-page.
 */
export default function AssistantPage() {
  return <AssistantWorkspace />;
}
