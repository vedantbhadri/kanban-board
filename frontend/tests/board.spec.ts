import { test, expect, type Locator, type Page } from "@playwright/test";

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
  await page.getByRole("button", { name: "Ideas", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Rename Ideas column" });
  await input.fill("Discovery");
  await input.press("Enter");
  await expect(page.getByRole("region", { name: "Discovery column" })).toContainText("Explore visual direction");
});

test("adds and deletes a card", async ({ page }) => {
  await page.goto("/");
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
  const ideas = page.getByRole("region", { name: "Ideas column" });
  await dragCard(page, ideas.getByRole("article", { name: "Explore visual direction" }), ideas.getByRole("article", { name: "Map user journey" }));
  await expect(ideas.locator(".task-card h3")).toHaveText(["Map user journey", "Explore visual direction"]);
  await dragCard(page, ideas.getByRole("article", { name: "Explore visual direction" }), ideas.getByRole("article", { name: "Map user journey" }));
  await expect(ideas.locator(".task-card h3")).toHaveText(["Explore visual direction", "Map user journey"]);
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  const ideas = page.getByRole("region", { name: "Ideas column" });
  const done = page.getByRole("region", { name: "Done column" });
  await dragCard(page, ideas.getByRole("article", { name: "Explore visual direction" }), done, 90);
  await expect(done).toContainText("Explore visual direction");
  await expect(ideas).not.toContainText("Explore visual direction");
});

test("keeps changes in memory only", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Delete Explore visual direction" }).click();
  await expect(page.locator(".task-card")).toHaveCount(7);
  await page.reload();
  await expect(page.locator(".task-card")).toHaveCount(8);
});

test("keeps the board usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make things happen." })).toBeVisible();
  await expect(page.locator(".board-column")).toHaveCount(5);
  await page.getByRole("button", { name: "Add card to Ideas" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
