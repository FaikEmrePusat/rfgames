import { test, expect } from '@playwright/test';

test('hub + kapmaca lobby smoke', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: /Oyun seç/i })).toBeVisible();
  await page.getByRole('button', { name: /Kare Kapmaca/i }).click();

  await expect(page.getByRole('button', { name: 'Yerel oyun' })).toBeVisible();
  await page.getByRole('button', { name: /Haritayı çiz ve başla/i }).click();

  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('hub + katla-çiz lobby', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Katla-Çiz/i }).click();
  await expect(page.getByRole('heading', { name: /Katla-Çiz/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /Kağıdı ser/i }).click();
  await expect(page.locator('canvas.fold-canvas')).toBeVisible({ timeout: 10_000 });
});
