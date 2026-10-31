"use client";
import { useId } from "react";
import { CircleAlert } from "lucide-react";
import "./ReleaseInfo.css";

export function ReleaseInfo({ children, label }: { children: React.ReactNode; label: string }) {
  const tipId = useId();
  return (
    <span className="release-info">
      <button type="button" className="release-info-trigger" aria-label={label} aria-describedby={tipId}>
        <CircleAlert size={22} aria-hidden="true" />
      </button>
      <span id={tipId} className="release-info-popup" role="tooltip"><span>{children}</span></span>
    </span>
  );
}
