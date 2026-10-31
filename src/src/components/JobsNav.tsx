"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export function JobsNav({ showOthers }: { showOthers: boolean }) {
  const sections = useMemo(() => [
    { id: "best-job", label: "Your best job" },
    ...(showOthers ? [{ id: "others", label: "Other good matches" }] : []),
    { id: "where", label: "Where in Malaysia" },
    { id: "keep-job", label: "Not ready to change jobs?" },
  ], [showOthers]);
  const [active, setActive] = useState(sections[0].id);

  useEffect(() => {
    const ids = sections.map((section) => section.id);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = ids[0];
      for (const id of ids) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= 180) current = id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  return (
    <aside className="jobs-nav">
      <div className="jobs-nav-heading">
        <Image src="/cockatiel-ai-icon-v2.png" alt="" width={42} height={42} />
        <span>On this page</span>
      </div>
      <nav aria-label="Jobs page sections">
        {sections.map((section, index) => (
          <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined}>
            <span className="jobs-nav-number" aria-hidden>{index + 1}</span>
            {section.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
