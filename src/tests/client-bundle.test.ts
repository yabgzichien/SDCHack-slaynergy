import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The task cards in engine/pathway.ts hold the quiz's planted mistakes, and plan.ts and view.ts reach them. None of the
// three may end up in the browser bundle: a "use client" file may import their types, never their code.
const ROOT = path.resolve(import.meta.dirname, "../src");
const SERVER_ONLY = ["lib/engine/plan.ts", "lib/engine/pathway.ts", "lib/engine/view.ts"].map((f) => path.join(ROOT, f));

const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []);

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null; // a package
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

// Imports that bring code with them: `import type …` and `export type …` are erased, so they don't count.
function codeImports(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm)) {
    const names = m[2].replace(/^\{|\}$/g, "");
    const allTypes = m[2].startsWith("{") && names.split(",").map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith("type "));
    if (!allTypes) out.push(m[3]);
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push(m[1]);
  for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
  return out.map((s) => resolve(file, s)).filter((x): x is string => !!x);
}

describe("the browser bundle", () => {
  it("never includes the plan, pathway or view engine code (the quiz's planted mistakes stay on the server)", () => {
    const clients = files(ROOT).filter((f) => /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8")));
    expect(clients.length).toBeGreaterThan(10);
    const bad: string[] = [];
    for (const start of clients) {
      const seen = new Set<string>(), stack = [[start]];
      while (stack.length) {
        const chain = stack.pop()!, f = chain[chain.length - 1];
        if (seen.has(f)) continue;
        seen.add(f);
        if (SERVER_ONLY.includes(f)) { bad.push(chain.map((x) => path.relative(ROOT, x)).join(" → ")); continue; }
        for (const next of codeImports(f)) stack.push([...chain, next]);
      }
    }
    expect(bad).toEqual([]);
  });
});
