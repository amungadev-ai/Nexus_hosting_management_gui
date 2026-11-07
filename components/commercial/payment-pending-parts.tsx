"use client";

import { KeyValue, ProgressBar } from "@/components/ui/misc";

export { KeyValue };

export function ProgressStable({ value, label }: { value: number; label: string }) {
  return <ProgressBar value={value} label={label} tone={value > 90 ? "warning" : "accent"} />;
}
