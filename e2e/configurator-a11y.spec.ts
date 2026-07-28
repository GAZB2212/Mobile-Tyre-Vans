import { test, expect, type Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_SLOT = {
  vanId: null,
  customVanDescription: null,
  customVanValue: null,
  vanReg: null,
  serviceType: null,
  kitId: null,
  upgradeIds: [] as string[],
  upgradeQuantities: {} as Record<string, number>,
  trainingOptionIds: [] as string[],
  financePlanId: null,
  financeInputs: null,
  pricingSnapshot: null,
};

/**
 * Inject minimal configurator state AND suppress the first-visit tutorial
 * dialog so it never blocks pointer events during tests.
 */
async function setConfiguratorState(
  page: Page,
  slotA: Partial<typeof DEFAULT_SLOT> = {}
): Promise<void> {
  const state = {
    slotA: { ...DEFAULT_SLOT, ...slotA },
    slotB: { ...DEFAULT_SLOT },
    compareMode: false,
    activeSlot: "A",
  };

  await page.evaluate((s) => {
    localStorage.setItem("configurator:v6", JSON.stringify(s));
    // Suppress the Joyride tutorial prompt on every page so it never
    // renders a dialog overlay that would block pointer events.
    localStorage.setItem("configurator-tutorial-declined", "true");
    [
      "van",
      "service-type",
      "kit",
      "upgrades",
      "training",
      "finance",
      "quote",
    ].forEach((p) =>
      localStorage.setItem(`configurator-tutorial-${p}-seen`, "true")
    );
  }, state);
}

/**
 * Navigate to the origin, suppress the tutorial, then navigate to the target
 * URL.  This ensures localStorage is seeded before the page is rendered.
 */
async function gotoWithState(
  page: Page,
  url: string,
  slotA: Partial<typeof DEFAULT_SLOT> = {}
): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await setConfiguratorState(page, slotA);
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  // Allow a brief moment for any animations or React effects to settle.
  await page.waitForTimeout(500);
}

/**
 * Press Escape (closes any overlay) and blur the active element so the
 * next Tab press starts from the very top of the document.
 */
async function resetFocus(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.());
}

/**
 * Tab up to `maxTabs` times and return true as soon as the element identified
 * by `testId` receives focus.  Returns false when the cap is reached.
 */
async function tabUntilFocused(
  page: Page,
  testId: string,
  maxTabs = 50
): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const isFocused = await page.evaluate((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      return el !== null && document.activeElement === el;
    }, testId);
    if (isFocused) return true;
  }
  return false;
}

/**
 * Returns true when the currently focused element is a descendant of the
 * element identified by `testId`.
 */
async function focusIsInsideElement(
  page: Page,
  testId: string
): Promise<boolean> {
  return page.evaluate((id) => {
    const container = document.querySelector(`[data-testid="${id}"]`);
    if (!container) return false;
    return container.contains(document.activeElement);
  }, testId);
}

/** Returns true when focus is inside any currently-hidden dialog/modal. */
async function focusIsTrappedInClosedDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) return false;
    let node: HTMLElement | null = active;
    while (node) {
      if (
        node.getAttribute("role") === "dialog" ||
        node.getAttribute("aria-modal") === "true"
      ) {
        const style = window.getComputedStyle(node);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          node.getAttribute("aria-hidden") === "true"
        ) {
          return true;
        }
      }
      node = node.parentElement;
    }
    return false;
  });
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

async function fetchFirstVanId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/vans");
  if (!res.ok()) return null;
  const vans: Array<{ id: string; published: boolean }> = await res.json();
  const published = vans.filter((v) => v.published);
  return published.length > 0 ? published[0].id : null;
}

