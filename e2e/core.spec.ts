import { expect, test } from '@playwright/test';

test('opens the workspace and manages a project scope', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('espera_language', 'en'));
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto('/');
  await expect(page.getByText('Project Espera', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();

  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByLabel('Project name').fill('Browser smoke project');
  await page.getByLabel('What belongs in this project?').fill('Created by Playwright and removed after verification.');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Browser smoke project' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Browser smoke project' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Browser smoke project' })).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test('shows provider settings without persisting a key to Web Storage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('espera_language', 'en'));
  await page.goto('/');
  await page.getByRole('button', { name: /설정|Settings/ }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const storage = await page.evaluate(() => ({ keys: Object.keys(localStorage), values: Object.values(localStorage).join(' ') , session: sessionStorage.length }));
  expect(storage.keys).toEqual(expect.arrayContaining(['espera_language', 'espera_non_secret_preferences']));
  expect(storage.values).not.toContain('must-not-persist');
  expect(storage.session).toBe(0);
});

test('keeps the chat workspace usable on a mobile viewport', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('espera_language', 'en'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('Project Espera', { exact: true }).last()).toBeVisible();
  await expect(page.getByLabel('Open conversations')).toBeVisible();
  await page.getByLabel('Open conversations').click();
  await expect(page.getByText('Conversations', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Close conversations').click();
  await expect(page.getByLabel('Open conversations')).toBeVisible();
  await page.getByLabel('Choose model and project').click();
  await expect(page.getByRole('dialog', { name: 'Choose model and project' })).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Provider')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose model and project' })).toHaveCount(0);
});
