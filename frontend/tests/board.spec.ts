import { test, expect, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

test.beforeEach(() => {
  const databasePath = "/private/tmp/kanban-playwright.db";
  rmSync(databasePath, { force: true });
  execFileSync(".venv/bin/python", ["-c", "from backend.db import initialize; initialize()"], {
    cwd: "..",
    env: { ...process.env, DATABASE_PATH: databasePath },
  });
});

async function signIn(page: Page) {
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Project board" })).toBeVisible();
}

test("requires sign in and supports sign out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project board" })).toHaveCount(0);
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".auth-error")).toContainText("Check your username and password.");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Project board" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Project board" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
});

async function dragCard(page: Page, source: Locator, target: Locator, yOffset = 0) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const start = await source.boundingBox();
  const end = await target.boundingBox();
  if (!start || !end) throw new Error("Drag target missing");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 4 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2 + yOffset, { steps: 20 });
  await page.mouse.up();
  await expect(page.locator(".task-card-overlay")).toHaveCount(0);
}

test("shows one populated board with five columns and one add button per column", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Project board" })).toBeVisible();
  await expect(page.locator(".board-column")).toHaveCount(5);
  await expect(page.locator(".task-card")).toHaveCount(8);
  await expect(page.getByRole("button", { name: /^Add card to / })).toHaveCount(5);
  await expect(page.getByRole("button", { name: "New card" })).toHaveCount(0);
  await expect(page.locator(".add-card-inline")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByText("LIVE BOARD")).toHaveCount(0);
  await expect(page.locator(".topbar-avatar")).toHaveCount(0);
});

test("renames a column and keeps its cards", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name: "Ideas", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Rename Ideas column" });
  await input.fill("Discovery");
  await input.press("Enter");
  await expect(page.getByRole("region", { name: "Discovery column" })).toContainText("Explore visual direction");
});

test("adds and deletes a card", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name: "Add card to To do" }).click();
  await page.getByLabel("Title").fill("Ship the prototype");
  await page.getByLabel("Details").fill("Check the final polish.");
  await page.getByRole("button", { name: "Create card" }).click();
  const todo = page.getByRole("region", { name: "To do column" });
  await expect(todo).toContainText("Ship the prototype");
  await expect(todo).toContainText("Check the final polish.");
  await todo.getByRole("button", { name: "Delete Ship the prototype" }).click();
  await expect(todo).not.toContainText("Ship the prototype");
});

test("reorders cards in the same column", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  const ideas = page.getByRole("region", { name: "Ideas column" });
  await dragCard(page, ideas.getByRole("article", { name: "Explore visual direction" }), ideas.getByRole("article", { name: "Map user journey" }));
  await expect(ideas.locator(".task-card h3")).toHaveText(["Map user journey", "Explore visual direction"]);
  await dragCard(page, ideas.getByRole("article", { name: "Explore visual direction" }), ideas.getByRole("article", { name: "Map user journey" }));
  await expect(ideas.locator(".task-card h3")).toHaveText(["Explore visual direction", "Map user journey"]);
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  const ideas = page.getByRole("region", { name: "Ideas column" });
  const done = page.getByRole("region", { name: "Done column" });
  await dragCard(page, ideas.getByRole("article", { name: "Explore visual direction" }), done, 90);
  await expect(done).toContainText("Explore visual direction");
  await expect(ideas).not.toContainText("Explore visual direction");
});

test("keeps changes after refresh", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name: "Delete Explore visual direction" }).click();
  await expect(page.locator(".task-card")).toHaveCount(7);
  await page.reload();
  await expect(page.locator(".task-card")).toHaveCount(7);
});

test("edits a card and saves it after refresh", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name: "Edit Explore visual direction" }).click();
  await page.getByLabel("Title").fill("Explore a new direction");
  await page.getByLabel("Details").fill("Review updated references.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(page.getByRole("article", { name: "Explore a new direction" })).toContainText("Review updated references.");
});

test("chat answers and updates the board immediately", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  const board = await page.evaluate(async () => (await fetch("/api/board")).json());
  const requests: { message: string; history: unknown[] }[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await route.fulfill({ json: { response: "Eight cards are on the board.", actionsApplied: 0, board } });
    } else {
      const updated = { ...board, cards: board.cards.map((card: { id: string; title: string }) => card.id === "c1" ? { ...card, title: "Fresh direction" } : card) };
      await route.fulfill({ json: { response: "I updated the card.", actionsApplied: 1, board: updated } });
    }
  });
  await page.getByLabel("Ask or make a change").fill("How many cards?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Eight cards are on the board.")).toBeVisible();
  await page.getByLabel("Ask or make a change").fill("Rename the first card");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("article", { name: "Fresh direction" })).toBeVisible();
  await expect(page.getByText("Board updated")).toBeVisible();
  expect(requests[1].history).toHaveLength(2);
});

test("keeps the board usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Make things happen." })).toBeVisible();
  await expect(page.locator(".board-column")).toHaveCount(5);
  await page.getByRole("button", { name: "Add card to Ideas" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
