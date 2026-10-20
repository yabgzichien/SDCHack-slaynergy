"use client";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

// Critically damped spring (no bounce): content arrives from where the user expects, and never blocks input.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  return (
    <motion.div key={path} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.15 } : { type: "spring", bounce: 0, duration: 0.45 }}>
      {children}
    </motion.div>
  );
}
