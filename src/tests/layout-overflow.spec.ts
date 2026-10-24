import { expect, test, type Page } from "@playwright/test";

const languages = ["en", "ms", "zh", "ta"] as const;
const viewports = [
  { name: "mobile", width: 320, height: 800 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1366, height: 900 },
] as const;

const staticRoutes = [
  "/", "/about", "/advisor", "/changes", "/counsellor", "/courses",
  "/forecast", "/futures", "/goals", "/jobs", "/jobs/all", "/leaderboard",
  "/map", "/market", "/plan", "/plan/resume", "/plan/task", "/profile",
  "/radar", "/resume", "/skills", "/sources", "/start", "/trends", "/trust",
] as const;

type AppSeed = { jobId: string; marketId: string };

async function seedApp(page: Page, language: typeof languages[number]): Promise<AppSeed> {
  await page.goto("/");
  const seeded = await page.evaluate(async ({ language }) => {
    localStorage.setItem("jobbery-lang", language);
    window.dispatchEvent(new Event("jobbery-lang"));
    const start = await fetch("/api/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "startPersona", personaId: "hafiz" }),
    }).then((response) => response.json());
    const jobId = start.view.matches[0].roleId as string;
    const marketId = start.view.world.events[0].id as string;
    await fetch("/api/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "chooseRole", roleId: jobId }),
    });
    return { jobId, marketId };
  }, { language });
  return seeded;
}

async function textOverflow(page: Page) {
  return page.locator("#main").evaluate((main) => {
    const textSelector = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,blockquote";
    const tolerance = 1;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const hasScrollingAncestor = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== main) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
        parent = parent.parentElement;
      }
      return false;
    };
    return [...main.querySelectorAll(textSelector)]
      .filter((element) => visible(element) && !hasScrollingAncestor(element))
      .flatMap((element) => {
        const node = element as HTMLElement;
        if (node.scrollWidth <= node.clientWidth + tolerance) return [];
        const text = (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
        return [{ tag: node.tagName.toLowerCase(), text, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }];
      });
  });
}

for (const viewport of viewports) {
  for (const language of languages) {
    test(`${viewport.name}: every route contains ${language} text`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const { jobId, marketId } = await seedApp(page, language);
      const routes = [
        ...staticRoutes,
        `/jobs/${encodeURIComponent(jobId)}`,
        `/market/${encodeURIComponent(marketId)}`,
        "/badge/layout-check-missing",
      ];

      for (const route of routes) {
        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(response?.status(), `${route} should load`).toBeLessThan(400);
        await page.locator("#main").waitFor();
        await page.waitForFunction(() => !document.querySelector('#main [aria-busy="true"]'), undefined, { timeout: 5_000 }).catch(() => undefined);
        await page.evaluate(() => document.fonts.ready);

        const horizontalOverflow = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          page: document.documentElement.scrollWidth,
        }));
        expect(horizontalOverflow.page, `${route} should not widen the page`).toBeLessThanOrEqual(horizontalOverflow.viewport + 1);
        expect(await textOverflow(page), `${route} should contain all text`).toEqual([]);
      }
    });
  }
}
