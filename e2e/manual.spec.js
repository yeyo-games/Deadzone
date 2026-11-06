// El entrenamiento obligatorio de la primera partida y el manual encadenado del menú.
import { expect, test } from '@playwright/test';
import { abrir, esperarEstado, jugarSolo } from './helpers.js';

test('la primera partida empieza con el entrenamiento y la oleada espera', async ({ page }) => {
  // en WebKit headless el reloj del juego va lento (cada paso espera un momento al cumplirse)
  test.setTimeout(180_000);
  const errores = await abrir(page, '/index.html', '#btn-start', { tuto: true });
  // sin entrenamiento no se entra en línea
  await page.locator('#btn-online').click();
  await expect.poll(() => page.evaluate(() => window.__deadzone.state)).toMatch(/^(class|play)$/);
  await page.evaluate(() => window.__deadzone.setupMenu());
  await jugarSolo(page);
  await expect(page.locator('#tuto')).toBeVisible();
  await expect(page.locator('#tuto-t')).toHaveText('Muévete');
  // caminar suma distancia y correr suma tiempo (en WebKit headless el reloj del juego va lento:
  // se comprueba que avanza y luego se completa)
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.evaluate(() => window.__deadzone.tuto.s.dist)).toBeGreaterThan(5);
  await page.evaluate(() => {
    window.__deadzone.tuto.s.dist = 999;
  });
  await expect(page.locator('#tuto-t')).toHaveText('Corre', { timeout: 20000 });
  await page.keyboard.down('ShiftLeft');
  await expect.poll(() => page.evaluate(() => window.__deadzone.tuto.s.run)).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__deadzone.tuto.s.run = 99;
  });
  await expect(page.locator('#tuto-t')).toHaveText('Dispara', { timeout: 20000 });
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyD');
  // la oleada 1 no llega mientras dura
  expect(await page.evaluate(() => window.__deadzone.director.wave)).toBe(0);
  // el resto de los pasos (se cumplen por código para no depender de la puntería)
  await page.evaluate(() => {
    const g = window.__deadzone;
    for (const z of g.horde.list) z.dead = true;
  });
  await expect(page.locator('#tuto-t')).toHaveText('Recarga', { timeout: 20000 });
  await page.keyboard.press('KeyR');
  await expect(page.locator('#tuto-t')).toHaveText('Construye', { timeout: 20000 });
  await page.evaluate(() => {
    const g = window.__deadzone;
    const p = g.player;
    for (let a = 0; a < 6.3; a += 0.4)
      if (g.structures.place(g, 'wood', null, p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, false)) break;
  });
  await expect(page.locator('#tuto-t')).toHaveText('Lanza una granada', { timeout: 20000 });
  await page.evaluate(() => {
    const g = window.__deadzone;
    g.inv.grenade = 0;
    for (const z of g.horde.list) z.dead = true;
  });
  await expect(page.locator('#tuto-ok')).toBeVisible({ timeout: 20000 });
  await page.locator('#tuto-ok').click();
  await expect(page.locator('#tuto')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('dz-tuto'))).toBe('true');
  await page.evaluate(() => {
    window.__deadzone.director.timer = 0;
  });
  await expect.poll(() => page.evaluate(() => window.__deadzone.director.wave), { timeout: 20000 }).toBe(1);
  expect(errores).toEqual([]);
});

test('el manual: se rompen las cadenas, se abre y se pasan las hojas', async ({ page }) => {
  test.setTimeout(120_000);
  const errores = await abrir(page);
  await page.locator('#btn-manual').click();
  await esperarEstado(page, 'manual');
  await expect(page.locator('#tome-nav')).toBeHidden();
  await page.locator('#tome').click();
  // la apertura dura unos 5 s de juego (en WebKit headless el reloj va lento)
  await expect(page.locator('#tome')).toHaveClass(/open/, { timeout: 60000 });
  await expect(page.locator('#tome-nav')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#tome-pn')).toHaveText(/^1 \//);
  await page.locator('#tome-next').click();
  await expect(page.locator('#tome-pn')).toHaveText(/^2 \//);
  // una sola página por toque: la siguiente es la del caminante, completa
  await expect(page.locator('#pg-right h3')).toHaveText('Caminante');
  await expect(page.locator('#pg-right')).toContainText('Debilidades');
  // del índice al demonio rojo
  await page.locator('#tome-prev').click();
  await expect(page.locator('#tome-pn')).toHaveText(/^1 \//);
  await page.locator('#pg-right [data-go]', { hasText: 'Demonio rojo' }).click();
  await expect(page.locator('#pg-right h3')).toHaveText('Demonio rojo');
  await expect(page.locator('#pg-right')).toContainText('fuego');
  await page.keyboard.press('Escape');
  await esperarEstado(page, 'menu');
  expect(errores).toEqual([]);
});

test('repetir el entrenamiento no borra la partida guardada', async ({ page }) => {
  test.setTimeout(120_000);
  const errores = await abrir(page);
  // una partida guardada cualquiera de esta cuenta
  const key = await page.evaluate(() => {
    const k = window.__deadzone.accounts.saveKey();
    localStorage.setItem(k, JSON.stringify({ guardada: true }));
    return k;
  });
  await page.locator('#btn-tuto').click();
  await expect(page.locator('#class-cards.ready')).toBeVisible();
  await page.locator('#class-cards .card').first().click();
  await esperarEstado(page, 'play');
  await expect(page.locator('#tuto')).toBeVisible();
  expect(await page.evaluate(() => window.__deadzone.mode.savesProgress())).toBe(false);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toContain('guardada');
  // en la práctica no se muere
  await page.evaluate(() => {
    window.__deadzone.player.hp = 1;
  });
  await expect.poll(() => page.evaluate(() => window.__deadzone.player.hp)).toBeGreaterThan(1);
  // al terminarla vuelve al menú y la partida sigue ahí
  await page.evaluate(() => {
    const g = window.__deadzone;
    g.tuto.i = 6;
    g.tuto.s = { ok: true };
  });
  await esperarEstado(page, 'menu');
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toContain('guardada');
  await expect(page.locator('#btn-continue')).toBeVisible();
  expect(errores).toEqual([]);
});
