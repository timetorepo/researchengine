import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "./node_modules/playwright-core/index.mjs";
const base = process.env.SHELL_PREVIEW_URL ?? "http://127.0.0.1:5173",
  artifacts = ".cache/approved-design";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE,
  headless: true,
  chromiumSandbox: true,
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem("re-approved-seed")) {
      localStorage.setItem("re-approved-seed", "1");
      localStorage.setItem(
        "re.data.main:research-engine-v1",
        JSON.stringify({
          state: {
            settings: {
              onboarded: true,
              typeface: "inter",
              compact: true,
              theme: "dark",
              reduceMotion: false,
              showMusicControl: false,
              updates: { autoCheck: false },
            },
          },
          version: 0,
        }),
      );
    }
  });
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.goto(`${base}/#/`);
  await page.getByRole("button", { name: "Settings", exact: true }).waitFor();
  await page.waitForFunction(
    () => document.documentElement.dataset.typeface === "inter",
  );
  assert.equal(
    await page.locator(".re-home-welcome").count(),
    0,
    "Saved UI defaults unchanged",
  );
  assert.equal(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((e) =>
          /home-blue|fonts\/editorial|distortion-waves/.test(e.name),
        ),
    ),
    false,
    "No opt-in artwork/fonts/Waves startup request",
  );
  const surface = page.locator("#re-desktop-sidebar [data-sidebar-surface]");
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  assert.equal(Math.round((await surface.boundingBox()).width), 60);
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.waitForTimeout(230);
  assert.equal(Math.round((await surface.boundingBox()).width), 248);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Collapse sidebar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand sidebar", exact: true })
      .click();
  }
  await surface.evaluate((el) =>
    Promise.all(
      el.getAnimations().map((animation) => animation.finished.catch(() => {})),
    ),
  );
  assert.equal(
    await surface.evaluate((el) => getComputedStyle(el).transform),
    "none",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByRole("button", { name: "Appearance", exact: true }).click();
  const welcome = page.getByRole("switch", {
    name: "Blue welcome card",
    exact: true,
  });
  await welcome.scrollIntoViewIfNeeded();
  await welcome.click();
  const editorial = page.getByRole("switch", {
    name: "Editorial welcome heading",
    exact: true,
  });
  await editorial.click();
  const family = page.getByRole("combobox", {
    name: "Font family",
    exact: true,
  });
  await family.click();
  await page
    .getByRole("option", { name: "Geist Rounded", exact: true })
    .click();
  const code = page.getByRole("combobox", {
    name: "Rendered code font",
    exact: true,
  });
  await code.click();
  await page.getByRole("option", { name: "Lilex", exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.codeTypeface === "lilex",
  );
  assert.equal(
    await page.locator("html").getAttribute("data-code-ligatures"),
    "off",
  );
  await page
    .getByRole("switch", { name: "Code ligatures", exact: true })
    .click();
  assert.equal(
    await page.locator("html").getAttribute("data-code-ligatures"),
    "on",
  );
  await page
    .getByRole("switch", { name: "Code ligatures", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await page.locator(".re-home-welcome-art").evaluate((el) => el.decode());
  await page.evaluate(() => document.fonts.ready);
  assert.ok(
    await page.evaluate(
      async () =>
        (await document.fonts.load('400 14px "Geist Rounded"')).length > 0,
    ),
  );
  assert.ok(
    await page.evaluate(
      async () =>
        (await document.fonts.load('400 14px "Lilex Variable"')).length > 0,
    ),
  );
  assert.ok(
    await page.evaluate(
      async () =>
        (await document.fonts.load('400 32px "Newsreader Variable"')).length >
        0,
    ),
  );
  await page
    .getByRole("button", { name: "Start a question", exact: true })
    .click();
  assert.equal(
    await page
      .locator("[data-home-composer] textarea")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.screenshot({ path: `${artifacts}/home-desktop.png` });
  await page.reload();
  await page
    .getByRole("button", { name: "Start a question", exact: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.typeface === "geist-rounded" &&
      document.documentElement.dataset.codeTypeface === "lilex",
  );
  assert.equal(
    await page.locator(".re-home-editorial-heading").count(),
    1,
    "Optional settings survive reload",
  );
  await page.getByRole("button", { name: "Open Board", exact: true }).click();
  await page.waitForURL("**/#/board");
  assert.equal(await page.locator(".re-home-welcome").count(), 0);
  await page.evaluate(() => {
    location.hash = "/";
  });
  await page
    .getByRole("button", { name: "Start a question", exact: true })
    .waitFor();
  await page.evaluate(async () => {
    const { useStore } = await import("/src/stores/useStore.ts");
    useStore.setState((s) => ({
      settings: { ...s.settings, reduceMotion: true, theme: "light" },
    }));
  });
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  assert.equal(
    await surface.evaluate(
      (el) =>
        el
          .getAnimations()
          .filter((animation) =>
            animation.effect?.getKeyframes().some((frame) => frame.transform),
          ).length,
    ),
    0,
    "Reduced motion skips sidebar animation",
  );
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: `${artifacts}/home-mobile-light.png` });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const mobileNav = page.getByRole("dialog", {
    name: "Navigation",
    exact: true,
  });
  await mobileNav.waitFor();
  await page.keyboard.press("Escape");
  await mobileNav.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Open menu", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.evaluate(async () => {
    const { useStore } = await import("/src/stores/useStore.ts");
    useStore.setState((s) => ({
      settings: { ...s.settings, reduceMotion: false },
    }));
  });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await mobileNav.waitFor();
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await mobileNav.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await surface.evaluate((el) =>
    Promise.all(
      el.getAnimations().map((animation) => animation.finished.catch(() => {})),
    ),
  );
  assert.equal(
    Math.round((await surface.boundingBox()).width),
    248,
    "Desktop ref still works after mobile sheet teardown",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  assert.equal(
    await surface.evaluate(
      (el) =>
        el
          .getAnimations()
          .filter((animation) =>
            animation.effect?.getKeyframes().some((frame) => frame.transform),
          ).length,
    ),
    0,
    "OS motion preference respected",
  );

  await page.route("**/art/home-blue.webp", (route) => route.abort());
  await page.reload();
  await page.locator(".re-home-welcome[data-art=false]").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Start a question" }).isVisible(),
    true,
  );
  assert.equal(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((e) => /distortion-waves/.test(e.name)),
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS approved production design: defaults/no eager artwork or new fonts, collapse/expand/rapid settle, actual settings and persistence, three local fonts, ligatures off/opt-in, focus action, real Board route, reduced-motion bypass, mobile/light/no overflow, image failure, no Waves import or page errors. Screenshots:",
    artifacts,
  );
} finally {
  await browser.close();
}
