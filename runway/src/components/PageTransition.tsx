"use client";
// App screens perform no entrance (house rule): content is there when the route is.
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
