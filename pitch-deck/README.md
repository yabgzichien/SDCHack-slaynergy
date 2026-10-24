# Jobbery pitch deck

A 12-slide HTML deck, written to run in under 4 minutes (about 3:20 of speech), followed by the 3-minute demo.

Open it from a local server so the fonts and images load the same everywhere:

```bash
cd pitch-deck && python3 -m http.server 8765   # then open http://localhost:8765
```

`index.html` also opens straight from the file system. `jobbery-pitch-deck.pdf` is a 12-page backup.

## Keys

| Key | Does |
|---|---|
| `→` `Space` `PageDown` / `←` `PageUp` | Next / previous slide |
| `1`–`9`, `Home`, `End` | Jump |
| `N` | Speaker script for the current slide, with its time budget |
| `T` | Timer: elapsed time against the plan (`R` restarts it) |
| `F` | Fullscreen |

Print (`Ctrl+P`, background graphics on) gives one slide per page.

## Time plan

Title 8 s · Problem 30 · Who 12 · Solution 19 · Different 32 · Must-haves 15 · Data 9 · Architecture 12 · Humans 15 · Risk 18 · Impact 15 · Close 14. Total 199 s. The scripts in the `<aside class="notes-src">` blocks add up to 494 words (3:18 at 150 words a minute, 3:48 at 130).

## Where the numbers come from

| On the slide | Source in this repo |
|---|---|
| Clerical share of job ads, 9.9% (2022 Q2) to 7.3% (2026 Q2) | `jobbery/data/series.json`, DOSM Job Market Insights; the sparkline is its 20 quarters |
| 43% of a general office clerk's tasks in real AI use | Anthropic Economic Index 2025-02-10, O*NET 43-9061 (9 of 21 tasks) |
| Data entry clerks 0.70 on ILO exposure | ILO WP 140 (2025 scores), ISCO 4132 |
| 52,607 / 74,841 unemployment benefit applications | `docs/PRD.md` (SAYS Malaysia report) |
| 44 / 50 / 5% odds for slow / medium / fast | `jobbery/anchors/forecasts-2026Q4.json` |
| 66 replayed releases, about 200 simulated forecasters, Brier 0.242 vs 0.25 | `README.md` section 8 |
| 81 tests, 42 of 42 fairness pairs | `npx vitest run`, `/trust` page |
| Release dates | `series.json` `sources[]` |

MyCOL is on the data slide as "queued, not loaded yet" because the app does not read it today.
