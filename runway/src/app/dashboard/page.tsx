"use client";

import { Dashboard } from "@/app/page";
import { useApp } from "@/components/AppProvider";
import { Btn, PageTitle, Skeleton } from "@/components/ui";

export default function DashboardPage() {
  const { state, view } = useApp();
  if (!state || !view) return <Skeleton lines={4} />;
  if (!state.profile) {
    return <div><PageTitle title="Your dashboard">Create a profile first to see your saved career results.</PageTitle><Btn href="/start">Get started</Btn></div>;
  }
  return <Dashboard />;
}
