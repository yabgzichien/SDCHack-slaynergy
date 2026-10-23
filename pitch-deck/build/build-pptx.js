// Builds jobbery-pitch-deck.pptx from the same content as index.html.
// Run: NODE_PATH=<node_modules with pptxgenjs, react-icons, react, react-dom, sharp> node build-pptx.js
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaCheck } = require("react-icons/fa");
const { applyTheme } = require(process.env.APPLY_THEME);

const ROOT = path.join(__dirname, "..");
const IMG = (f) => path.join(ROOT, "img", f);
const BUILD = (f) => path.join(__dirname, f);
const OUT = path.join(ROOT, "jobbery-pitch-deck.pptx");

// Speaker script per slide, read from the HTML deck so the two never drift apart.
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const NOTES = [...html.matchAll(/<aside class="notes-src" hidden>([\s\S]*?)<\/aside>/g)].map((m) =>
  m[1].replace(/\s+/g, " ").trim().replace(/&#8209;/g, "-"));
if (NOTES.length !== 12) throw new Error("expected 12 speaker notes, got " + NOTES.length);

// ---------- theme: the Jobbery app palette ----------
const THEME = {
  name: "Jobbery",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "203B2B", lt1: "FFF7ED", dk2: "305D40", lt2: "EDF4EC",
    accent1: "305D40", accent2: "F8C982", accent3: "6FA66A", accent4: "CBE4C6",
    accent5: "C9741A", accent6: "FFF0D8", hlink: "305D40", folHlink: "547451",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Jobbery pitch deck";
pres.author = "Team #slaynergy";
pres.subject = "SDC Hackathon 2026, Domain 1: Aiversecity Future-Ready Workforce";
const C = pres.SchemeColor;
const S = pres.ShapeType;

const PAPER = "FFFDF8";   // raised white surface from the app
const CUE_INK = "6B3D08"; // text on the amber-soft card
const SDG = { 4: "C5192D", 8: "A21942", 10: "DD1367" };
const M = 0.667;          // outer margin
const W = 12.0;           // content width

// ---------- layouts (one per slide frame) ----------
const titleBox = (color, extra = {}) => ({
  placeholder: {
    options: { name: "title", type: "title", x: M, y: 0.55, w: W, h: 1.0, fontFace: "Cambria", fontSize: 36,
      bold: false, color, align: "left", valign: "top", margin: 0, ...extra },
    text: "",
  },
});
pres.defineSlideMaster({ title: "LIGHT", background: { color: C.background1 }, objects: [titleBox(C.text1)] });
pres.defineSlideMaster({ title: "MINT", background: { color: C.background2 }, objects: [titleBox(C.text1)] });
pres.defineSlideMaster({ title: "MINT_DEEP", background: { color: C.accent4 }, objects: [titleBox(C.text1)] });
pres.defineSlideMaster({ title: "DARK", background: { color: C.accent1 }, objects: [titleBox(C.background1)] });
pres.defineSlideMaster({
  title: "TITLE", background: { color: C.accent1 },
  objects: [titleBox(C.background1, { y: 1.55, w: 7.2, h: 2.3, fontSize: 110, bold: true, valign: "middle" })],
});

// ---------- helpers ----------
const card = (s, name, x, y, w, h, fill, r = 0.28) =>
  s.addShape(S.roundRect, { objectName: name, x, y, w, h, fill: { color: fill }, line: { type: "none" }, rectRadius: r });
const text = (s, name, t, o) => s.addText(t, { objectName: name, isTextBox: true, margin: 0, fontFace: "Calibri", ...o });
const pill = (s, name, label, x, y, w, h, fill, color, size = 14) => {
  s.addShape(S.roundRect, { objectName: name + " shape", x, y, w, h, fill: { color: fill }, line: { type: "none" }, rectRadius: h / 2 });
  text(s, name, label, { x, y, w, h, fontSize: size, bold: true, color, align: "center", valign: "middle" });
};
const dot = (s, name, x, y, d, fill) =>
  s.addShape(S.ellipse, { objectName: name, x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" } });
const bullets = (items, base) =>
  items.map((it, i) => ({ text: it, options: { bullet: { indent: 16 }, breakLine: i < items.length - 1, paraSpaceAfter: 8, ...base } }));

async function main() {
  const check = await sharp(Buffer.from(ReactDOMServer.renderToStaticMarkup(
    React.createElement(FaCheck, { color: "#FFF7ED", size: 256 })))).png().toBuffer();
  const checkData = "image/png;base64," + check.toString("base64");

  const sections = ["Open", "Problem", "Solution", "Build and trust", "Close"];
  const sectionOf = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4];
  let started = -1;
  const mk = (i, masterName) => {
    if (sectionOf[i] !== started) { pres.addSection({ title: sections[sectionOf[i]] }); started = sectionOf[i]; }
    const s = pres.addSlide({ masterName, sectionTitle: sections[sectionOf[i]] });
    s.addNotes(NOTES[i]);
    return s;
  };

  // ===== 1 Title =====
  {
    const s = mk(0, "TITLE");
    s.addText("Jobbery", { placeholder: "title" });
    text(s, "Tagline", "A deadline-based job plan for office workers whose jobs AI is replacing",
      { x: M, y: 4.0, w: 6.9, h: 1.0, fontSize: 26, color: C.background1, valign: "top" });
    pill(s, "Domain pill", "Domain 1: Aiversecity Future-Ready Workforce", M, 5.3, 5.3, 0.5, C.accent2, C.text1, 15);
    text(s, "Team line", "Team #slaynergy  ·  SDC Hackathon 2026",
      { x: M, y: 6.05, w: 6.9, h: 0.4, fontSize: 16, color: C.accent4 });
    // art panel, echoing the app's landing illustration
    s.addShape(S.rect, { objectName: "Art panel", x: 8.0, y: 0, w: 5.333, h: 7.5, fill: { color: C.accent4 }, line: { type: "none" } });
    s.addShape(S.ellipse, { objectName: "Art hill", x: 8.45, y: 2.9, w: 4.6, h: 4.6, fill: { color: "9BCB95" }, line: { type: "none" } });
    s.addShape(S.ellipse, { objectName: "Art arch", x: 8.95, y: 0.8, w: 3.6, h: 3.6, fill: { color: C.background2 }, line: { type: "none" } });
    s.addShape(S.ellipse, { objectName: "Art sun", x: 11.85, y: 0.55, w: 0.9, h: 0.9, fill: { color: C.accent2 }, line: { type: "none" } });
    [[11.0, 1.1], [11.62, 1.7], [12.24, 2.4], [12.86, 1.4]].forEach(([x, h], i) =>
      s.addShape(S.rect, { objectName: "Art block " + (i + 1), x, y: 7.5 - h, w: 0.5, h, fill: { color: C.accent3 }, line: { type: "none" } }));
    s.addImage({ path: BUILD("welcome.png"), objectName: "Mascot, welcoming", x: 8.45, y: 1.85, w: 4.3, h: 4.3,
      altText: "Jobbery's cockatiel mascot with open wings" });
  }

  // ===== 2 Problem =====
  {
    const s = mk(1, "LIGHT");
    s.addText("Clerical jobs are slipping, and no one tells\na laid-off clerk by when", { placeholder: "title" });
    const cw = (W - 0.4) / 3, cy = 2.1, ch = 3.5;
    const xs = [M, M + cw + 0.2, M + 2 * (cw + 0.2)];
    // card 1: DOSM
    card(s, "DOSM card", xs[0], cy, cw, ch, C.background2);
    text(s, "DOSM label", "Clerical roles, as a share of Malaysia’s online job ads",
      { x: xs[0] + 0.3, y: cy + 0.25, w: cw - 0.6, h: 0.55, fontSize: 14, color: C.text1, valign: "top" });
    text(s, "DOSM figure", [
      { text: "9.9", options: { fontSize: 40 } }, { text: "%", options: { fontSize: 22 } },
      { text: "  →  ", options: { fontSize: 22 } },
      { text: "7.3", options: { fontSize: 40 } }, { text: "%", options: { fontSize: 22 } },
    ], { x: xs[0] + 0.3, y: cy + 0.85, w: cw - 0.6, h: 0.75, fontFace: "Cambria", color: C.text1, valign: "middle" });
    const q = ["2022Q2","2022Q3","2022Q4","2023Q1","2023Q2","2023Q3","2023Q4","2024Q1","2024Q2","2024Q3","2024Q4","2025Q1","2025Q2","2025Q3","2025Q4","2026Q1","2026Q2"];
    const v = [9.93,8.642,8.101,8.678,6.846,6.443,5.279,7.347,7.57,7.342,6.596,6.639,5.353,7.256,8.453,7.782,7.274];
    s.addChart(pres.charts.LINE, [{ name: "Clerical share of online job ads (%)", labels: q, values: v }], {
      objectName: "Clerical share chart", x: xs[0] + 0.2, y: cy + 1.65, w: cw - 0.4, h: 1.0,
      chartColors: ["305D40"], lineSize: 3, lineDataSymbol: "none", catAxisHidden: true, valAxisHidden: true,
      valAxisMinVal: 4.5, valAxisMaxVal: 10.5, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: false, showTitle: false, altText: "Line chart: clerical share of Malaysian online job ads by quarter, 2022 Q2 to 2026 Q2",
    });
    text(s, "DOSM source", "DOSM Job Market Insights, 2022 Q2 to 2026 Q2 (published 18 Aug 2026). Down 27% from the peak; the quarterly series is noisy.",
      { x: xs[0] + 0.3, y: cy + 2.75, w: cw - 0.6, h: 0.65, fontSize: 11, color: "547451", valign: "top" });
    // card 2: AEI + ILO
    card(s, "AEI card", xs[1], cy, cw, ch, C.accent4);
    text(s, "AEI label", "of a general office clerk’s tasks already show up in real AI use",
      { x: xs[1] + 0.3, y: cy + 0.25, w: cw - 0.6, h: 0.55, fontSize: 14, color: C.text1, valign: "top" });
    text(s, "AEI figure", [{ text: "43", options: { fontSize: 54 } }, { text: "%", options: { fontSize: 28 } }],
      { x: xs[1] + 0.3, y: cy + 0.85, w: cw - 0.6, h: 0.95, fontFace: "Cambria", color: C.text1, valign: "middle" });
    text(s, "ILO line", "ILO puts data entry clerks in its top exposure band (0.70 on a 0 to 1 scale).",
      { x: xs[1] + 0.3, y: cy + 1.95, w: cw - 0.6, h: 0.75, fontSize: 15, color: C.text1, valign: "top" });
    text(s, "AEI source", "Anthropic Economic Index, release of 10 Feb 2025 (9 of 21 O*NET tasks). ILO Working Paper 140, 2025 scores.",
      { x: xs[1] + 0.3, y: cy + 2.75, w: cw - 0.6, h: 0.65, fontSize: 11, color: "547451", valign: "top" });
    // card 3: people
    card(s, "People card", xs[2], cy, cw, ch, C.accent6);
    text(s, "People label", "workers had applied for unemployment benefits by mid-July 2026",
      { x: xs[2] + 0.3, y: cy + 0.25, w: cw - 0.6, h: 0.55, fontSize: 14, color: CUE_INK, valign: "top" });
    text(s, "People figure", "52,607",
      { x: xs[2] + 0.3, y: cy + 0.85, w: cw - 0.6, h: 0.95, fontSize: 54, fontFace: "Cambria", color: CUE_INK, valign: "middle" });
    text(s, "People line", "All of 2025 saw 74,841. The Job Search Allowance lasts 3 to 6 months.",
      { x: xs[2] + 0.3, y: cy + 1.95, w: cw - 0.6, h: 0.75, fontSize: 15, color: CUE_INK, valign: "top" });
    text(s, "People source", "SAYS Malaysia reporting, 2026; PERKESO Job Search Allowance terms.",
      { x: xs[2] + 0.3, y: cy + 2.75, w: cw - 0.6, h: 0.65, fontSize: 11, color: CUE_INK, valign: "top" });
    // the gap
    card(s, "Gap band", M, 5.85, W, 1.05, C.text1);
    dot(s, "Gap dot", M + 0.4, 6.275, 0.2, C.accent2);
    text(s, "Gap statement", "The gap: today’s career tools give advice with no dates, no sources and no track record.",
      { x: M + 0.85, y: 5.85, w: W - 1.3, h: 1.05, fontSize: 22, fontFace: "Cambria", color: C.background1, valign: "middle" });
  }

  // ===== 3 Who it is for =====
  {
    const s = mk(2, "MINT");
    s.addText("Two users: the worker and the advisor", { placeholder: "title" });
    const cw = (W - 0.2) / 2, cy = 1.75, ch = 5.15;
    const defs = [
      { x: M, fill: PAPER, ink: C.text1, dotc: C.accent3, h: "The worker", img: "running.png", name: "Worker",
        lede: "A finance or admin clerk, 22 to 35, in the first week after being laid off.",
        b: ["3 to 6 months of allowance: a real deadline", "Needs to know which skills expire, which jobs are within reach, and what to learn this week"] },
      { x: M + cw + 0.2, fill: C.accent1, ink: C.background1, dotc: C.accent2, h: "The advisor", img: "thinking.png", name: "Advisor",
        lede: "An employment counsellor who meets each worker once.",
        b: ["Sees the worker’s profile, plan and the futures behind the advice", "Writes advice that lands on the worker’s plan"] },
    ];
    for (const d of defs) {
      card(s, d.name + " card", d.x, cy, cw, ch, d.fill, 0.3);
      text(s, d.name + " heading", d.h, { x: d.x + 0.4, y: cy + 0.35, w: cw - 0.8, h: 0.7, fontSize: 32, fontFace: "Cambria", color: d.ink, valign: "top" });
      text(s, d.name + " summary", d.lede, { x: d.x + 0.4, y: cy + 1.2, w: 4.6, h: 0.95, fontSize: 20, bold: true, color: d.ink, valign: "top" });
      text(s, d.name + " points", bullets(d.b, { color: d.ink, fontSize: 16 }), { x: d.x + 0.4, y: cy + 2.35, w: 3.4, h: 2.4, valign: "top" });
      s.addImage({ path: BUILD(d.img), objectName: d.name + " mascot", x: d.x + cw - 2.35, y: cy + ch - 2.3, w: 2.3, h: 2.3, altText: "Jobbery cockatiel mascot" });
    }
  }

  // ===== 4 Solution =====
  {
    const s = mk(3, "LIGHT");
    s.addText("Four steps from laid off to a dated plan", { placeholder: "title" });
    const cw = (W - 0.6) / 4, y0 = 1.6;
    const steps = [
      ["You", "crop-you.jpg", "Scan a résumé or answer eight questions. Nothing is stored.", "Résumé scan screen"],
      ["Skills", "crop-skills.jpg", "Every skill gets an expiry date, under slow, medium and fast AI.", "Skills screen with expiry dates"],
      ["Jobs", "crop-jobs.jpg", "Roles you can reach before your deadline, with a score you can open.", "Suggested jobs screen"],
      ["Plan", "crop-plan.jpg", "Week by week, with free courses, ending in a booked advisor meeting.", "Plan screen"],
    ];
    steps.forEach(([name, file, cap, alt], i) => {
      const x = M + i * (cw + 0.2), y = y0 + i * 0.2;
      const iw = cw - 0.2, ih = iw * 1570 / 1370;
      card(s, name + " frame", x, y, cw, ih + 0.2, PAPER, 0.22);
      s.addImage({ path: IMG(file), objectName: name + " screenshot", x: x + 0.1, y: y + 0.1, w: iw, h: ih, altText: "Jobbery " + alt });
      text(s, name + " label", name, { x, y: y + ih + 0.35, w: cw, h: 0.5, fontSize: 28, fontFace: "Cambria", color: C.text1, valign: "top" });
      text(s, name + " caption", cap, { x, y: y + ih + 0.9, w: cw - 0.1, h: 0.9, fontSize: 15, color: C.text1, valign: "top" });
      if (i < 3) {
        dot(s, "Arrow " + (i + 1), x + cw - 0.09, y + 1.35, 0.38, C.accent2);
        text(s, "Arrow glyph " + (i + 1), "›", { x: x + cw - 0.09, y: y + 1.35, w: 0.38, h: 0.38, fontSize: 18, bold: true, color: C.text1, align: "center", valign: "middle" });
      }
    });
  }

  // ===== 5 Different =====
  {
    const s = mk(4, "DARK");
    s.addText("Forecasts graded against real data", { placeholder: "title" });
    const lw = 6.2;
    const pts = [
      ["Settled by official releases. ", "Each question closes on a public release: DOSM on 17 Nov 2026, Epoch AI in Jan 2027."],
      ["Forecasters with a record. ", "About 200 simulated forecasters built track records by replaying 66 real past releases. Always labelled simulated."],
      ["A hash log, not a blockchain. ", "Every guess and settlement is chained, and the fingerprint is committed to GitHub."],
    ];
    const runs = [];
    pts.forEach(([b, t], i) => {
      const last = i === pts.length - 1;
      runs.push({ text: b, options: { bold: true } });
      runs.push({ text: t, options: { breakLine: !last, paraSpaceAfter: 14 } });
    });
    text(s, "Prediction market points", runs, { x: M, y: 1.7, w: lw, h: 2.7, fontSize: 17, color: C.background1, valign: "top" });
    card(s, "Not a chatbot card", M, 4.55, lw, 2.0, C.accent2, 0.28);
    text(s, "Not a chatbot", "This is not a chatbot.", { x: M + 0.35, y: 4.75, w: lw - 0.7, h: 0.6, fontSize: 28, bold: true, fontFace: "Cambria", color: C.text1, valign: "top" });
    text(s, "Not a chatbot detail", "No AI model runs inside Jobbery. Scores and plans come from tested code: same inputs, same answer.",
      { x: M + 0.35, y: 5.45, w: lw - 0.7, h: 0.95, fontSize: 17, color: C.text1, valign: "top" });
    const rx = 7.2, rw = 5.467;
    s.addImage({ path: IMG("crop-market.jpg"), objectName: "Forecast screenshot", x: rx, y: 1.7, w: rw, h: rw * 800 / 1730,
      altText: "Jobbery forecast screen with live open questions" });
    card(s, "Odds card", rx, 4.55, rw, 2.0, C.background1, 0.28);
    text(s, "Odds title", "Today’s odds for the three futures, set by the market", { x: rx + 0.3, y: 4.72, w: rw - 0.6, h: 0.4, fontSize: 15, bold: true, color: C.text1, valign: "top" });
    const bw = rw - 0.6, gap = 0.06, usable = bw - 2 * gap;
    const w1 = usable * 0.44, w2 = usable * 0.50, w3 = usable * 0.06;
    [[rx + 0.3, w1, C.accent4, "Slow 44%", C.text1, "Slow"], [rx + 0.3 + w1 + gap, w2, C.accent1, "Medium 50%", C.background1, "Medium"], [rx + 0.3 + w1 + w2 + 2 * gap, w3, C.accent3, "", C.background1, "Fast"]]
      .forEach(([x, w, fill, label, col, nm]) => {
        s.addShape(S.roundRect, { objectName: nm + " odds bar", x, y: 5.2, w, h: 0.5, fill: { color: fill }, line: { type: "none" }, rectRadius: 0.25 });
        if (label) text(s, nm + " odds label", label, { x: x + 0.15, y: 5.2, w: w - 0.2, h: 0.5, fontSize: 15, bold: true, color: col, valign: "middle" });
      });
    text(s, "Odds note", "The small slice is Fast: 5%. No future ever drops below 5%. Points only, never money.",
      { x: rx + 0.3, y: 5.85, w: rw - 0.6, h: 0.55, fontSize: 13, color: "547451", valign: "top" });
  }

  // ===== 6 Six must-haves =====
  {
    const s = mk(5, "LIGHT");
    s.addText("All six must-haves, each on a named screen", { placeholder: "title" });
    const rows = [
      ["Skills intake", "Onboarding and résumé scan", "You", 0.9],
      ["AI-trend signal layer", "Dated public sources", "Trends · Sources", 1.9],
      ["Role matching and skills gap", "89 roles across 10 sectors", "Jobs", 0.9],
      ["Reskilling pathway", "Week by week, free courses", "Plan", 0.9],
      ["SDG mapping", "Goals 4, 8 and 10", "Goals · Plan", 1.5],
      ["Multiple scenarios", "Slow, medium and fast AI", "Futures", 1.1],
    ];
    const cw = (W - 0.2) / 2, ch = 1.5;
    rows.forEach(([h, sub, scr, pw], i) => {
      const x = M + (i % 2) * (cw + 0.2), y = 1.75 + Math.floor(i / 2) * (ch + 0.2);
      card(s, h + " card", x, y, cw, ch, C.background2, 0.26);
      dot(s, h + " tick circle", x + 0.3, y + ch / 2 - 0.27, 0.54, C.accent1);
      s.addImage({ data: checkData, objectName: h + " tick", x: x + 0.46, y: y + ch / 2 - 0.11, w: 0.22, h: 0.22, altText: "Done" });
      const tx = x + 1.05, tw = cw - 1.05 - 0.3 - pw - 0.2;
      text(s, h + " title", [{ text: h, options: { bold: true, fontSize: 17, breakLine: true } }, { text: sub, options: { fontSize: 15 } }],
        { x: tx, y: y + 0.2, w: tw, h: ch - 0.4, color: C.text1, valign: "middle", paraSpaceAfter: 3 });
      pill(s, h + " screen", scr, x + cw - 0.3 - pw, y + ch / 2 - 0.22, pw, 0.44, C.accent2, C.text1, 14);
    });
  }

  // ===== 7 Data sources =====
  {
    const s = mk(6, "MINT_DEEP");
    s.addText("Every source is dated and replaceable", { placeholder: "title" });
    const hdr = (t) => ({ text: t, options: { fontSize: 12, color: "547451", bold: false, fill: { color: "CBE4C6" } } });
    const none = { type: "none" };
    const gapB = [none, none, { type: "solid", pt: 5, color: "CBE4C6" }, none];
    const cell = (t, o = {}) => ({ text: t, options: { fontSize: 14, color: "203B2B", fill: { color: PAPER }, valign: "middle", border: gapB, margin: [0, 0.15, 0, 0.2], ...o } });
    const data = [
      ["ILO", "How much of each job generative AI could do", "2025 exposure scores (WP 140)", "Next edition"],
      ["Anthropic Economic Index", "Which tasks people really use AI for", "Release of 10 Feb 2025", "Newer release queued"],
      ["METR / Epoch AI", "How fast AI is improving", "Models to 15 Oct 2026", "Jan 2027"],
      ["DOSM", "Job ads by occupation, every quarter", "2026 Q2, published 18 Aug 2026", "17 Nov 2026"],
      ["MyCOL", "Hard-to-fill occupations in Malaysia", "2024/2025 list", "Queued, not loaded yet"],
      ["O*NET", "Role codes and task lists for 89 roles", "As bundled in the Feb 2025 Index", "With the next Index"],
    ];
    const bold = [true, false, true, false];
    const rows = [[hdr("Source"), hdr("What it feeds"), hdr("Latest release in the app"), hdr("Next")].map((c) => ({ ...c, options: { ...c.options, border: [none, none, none, none], margin: [0, 0.15, 0, 0.2] } }))];
    data.forEach((r) => rows.push(r.map((t, i) => cell(t, { bold: i === 0 || i === 2, fontSize: i === 0 ? 16 : 14 }))));
    s.addTable(rows, { objectName: "Sources table", x: M, y: 1.65, w: W, colW: [2.6, 3.8, 3.0, 2.6], rowH: [0.35, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62], fontFace: "Calibri" });
    pill(s, "One command pill", "One command", M, 6.3, 1.9, 0.5, C.accent1, C.background1, 15);
    text(s, "Update note", "Drop in the next workbook and run the build. Open questions settle, the futures re-weight, and every plan recomputes.",
      { x: M + 2.15, y: 6.2, w: W - 2.15, h: 0.7, fontSize: 16, color: C.text1, valign: "middle" });
  }

  // ===== 8 Architecture =====
  {
    const s = mk(7, "LIGHT");
    s.addText("A small, tested stack anyone can rerun", { placeholder: "title" });
    const ws = [1.75, 1.75, 3.5, 1.75, 1.75], gp = 0.375, by = 1.7, bh = 3.05;
    const boxes = [
      ["Public releases", "DOSM workbooks, Epoch AI data, ILO and Anthropic indexes"],
      ["Data pipeline", "Node scripts turn raw downloads into dated JSON snapshots in the repo"],
      ["Engine, pure TypeScript", null],
      ["Next.js 16 app", "React 19, API routes, a hand-drawn SVG map of Malaysia"],
      ["Replit", "Hosted with Postgres and signed sessions. No GPU needed"],
    ];
    let x = M;
    boxes.forEach(([h, body], i) => {
      const eng = i === 2;
      card(s, h + " box", x, by, ws[i], bh, eng ? C.accent1 : C.background2, 0.26);
      text(s, h + " heading", h, { x: x + 0.2, y: by + 0.2, w: ws[i] - 0.4, h: 0.65, fontSize: 16, bold: true, color: eng ? C.background1 : C.text1, valign: "top" });
      if (body) text(s, h + " body", body, { x: x + 0.2, y: by + 0.95, w: ws[i] - 0.4, h: bh - 1.1, fontSize: 14, color: C.text1, valign: "top" });
      if (eng) {
        [["View", "expiry dates, matching, plan"], ["Tape", "live trades and history replay"], ["Market", "LMSR prices, settlement, futures weights"]].forEach(([k, d], j) => {
          const cy2 = by + 0.9 + j * 0.69;
          card(s, k + " chip", x + 0.2, cy2, ws[i] - 0.4, 0.6, C.background2, 0.16);
          text(s, k + " chip text", [{ text: k, options: { bold: true } }, { text: "  ·  " + d }],
            { x: x + 0.35, y: cy2, w: ws[i] - 0.7, h: 0.6, fontSize: 14, color: C.text1, valign: "middle" });
        });
      }
      if (i < 4) {
        const ax = x + ws[i] + gp / 2 - 0.17;
        dot(s, "Flow arrow " + (i + 1), ax, by + bh / 2 - 0.17, 0.34, C.accent2);
        text(s, "Flow arrow glyph " + (i + 1), "›", { x: ax, y: by + bh / 2 - 0.17, w: 0.34, h: 0.34, fontSize: 16, bold: true, color: C.text1, align: "center", valign: "middle" });
      }
      x += ws[i] + gp;
    });
    const fy = 5.0, fh = 1.9, fws = [3.4, 3.4, 4.8];
    card(s, "Tests fact", M, fy, fws[0], fh, C.accent1, 0.26);
    text(s, "Tests number", "81", { x: M + 0.35, y: fy + 0.15, w: 3.0, h: 0.8, fontSize: 44, fontFace: "Cambria", color: C.background1, valign: "middle" });
    text(s, "Tests detail", "tests pass: fairness, market maths, futures, replay, matching, plan and log", { x: M + 0.35, y: fy + 0.98, w: fws[0] - 0.7, h: 0.8, fontSize: 14, color: C.background1, valign: "top" });
    const x2 = M + fws[0] + 0.2;
    card(s, "No-AI fact", x2, fy, fws[1], fh, C.accent4, 0.26);
    text(s, "No-AI number", "0", { x: x2 + 0.35, y: fy + 0.15, w: 3.0, h: 0.8, fontSize: 44, fontFace: "Cambria", color: C.text1, valign: "middle" });
    text(s, "No-AI detail", "AI models at run time. Rules you can read and rerun", { x: x2 + 0.35, y: fy + 0.98, w: fws[1] - 0.7, h: 0.8, fontSize: 14, color: C.text1, valign: "top" });
    const x3 = x2 + fws[1] + 0.2;
    card(s, "Open source fact", x3, fy, fws[2], fh, C.accent2, 0.26);
    text(s, "Open source heading", "Open source, Apache 2.0", { x: x3 + 0.35, y: fy + 0.45, w: fws[2] - 0.7, h: 0.5, fontSize: 20, bold: true, color: C.text1, valign: "middle" });
    text(s, "GitHub link", [{ text: "github.com/yabgzichien/SDCHack-slaynergy", options: { hyperlink: { url: "https://github.com/yabgzichien/SDCHack-slaynergy", tooltip: "Open the repository" } } }],
      { x: x3 + 0.35, y: fy + 1.0, w: fws[2] - 0.7, h: 0.5, fontSize: 14, color: C.text1, valign: "middle" });
  }

  // ===== 9 Humans in control =====
  {
    const s = mk(8, "DARK");
    s.addText("People stay in control at every step", { placeholder: "title" });
    const cw = (W - 0.2) / 2, ch = 2.45;
    const items = [
      ["You choose your path", "Jobbery ranks and explains. It never picks a job for you. Swap any course, switch futures, choose the goals you care about.", "Your call", C.background2],
      ["An advisor, on your terms", "Book a 30-minute meeting any time. The advisor’s advice appears on your plan, and nothing waits for anyone’s approval.", "30-minute slots", C.background2],
      ["Résumés are never stored", "Read in memory for the scan, then dropped. Only the score and the skills you confirm are kept.", "Never saved", C.background2],
      ["Fair by test", "Age, gender and background are never inputs. 42 of 42 profile pairs gave identical rankings and scores.", "Tested on every run", C.accent2],
    ];
    items.forEach(([h, b, tag, fill], i) => {
      const x = M + (i % 2) * (cw + 0.2), y = 1.75 + Math.floor(i / 2) * (ch + 0.2);
      card(s, h + " card", x, y, cw, ch, fill, 0.28);
      text(s, h + " heading", h, { x: x + 0.4, y: y + 0.25, w: cw - 0.8, h: 0.55, fontSize: 24, fontFace: "Cambria", color: C.text1, valign: "top" });
      text(s, h + " detail", b, { x: x + 0.4, y: y + 0.85, w: cw - 0.8, h: 0.9, fontSize: 16, color: C.text1, valign: "top" });
      const tw = 0.4 + tag.length * 0.095;
      pill(s, h + " tag", tag, x + 0.4, y + ch - 0.58, tw, 0.38, i === 3 ? C.text1 : C.accent1, C.background1, 12);
    });
  }

  // ===== 10 Risk and fallback =====
  {
    const s = mk(9, "LIGHT");
    s.addText("The hardest risks, and the fallback for each", { placeholder: "title" });
    const rows = [
      ["Official data comes out rarely", "DOSM publishes once a quarter and Epoch AI about as often, so a live market could sit idle.", "Replay real history", "66 past releases, 2021 Q1 to 2026 Q1, give every forecaster a track record on day one."],
      ["Only a few real forecasters exist so far", "A market with a handful of players tells you little.", "Clearly labelled simulated forecasters", "About 200 fill the market, marked as simulated on every screen. Real ones join in the final round."],
      ["One quarter is hard to call", "In replay the market beats a coin flip only just: Brier 0.242 against 0.25.", "The market re-weights, never replaces", "Expiry dates start from public exposure and adoption data. The three futures stay on screen, labelled as estimates."],
    ];
    const rw = 5.5, fx = M + rw + 0.8, fw = W - rw - 0.8, rh = 1.6;
    rows.forEach(([rh1, rb, fh1, fb], i) => {
      const y = 1.75 + i * (rh + 0.17);
      card(s, "Risk card " + (i + 1), M, y, rw, rh, C.accent6, 0.26);
      text(s, "Risk text " + (i + 1), [{ text: rh1, options: { bold: true, fontSize: 18, breakLine: true } }, { text: rb, options: { fontSize: 14 } }],
        { x: M + 0.3, y: y + 0.15, w: rw - 0.6, h: rh - 0.3, color: CUE_INK, valign: "middle", paraSpaceAfter: 4 });
      dot(s, "Arrow circle " + (i + 1), M + rw + 0.15, y + rh / 2 - 0.25, 0.5, C.accent1);
      text(s, "Arrow glyph " + (i + 1), "›", { x: M + rw + 0.15, y: y + rh / 2 - 0.25, w: 0.5, h: 0.5, fontSize: 22, bold: true, color: C.background1, align: "center", valign: "middle" });
      card(s, "Fallback card " + (i + 1), fx, y, fw, rh, C.accent4, 0.26);
      text(s, "Fallback text " + (i + 1), [{ text: fh1, options: { bold: true, fontSize: 18, breakLine: true } }, { text: fb, options: { fontSize: 14 } }],
        { x: fx + 0.3, y: y + 0.15, w: fw - 0.6, h: rh - 0.3, color: C.text1, valign: "middle", paraSpaceAfter: 4 });
    });
  }

  // ===== 11 Impact and SDGs =====
  {
    const s = mk(10, "MINT");
    s.addText("Who benefits, how we will know, how it grows", { placeholder: "title" });
    const tiles = [[4, "Quality education", "4.4 Skills for decent jobs"], [8, "Decent work", "8.5 Full employment for all"], [10, "Reduced inequalities", "10.2 Inclusion for everyone"]];
    const tw = 2.1, th = 2.0, ty = 1.7;
    tiles.forEach(([n, name, tgt], i) => {
      const x = M + i * (tw + 0.1);
      card(s, "SDG " + n + " tile", x, ty, tw, th, SDG[n], 0.22);
      text(s, "SDG " + n + " number", String(n), { x: x + 0.2, y: ty + 0.1, w: tw - 0.4, h: 0.8, fontSize: 44, bold: true, color: "FFFFFF", valign: "middle" });
      text(s, "SDG " + n + " label", [{ text: name, options: { bold: true, fontSize: 14, breakLine: true } }, { text: tgt, options: { fontSize: 12 } }],
        { x: x + 0.2, y: ty + 0.95, w: tw - 0.4, h: 0.95, color: "FFFFFF", valign: "top", paraSpaceAfter: 2 });
    });
    const lx = M + 3 * (tw + 0.1) + 0.1, lw2 = W - (lx - M);
    card(s, "SDG lead card", lx, ty, lw2, th, PAPER, 0.22);
    text(s, "SDG lead text", "Every role and skill is tagged to an SDG target, and the goals a worker picks change which jobs rank first.",
      { x: lx + 0.3, y: ty + 0.2, w: lw2 - 2.1, h: th - 0.4, fontSize: 16, bold: true, color: C.text1, valign: "middle" });
    s.addImage({ path: BUILD("sdg-blocks.png"), objectName: "SDG blocks mascot", x: lx + lw2 - 1.65, y: ty + 0.2, w: 1.55, h: 1.55 * 1305 / 1205, altText: "Cockatiel mascot on a stack of SDG blocks" });
    const cw = (W - 0.4) / 3, cy = 3.95, ch = 2.95;
    const cols = [
      ["Who benefits", PAPER, ["Laid-off clerks reskill inside their allowance window", "Workers who may move compare jobs, pay and unemployment across 16 states", "Advisors spend a meeting on advice, not intake"]],
      ["How we measure it", C.accent4, ["Plans finished before the deadline", "Weeks from layoff to first interview", "Advisor meetings booked per plan", "Forecast accuracy, scored in public"]],
      ["How it grows", PAPER, ["More occupations beyond finance and admin", "English, Bahasa Malaysia, 中文 and தமிழ் already built in", "Agency advisors and real forecasters"]],
    ];
    cols.forEach(([h, fill, items], i) => {
      const x = M + i * (cw + 0.2);
      card(s, h + " card", x, cy, cw, ch, fill, 0.26);
      text(s, h + " heading", h, { x: x + 0.3, y: cy + 0.2, w: cw - 0.6, h: 0.5, fontSize: 22, fontFace: "Cambria", color: C.text1, valign: "top" });
      text(s, h + " list", bullets(items, { color: C.text1, fontSize: 14 }), { x: x + 0.3, y: cy + 0.8, w: cw - 0.6, h: ch - 0.95, valign: "top" });
    });
  }

  // ===== 12 Roadmap and ask =====
  {
    const s = mk(11, "DARK");
    s.addText("Next: real forecasters, more jobs, real workers", { placeholder: "title" });
    const cw = (W - 0.4) / 3, cy = 1.75, ch = 3.15;
    const cols = [
      ["Final round", C.accent2, ["Real forecasters replace the simulated ones", "Practice tasks for the other nine sectors", "Automatic re-planning when someone falls behind"]],
      ["Then", C.background2, ["More occupations beyond today’s 89 roles", "MyCOL and the next Economic Index loaded", "Low-bandwidth mode for older phones"]],
      ["Team #slaynergy", C.background2, ["Domain 1: Aiversecity Future-Ready Workforce", "Open source on GitHub, Apache 2.0", "Live demo next, 3 minutes"]],
    ];
    cols.forEach(([h, fill, items], i) => {
      const x = M + i * (cw + 0.2);
      card(s, h + " card", x, cy, cw, ch, fill, 0.28);
      text(s, h + " heading", h, { x: x + 0.35, y: cy + 0.25, w: cw - 0.7, h: 0.55, fontSize: 24, fontFace: "Cambria", color: C.text1, valign: "top" });
      text(s, h + " list", bullets(items, { color: C.text1, fontSize: 16 }), { x: x + 0.35, y: cy + 0.95, w: cw - 0.7, h: ch - 1.1, valign: "top" });
    });
    card(s, "Ask band", M, 5.1, W, 1.75, C.text1, 0.28);
    text(s, "Closing ask", "Help us put Jobbery in front of real laid-off workers and real forecasters.",
      { x: M + 0.5, y: 5.1, w: 7.3, h: 1.75, fontSize: 28, fontFace: "Cambria", color: C.background1, valign: "middle" });
    pill(s, "Demo pill", "Demo: 3 minutes", M + 8.3, 5.5, 2.3, 0.5, C.accent2, C.text1, 16);
    text(s, "Repo link", [{ text: "github.com/yabgzichien/SDCHack-slaynergy", options: { hyperlink: { url: "https://github.com/yabgzichien/SDCHack-slaynergy" } } }],
      { x: M + 8.3, y: 6.15, w: 3.4, h: 0.4, fontSize: 13, color: C.accent4, valign: "middle" });
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
