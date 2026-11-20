import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "./node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE,
  headless: true,
  chromiumSandbox: true,
});
const base = process.env.COMPARISON_URL ?? "http://127.0.0.1:5180",
  artifacts = ".cache/design-comparison";
await mkdir(artifacts, { recursive: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    }),
    errors = [],
    external = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    requests.push(r.url());
    if (
      !r.url().startsWith(base) &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Room to think. Less in the way." })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    requests.some(
      (url) => url.includes("WaveSample") || url.includes("distortion-waves"),
    ),
    false,
    "No Waves module before opt in",
  );
  const close = page.getByRole("button", { name: "Close sample sidebar" });
  await close.click();
  await page.waitForTimeout(220);
  assert.equal(await page.locator("#sample-sidebar").getAttribute("inert"), "");
  await page.getByRole("button", { name: "Open sample sidebar" }).click();
  await page.waitForTimeout(250);
  assert.equal(
    await page.locator("#sample-sidebar").getAttribute("inert"),
    null,
  );
  for (let i = 0; i < 6; i++)
    await page.locator(".workspace-bar button").click({ delay: 15 });
  await page.waitForTimeout(230);
  assert.equal(
    await page.locator(".workspace-bar button").getAttribute("aria-expanded"),
    "true",
  );
  await page.getByLabel("Sample content state").selectOption("empty");
  assert.equal(await page.getByText("No sample notes yet").isVisible(), true);
  await page.getByLabel("Sample content state").selectOption("error");
  await page.getByRole("button", { name: "Restore sample" }).click();
  for (const name of ["Geist Rounded", "Newsreader", "Inter baseline"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByLabel("Ligatures", { exact: true }).check();
  await page.getByLabel("Ligatures", { exact: true }).uncheck();
  await page.screenshot({ path: `${artifacts}/desktop.png`, fullPage: true });
  await page.getByLabel("Enable Waves trial").check();
  await page.locator("[data-distortion-wave]").waitFor();
  await page.getByRole("button", { name: "Preview clay" }).click();
  await page.waitForTimeout(1800);
  assert.ok(
    (await page.locator("[data-distortion-wave] canvas").count()) > 0,
    "Waves WebGL canvas created",
  );
  await page.getByLabel("Motion off", { exact: true }).check();
  assert.equal(await page.locator("[data-distortion-wave]").count(), 0);
  await page.getByLabel("Light surface").check();
  await page.getByLabel("Opaque material").check();
  await page.screenshot({
    path: `${artifacts}/light-opaque.png`,
    fullPage: true,
  });
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await mobile.goto(base);
  await mobile.getByRole("button", { name: "Open sample sidebar" }).click();
  await mobile.getByRole("dialog").waitFor();
  await mobile.keyboard.press("Escape");
  assert.equal(
    await mobile
      .getByRole("button", { name: "Open sample sidebar" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await mobile.getByRole("button", { name: "Open sample sidebar" }).click();
  await mobile.getByRole("button", { name: "Board", exact: true }).click();
  assert.equal(
    await mobile.locator(".workspace-bar button").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "No narrow overflow",
  );
  await mobile.screenshot({ path: `${artifacts}/mobile.png`, fullPage: true });
  const reduced = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await reduced.goto(base);
  await reduced.getByText("System reduced motion respected").waitFor();
  assert.equal(
    await reduced.getByLabel("Enable Waves trial").isDisabled(),
    true,
  );
  await reduced.getByRole("button", { name: "Preview clay" }).click();
  assert.equal(await reduced.locator("[data-distortion-wave]").count(), 0);
  await reduced.getByRole("button", { name: "Close sample sidebar" }).click();
  assert.equal(
    await reduced.locator("#sample-sidebar").getAttribute("inert"),
    "",
  );
  // 200% equivalent layout width plus text scaling, without pretending device testing.
  await page.setViewportSize({ width: 720, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl2" ? null : original.call(this, type, ...args);
    };
  });
  await unsupported.goto(base);
  await unsupported.getByLabel("Enable Waves trial").click();
  await unsupported
    .getByText("Waves unavailable. Colour preview still works.")
    .waitFor();
  await unsupported.getByRole("button", { name: "Preview clay" }).click();
  assert.equal(await unsupported.locator("[data-distortion-wave]").count(), 0);
  const lost = await browser.newPage();
  await lost.goto(base);
  await lost.getByLabel("Enable Waves trial").check();
  await lost.locator("[data-distortion-wave]").waitFor();
  await lost.getByRole("button", { name: "Preview clay" }).click();
  await lost
    .locator("[data-distortion-wave] canvas")
    .first()
    .waitFor({ state: "attached" });
  await lost
    .locator("[data-distortion-wave] canvas")
    .first()
    .evaluate((canvas) =>
      canvas.dispatchEvent(
        new Event("webglcontextlost", { bubbles: true, cancelable: true }),
      ),
    );
  await lost
    .getByText("Waves unavailable. Colour preview still works.")
    .waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS comparison: desktop/rapid reversal, inert hidden navigation, empty/error states, fonts/ligatures, lazy actual Waves canvas, motion-off unmount, light/opaque, no storage/external requests, mobile Escape/focus/route close/no overflow, system reduced motion. Screenshots:",
    artifacts,
  );
} finally {
  await browser.close();
}
