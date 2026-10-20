"use client";
import { Btn } from "./ui";

export function StepNav({ back, next, nextLabel = "Next", disabled }: { back?: string; next?: string; nextLabel?: string; disabled?: boolean }) {
  return (
    <nav className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5" aria-label="Page navigation">
      {back ? <Btn href={back} variant="ghost">← Back</Btn> : <span />}
      {next && (disabled ? <Btn variant="primary" disabled>{nextLabel} →</Btn> : <Btn href={next}>{nextLabel} →</Btn>)}
    </nav>
  );
}
