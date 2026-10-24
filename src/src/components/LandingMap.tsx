"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import { MalaysiaMap, MapLegend } from "./MalaysiaMap";
import { mapFigures, rm } from "@/lib/map-figures";
import { geo } from "@/lib/engine/geo";

export function LandingMap() {
  const { view, state } = useApp();
  const { t } = useT();
  if (!view) return null;
  // Wage figures cover each whole state and are independent of the sector argument.
  const fig = mapFigures("finance", "wage");
  const ranked = [...fig.rows].sort((a, b) => b.medianWage - a.medianWage);
  const source = geo.sources.find((s) => s.id === "wages_state");

  return (
    <section id="maps" className="landing-statistics landing-maps landing-section-reveal" aria-labelledby="maps-title">
      <div className="landing-stats-top landing-reveal">
        <div>
          <span className="landing-section-label">{t("PAY ACROSS MALAYSIA")}</span>
          <h2 id="maps-title">{t("See how pay differs by state")}<span className="landing-period">.</span></h2>
          <p>{t("Compare median monthly pay across Malaysia, then personalise your map to explore work that fits you.")}</p>
        </div>
        <Link href={state?.profile ? "/map" : "/start"} className="landing-text-link landing-stats-all">{t("Personalise your map")} <ArrowRight size={16} aria-hidden /></Link>
      </div>
      <div className="landing-data-grid landing-map-grid">
        <article className="landing-chart-card landing-reveal">
          <div className="landing-data-heading"><div><span className="landing-card-index">{t("STATE SALARY HEATMAP")}</span><h3>{t("Median monthly pay")}</h3></div></div>
          <MalaysiaMap values={fig.values} bins={fig.bins} ramp={fig.ramp} preview ariaLabel={t("Malaysia heatmap of median monthly pay by state")} />
          <MapLegend title={t("Darker green means higher median monthly pay.")} bins={fig.bins} ramp={fig.ramp} fmt={rm} />
          <p className="landing-data-note">{t("State-wide figures across jobs, not salaries for a particular occupation.")} {source && <a href={source.url} target="_blank" rel="noreferrer">{t("Source: OpenDOSM, {year}", { year: source.latest })}</a>}</p>
        </article>
        <article className="landing-insight-card landing-reveal">
          <span className="landing-card-index">{t("SALARY STATISTICS")}</span>
          <h3>{t("Highest state medians")}</h3>
          <p className="landing-insight-sub">{t("Median monthly pay")}{source ? ` · ${source.latest}` : ""}</p>
          <ol className="landing-salary-list">
            {ranked.slice(0, 3).map((row) => <li key={row.id}><span>{t(row.name)}</span><strong className="num">{rm(row.medianWage)}</strong></li>)}
          </ol>
          <p className="landing-data-note">{t("Median pay is the middle salary: half of workers earn more and half earn less.")}</p>
        </article>
      </div>
    </section>
  );
}
