import "./market-odds-bar.css";

/** The two sides always share one track, so the join moves with the market price. */
export function MarketOddsBar({ yes, compact = false }: { yes: number; compact?: boolean }) {
  const split = Math.max(0, Math.min(1, yes)) * 100;
  const yesPercent = Math.round(split);
  const noPercent = 100 - yesPercent;

  return (
    <div className={`market-odds${compact ? " market-odds-compact" : ""}`} role="img" aria-label={`${yesPercent}% Yes, ${noPercent}% No`}>
      <div className="market-odds-labels" aria-hidden="true">
        <span className="market-odds-yes">Yes <strong className="num">{yesPercent}%</strong></span>
        <span className="market-odds-no"><strong className="num">{noPercent}%</strong> No</span>
      </div>
      <div className="market-odds-track" aria-hidden="true">
        <span className="market-odds-segment market-odds-segment-yes" style={{ width: `${split}%` }} />
        <span className="market-odds-segment market-odds-segment-no" style={{ width: `${100 - split}%` }} />
        {split > 0 && split < 100 && <span className="market-odds-spark" style={{ left: `${split}%` }} />}
      </div>
    </div>
  );
}
