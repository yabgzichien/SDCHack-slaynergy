"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

export function ForecastNav({ showResults, showYours }: { showResults: boolean; showYours: boolean }) {
  const [active, setActive] = useState(showYours ? "your-predictions" : "open-questions");
  const sections = [
    ...(showYours ? [{ id: "your-predictions", label: "Your predictions" }] : []),
    { id: "open-questions", label: "Open questions" },
    ...(showResults ? [{ id: "past-results", label: "Past results" }] : []),
    { id: "how", label: "Why forecasts matter" },
  ];

  useEffect(() => {
    const ids = [...(showYours ? ["your-predictions"] : []), "open-questions", ...(showResults ? ["past-results"] : []), "how"];
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
  }, [showResults, showYours]);

  return (
    <aside className="forecast-nav">
      <div className="forecast-nav-heading">
        <Image src="/cockatiel-ai-icon-v2.png" alt="" width={42} height={42} />
        <span>On this page</span>
      </div>
      <nav aria-label="Forecast page sections">
        {sections.map((section, index) => (
          <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined}>
            <span className="forecast-nav-number" aria-hidden>{index + 1}</span>
            {section.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
