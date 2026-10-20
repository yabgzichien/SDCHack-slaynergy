"use client";
import { StartOptions } from "@/components/StartOptions";
import { PageTitle } from "@/components/ui";

export default function StartPage() {
  return (
    <div>
      <PageTitle step="Step 1 of 4 · You" title="How would you like to start?">Pick whichever is quickest for you. You can change everything later.</PageTitle>
      <StartOptions />
    </div>
  );
}
