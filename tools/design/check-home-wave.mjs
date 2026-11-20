import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "./node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE,
  headless: true,
  chromiumSandbox: true,
});
const base = process.env.SHELL_PREVIEW_URL ?? "http://127.0.0.1:5173",
  artifacts = ".cache/home-wave";
await mkdir(artifacts, { recursive: true });
async function open(options = {}) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    ...options,
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("wave-seeded")) {
      localStorage.setItem("wave-seeded", "1");
      localStorage.setItem(
        "re.data.main:research-engine-v1",
        JSON.stringify({
          state: {
            settings: {
              onboarded: true,
              theme: "dark",
              reduceMotion: false,
              homeWelcomeCard: false,
              updates: { autoCheck: false },
            },
          },
          version: 0,
        }),
      );
    }
  });
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.goto(`${base}/#/settings`);
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.locator(".re-treatment").scrollIntoViewIfNeeded();
  return page;
}
try {
  const page = await open(),
    errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith(base) &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  assert.equal(await page.locator("[data-distortion-wave]").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((e) => /HomeTreatmentWave|distortion-waves/.test(e.name)),
    ),
    false,
    "No wave module before opt-in",
  );
  await page
    .getByRole("switch", { name: "Wave confirmation", exact: true })
    .click();
  await page.locator("[data-distortion-wave]").waitFor();
  assert.equal(
    await page
      .locator(
        "[data-distortion-wave] button, [data-distortion-wave] input, [data-distortion-wave] img",
      )
      .count(),
    0,
    "No controls/images in capture boundary",
  );
  const apply = page.getByRole("button", {
    name: "Apply Home treatment",
    exact: true,
  });
  assert.equal(await apply.isDisabled(), true);
  await page
    .getByRole("radio", { name: "Blue welcome card", exact: true })
    .check();
  assert.equal(
    await page
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    false,
    "Choice does not save before Apply",
  );
  await apply.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    true,
    "Real setting saved at confirmation",
  );
  await page
    .locator("[data-distortion-wave] canvas")
    .waitFor({ state: "attached" });
  assert.equal(
    await apply.evaluate((el) => el === document.activeElement),
    true,
    "Apply stays live/focused outside effect",
  );
  await page.waitForTimeout(250);
  await page
    .locator(".re-treatment")
    .screenshot({ path: `${artifacts}/apply-wave.png` });
  await page
    .getByRole("radio", { name: "Plain headline", exact: true })
    .check();
  await apply.click();
  assert.equal(
    await page
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    false,
    "Reverse Apply commits immediately",
  );
  await page
    .getByRole("radio", { name: "Blue welcome card", exact: true })
    .check();
  await apply.click();
  await page.waitForTimeout(1800);
  await page
    .locator(".re-treatment")
    .screenshot({ path: `${artifacts}/applied.png` });
  // Simulated context loss settles to the saved setting; no rollback/capture retry.
  await page
    .locator("[data-distortion-wave] canvas")
    .evaluate((el) =>
      el.dispatchEvent(
        new Event("webglcontextlost", { bubbles: true, cancelable: true }),
      ),
    );
  await page.getByText("Wave unavailable:", { exact: false }).waitFor();
  assert.equal(await page.locator("[data-distortion-wave]").count(), 0);
  assert.equal(
    await page
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    true,
  );
  await page.reload();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.locator(".re-treatment").scrollIntoViewIfNeeded();
  assert.equal(
    await page
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    true,
    "Persists on reload",
  );
  assert.equal(
    await page
      .getByRole("switch", { name: "Wave confirmation", exact: true })
      .isChecked(),
    false,
    "Effect opt-in resets",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .locator(".re-treatment")
    .screenshot({ path: `${artifacts}/mobile.png` });
  const reduced = await open({ reducedMotion: "reduce" });
  assert.equal(
    await reduced
      .getByRole("switch", { name: "Wave confirmation", exact: true })
      .isDisabled(),
    true,
  );
  await reduced
    .getByRole("radio", { name: "Blue welcome card", exact: true })
    .check();
  await reduced.getByRole("button", { name: "Apply Home treatment" }).click();
  assert.equal(
    await reduced
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    true,
  );
  assert.equal(
    await reduced.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((e) => /HomeTreatmentWave|distortion-waves/.test(e.name)),
    ),
    false,
  );
  const unavailable = await open();
  await unavailable.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl2" ? null : original.call(this, type, ...args);
    };
  });
  await unavailable
    .getByRole("switch", { name: "Wave confirmation", exact: true })
    .click();
  await unavailable.getByText("Wave unavailable:", { exact: false }).waitFor();
  await unavailable
    .getByRole("radio", { name: "Blue welcome card", exact: true })
    .check();
  await unavailable
    .getByRole("button", { name: "Apply Home treatment" })
    .click();
  assert.equal(
    await unavailable
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    true,
  );
  assert.equal(await unavailable.locator("[data-distortion-wave]").count(), 0);
  const dynamic = await open();
  await dynamic
    .getByRole("switch", { name: "Wave confirmation", exact: true })
    .click();
  await dynamic.locator("[data-distortion-wave]").waitFor();
  await dynamic.emulateMedia({ reducedMotion: "reduce" });
  await dynamic
    .locator("[data-distortion-wave]")
    .waitFor({ state: "detached" });
  assert.equal(
    await dynamic
      .getByRole("switch", { name: "Wave confirmation", exact: true })
      .isDisabled(),
    true,
  );
  await dynamic
    .getByRole("radio", { name: "Blue welcome card", exact: true })
    .check();
  await dynamic.getByRole("button", { name: "Apply Home treatment" }).click();
  assert.equal(
    await dynamic
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    true,
  );
  await dynamic.close();
  const loadFailure = await open();
  await loadFailure.route("**/HomeTreatmentWave.tsx*", (route) =>
    route.abort(),
  );
  await loadFailure
    .getByRole("switch", { name: "Wave confirmation", exact: true })
    .click();
  await loadFailure.getByText("Wave unavailable:", { exact: false }).waitFor();
  await loadFailure
    .getByRole("radio", { name: "Blue welcome card", exact: true })
    .check();
  await loadFailure
    .getByRole("button", { name: "Apply Home treatment" })
    .click();
  assert.equal(
    await loadFailure
      .getByRole("switch", { name: "Blue welcome card", exact: true })
      .isChecked(),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS Home Waves: explicit lazy opt-in, synthetic-only boundary, choice vs immediate confirmed persistence, actual WebGL canvas, reverse/reapply, live Apply focus, context-loss/no rollback, reload, mobile/no overflow, reduced-motion/no import, unavailable WebGL fallback, no page errors or external requests. Artifacts:",
    artifacts,
  );
} finally {
  await browser.close();
}
