"use client";

import React from "react";
import { Field, Select } from "@/components/ui/form";
import { fileSites } from "@/lib/mock/files";
import { useSession } from "@/components/providers";

/** Site scope picker for the file surfaces (FLOW-007 step 1: account-scoped root). */
export function SiteSelect({
  value,
  onChange,
  label = "Website scope",
  id = "file-site",
}: {
  value: string;
  onChange: (siteId: string) => void;
  label?: string;
  id?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint="File operations are scoped to one website's permitted root — no traversal outside it.">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {fileSites.map((s) => (
          <option key={s.site_id} value={s.site_id}>
            {s.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Standard+ runs each site in a container — paths display as /app/… . */
export function useContainerized(): boolean {
  const { profile } = useSession();
  return profile === "standard" || profile === "provider";
}
