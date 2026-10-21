"use client";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useLayoutEffect(() => {
    const main = document.querySelector(".app-page-main");
    main?.classList.remove("results-arrival");
    if (path !== "/skills") return;
    try {
      if (sessionStorage.getItem("jobbery-results-arrival") === "1") {
        sessionStorage.removeItem("jobbery-results-arrival");
        main?.classList.add("results-arrival");
      }
    } catch { /* Storage can be disabled; navigation still works. */ }
  }, [path]);
  return <>{children}</>;
}