async function fetchFirstKitId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/kits");
  if (!res.ok()) return null;
  const kits: Array<{ id: string; published: boolean }> = await res.json();
  const published = kits.filter((k) => k.published);
  return published.length > 0 ? published[0].id : null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Configurator — keyboard accessibility", () => {
  // ── Step 1: Select Van ─────────────────────────────────────────────────────

  test("/configurator/van — Tab reaches the 'scroll to own van' button", async ({
    page,
  }) => {
    await gotoWithState(page, "/configurator/van");
    await resetFocus(page);

    const reached = await tabUntilFocused(page, "button-scroll-to-own-van");
    expect(
      reached,
      "Tab order should reach button-scroll-to-own-van within 50 presses"
    ).toBe(true);
  });

  test("/configurator/van — Tab reaches the own-van registration input", async ({
    page,
  }) => {
    await gotoWithState(page, "/configurator/van");
    await resetFocus(page);

    const reached = await tabUntilFocused(page, "input-own-van-reg", 80);
    expect(
      reached,
      "Tab order should reach input-own-van-reg within 80 presses"
    ).toBe(true);
  });

  test("/configurator/van — van info modal: Escape dismissal leaves no focus trap", async ({
    page,
  }) => {
    await gotoWithState(page, "/configurator/van");

    // Find the first "more info" button for any published van.
    const moreInfoBtn = page
      .locator('[data-testid^="button-more-info-"]')
      .first();
    await expect(moreInfoBtn).toBeVisible({ timeout: 10_000 });

    await moreInfoBtn.click();

    // The van detail modal should now appear.
    const modalTitle = page
      .locator('[data-testid^="modal-van-title-"]')
      .first();
    await expect(modalTitle).toBeVisible({ timeout: 5_000 });

    // Dismiss with Escape.
    await page.keyboard.press("Escape");
    await expect(modalTitle).not.toBeVisible({ timeout: 5_000 });

    // Tab twice — focus must NOT be trapped inside the now-closed modal.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    expect(
      await focusIsTrappedInClosedDialog(page),
      "Focus must not be trapped inside a hidden modal after Escape"
    ).toBe(false);
  });

  // ── Step 2: Select Service Type ────────────────────────────────────────────

  test("/configurator/service-type — Tab reaches service type selection cards", async ({
    page,
  }) => {
    await gotoWithState(page, "/configurator/service-type");
    await resetFocus(page);

    const backReached = await tabUntilFocused(page, "button-back-to-van");
    expect(
      backReached,
      "Tab order should reach button-back-to-van within 50 presses"
    ).toBe(true);

    await resetFocus(page);

    const carReached = await tabUntilFocused(
      page,
      "button-select-service-type-car"
    );
    expect(
      carReached,
      "Tab order should reach button-select-service-type-car within 50 presses"
    ).toBe(true);
  });

  // ── Step 3: Select Kit ─────────────────────────────────────────────────────

  test("/configurator/kit — Tab reaches kit controls", async ({ page }) => {
    const vanId = await fetchFirstVanId(page);
    if (!vanId) {
      test.skip(true, "No published vans available to seed configurator state");
      return;
    }

    await gotoWithState(page, "/configurator/kit", { vanId, serviceType: "car" });
    await resetFocus(page);

    const backReached = await tabUntilFocused(page, "button-back");
    expect(
      backReached,
      "Tab order should reach the back button on SelectKit within 50 presses"
    ).toBe(true);
  });

  test("/configurator/kit — Euro6 dialog (or kit info modal): Escape dismissal leaves no focus trap", async ({
    page,
  }) => {
    const vanId = await fetchFirstVanId(page);
    if (!vanId) {
      test.skip(true, "No published vans available");
      return;
    }

    await gotoWithState(page, "/configurator/kit", { vanId, serviceType: "car" });

    // Prefer the incompatible-kit path to test the Euro6 warning dialog.
    const incompatibleBadge = page
      .locator('[data-testid^="badge-incompatible-"]')
      .first();
    const hasIncompatible = await incompatibleBadge
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (hasIncompatible) {
      // Extract the kit ID and click its select button.
      const badgeTestId = await incompatibleBadge.getAttribute("data-testid");
      const id = badgeTestId?.replace("badge-incompatible-", "");
      if (!id) {
        test.skip(true, "Could not extract kit ID from incompatible badge");
        return;
      }

      await page.locator(`[data-testid="button-select-kit-${id}"]`).click();

      const dialog = page.locator('[data-testid="dialog-euro6-warning"]');
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // While open, Tab should keep focus inside the dialog.
      await page.keyboard.press("Tab");
      expect(
        await focusIsInsideElement(page, "dialog-euro6-warning"),
        "While Euro6 dialog is open, Tab should keep focus inside it"
      ).toBe(true);

      // Dismiss and verify no trap remains.
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });

      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      expect(
        await focusIsTrappedInClosedDialog(page),
        "Focus must not be trapped in the closed Euro6 dialog after Escape"
      ).toBe(false);
      return;
    }

    // Fallback: test the kit info modal instead.
    const infoBtn = page.locator('[data-testid^="button-more-info-"]').first();
    const hasInfoBtn = await infoBtn
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!hasInfoBtn) {
      test.skip(true, "No kit info buttons available to test modal dismissal");
      return;
    }

    await infoBtn.click();
    const kitModal = page.locator('[data-testid^="modal-kit-title-"]').first();
    await expect(kitModal).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(kitModal).not.toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    expect(
      await focusIsTrappedInClosedDialog(page),
      "Focus must not be trapped in a closed kit info modal after Escape"
    ).toBe(false);
  });

  // ── Step 4: Select Upgrades ────────────────────────────────────────────────

  test("/configurator/upgrades — Tab reaches the back button", async ({
    page,
  }) => {
    const vanId = await fetchFirstVanId(page);
    const kitId = await fetchFirstKitId(page);

    if (!vanId || !kitId) {
      test.skip(
        true,
        "No published vans or kits available to seed configurator state"
      );
      return;
    }

    await gotoWithState(page, "/configurator/upgrades", {
      vanId,
      serviceType: "car",
      kitId,
    });
    await resetFocus(page);

    const backReached = await tabUntilFocused(page, "button-back");
    expect(
      backReached,
      "Tab order should reach the back button on SelectUpgrades within 50 presses"
    ).toBe(true);
  });

  // ── Step 5: Select Training ────────────────────────────────────────────────

  test("/configurator/training — Tab reaches the continue button", async ({
    page,
  }) => {
    const vanId = await fetchFirstVanId(page);
    const kitId = await fetchFirstKitId(page);

    if (!vanId || !kitId) {
      test.skip(
        true,
        "No published vans or kits available to seed configurator state"
      );
      return;
    }

    await gotoWithState(page, "/configurator/training", {
      vanId,
      serviceType: "car",
      kitId,
    });
    await resetFocus(page);

    const reached = await tabUntilFocused(page, "button-continue");
    expect(
      reached,
      "Tab order should reach button-continue on SelectTraining within 50 presses"
    ).toBe(true);
  });

  // ── Step 6: Select Finance ─────────────────────────────────────────────────

  test("/configurator/finance — Tab reaches the deposit input and continue button", async ({
    page,
  }) => {
    const vanId = await fetchFirstVanId(page);
    const kitId = await fetchFirstKitId(page);

    if (!vanId || !kitId) {
      test.skip(
        true,
        "No published vans or kits available to seed configurator state"
      );
      return;
    }

    await gotoWithState(page, "/configurator/finance", {
      vanId,
      serviceType: "car",
      kitId,
    });
    await resetFocus(page);

    const depositReached = await tabUntilFocused(page, "input-deposit");
    expect(
      depositReached,
      "Tab order should reach input-deposit on SelectFinance within 50 presses"
    ).toBe(true);

    await resetFocus(page);

    const continueReached = await tabUntilFocused(page, "button-continue");
    expect(
      continueReached,
      "Tab order should reach button-continue on SelectFinance within 50 presses"
    ).toBe(true);
  });

  // ── Step 7: Request Quote ──────────────────────────────────────────────────

  test("/configurator/quote — Tab reaches form inputs and the submit button", async ({
    page,
  }) => {
    const vanId = await fetchFirstVanId(page);
    const kitId = await fetchFirstKitId(page);

    if (!vanId || !kitId) {
      test.skip(
        true,
        "No published vans or kits available to seed configurator state"
      );
      return;
    }

    await gotoWithState(page, "/configurator/quote", {
      vanId,
      serviceType: "car",
      kitId,
    });
    await resetFocus(page);

    const nameReached = await tabUntilFocused(page, "input-name");
    expect(
      nameReached,
      "Tab order should reach input-name on RequestQuote within 50 presses"
    ).toBe(true);

    await resetFocus(page);

    const emailReached = await tabUntilFocused(page, "input-email");
    expect(
      emailReached,
      "Tab order should reach input-email on RequestQuote within 50 presses"
    ).toBe(true);

    await resetFocus(page);

    const phoneReached = await tabUntilFocused(page, "input-phone");
    expect(
      phoneReached,
      "Tab order should reach input-phone on RequestQuote within 50 presses"
    ).toBe(true);

    await resetFocus(page);

    const submitReached = await tabUntilFocused(page, "button-submit-quote", 80);
    expect(
      submitReached,
      "Tab order should reach button-submit-quote on RequestQuote within 80 presses"
    ).toBe(true);
  });
});
