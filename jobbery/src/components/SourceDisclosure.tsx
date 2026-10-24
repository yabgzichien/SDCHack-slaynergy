"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/components/I18nProvider";

export function SourceDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { t } = useT();

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="source-disclosure-toggle press inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm font-semibold text-accentink hover:bg-accentsoft"
      >
        {t(open ? "Hide sources" : "View sources")}
        <ChevronDown size={16} aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>
      <div id={id} hidden={!open}>
        <div className="mt-3 flex flex-col items-start gap-2 rounded-2xl bg-raised p-4">{children}</div>
      </div>
    </div>
  );
}
