"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";

// Select a job (or STAY_ID to keep the current one). This is the one selection the map and the plan follow.
// Choosing restarts plan progress, so a switch that would lose ticked steps asks first; re-selecting does nothing.
export function useSelectJob() {
  const { state, act } = useApp();
  const router = useRouter();
  return useCallback(async (id: string, then: string | null = "/map") => {
    if (state?.chosenRoleId !== id) {
      const ticked = Object.values(state?.progress ?? {}).some(Boolean);
      if (ticked && !window.confirm("Switching jobs restarts your plan's progress. Switch anyway?")) return false;
      if (!(await act("chooseRole", { roleId: id }))) return false;
    }
    if (then) router.push(then);
    return true;
  }, [state?.chosenRoleId, state?.progress, act, router]);
}
