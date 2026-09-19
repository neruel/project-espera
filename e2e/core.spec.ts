import { expect, test } from '@playwright/test';

test('opens the workspace and manages a project scope', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto('/');
  await expect(page.getByText('Project Espera')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();

  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByPlaceholder('Project name').fill('Browser smoke project');
  await page.getByPlaceholder('What belongs in this project?').fill('Created by Playwright and removed after verification.');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Browser smoke project' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Browser smoke project' }).click();
  await expect(page.getByRole('heading', { name: 'Browser smoke project' })).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test('shows provider settings without persisting a key to Web Storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /설정|Settings/ }).click();
  await expect(page.getByRole('heading', { name: 'Provider connections' })).toBeVisible();
  const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  expect(storage.local).toBeLessThanOrEqual(1);
  expect(storage.session).toBe(0);
});
