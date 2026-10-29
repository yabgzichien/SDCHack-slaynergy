"use client";
import { NextRow } from "./ui";

export function StepNav({ back, next, nextLabel = "Next", disabled }: { back?: string; next?: string; nextLabel?: string; disabled?: boolean }) {
  return <NextRow back={back} next={next} nextLabel={nextLabel} disabled={disabled} />;
}
