import { test, expect } from '@playwright/test';
const sq=(p,s)=>p.locator(`[data-square="${s}"]`);
async function move(p,from,to) { await sq(p,from).click();await sq(p,to).click(); }
test('local legal moves, history, keyboard, flip, draw and responsive board',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.square')).toHaveCount(64);
 await sq(page,'e2').click();await expect(sq(page,'e3')).toHaveClass(/legal/);await expect(sq(page,'e4')).toHaveClass(/legal/);
 await sq(page,'e5').click();await expect(sq(page,'e2')).toHaveAttribute('aria-label',/White Pawn/);
 await move(page,'e2','e4');await expect(page.locator('#turn-label')).toHaveText('BLACK TO MOVE');
 await move(page,'e7','e5');await expect(page.locator('#history')).toContainText('e4');await expect(page.locator('#history')).toContainText('e5');
 await page.locator('#flip').click();await expect(page.locator('.square').first()).toHaveAttribute('data-square','h1');
 await sq(page,'g1').focus();await page.keyboard.press('Enter');await expect(sq(page,'f3')).toHaveClass(/legal/);await page.keyboard.press('Escape');
 await page.locator('#draw').click();await page.locator('#accept-draw').click();await expect(page.locator('#game-detail')).toHaveText('Draw by agreement');
 await page.locator('#rematch').click();await expect(page.locator('#move-count')).toHaveText('0 moves');
 await page.screenshot({path:'../chess-evolved-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#board')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'../chess-evolved-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('online room using real PeerJS cloud: synchronized moves and rematch',async({browser})=>{
 const context=await browser.newContext();const host=await context.newPage();const guest=await context.newPage();
 await host.goto('/');await guest.goto('/');await host.locator('#online').click();await host.locator('#host').click();
 await expect(host.locator('#network-status')).toHaveText('Waiting for a friend',{timeout:25000});
 const code=await host.locator('#room-code').textContent();await guest.locator('#online').click();await guest.locator('#room-input').fill(code);await guest.locator('#join').click();
 await expect(host.locator('#connection-badge')).toHaveText('CONNECTED',{timeout:25000});await expect(guest.locator('#connection-badge')).toHaveText('CONNECTED',{timeout:25000});
 await move(guest,'e7','e5');await expect(guest.locator('#move-count')).toHaveText('0 moves');
 await move(host,'e2','e4');await expect(guest.locator('#history')).toContainText('e4');
 await move(guest,'e7','e5');await expect(host.locator('#history')).toContainText('e5');
 await host.locator('#draw').click();await expect(guest.locator('#draw-response')).toBeVisible();await guest.locator('#decline-draw').click();await expect(host.locator('#draw')).toBeEnabled();
 await guest.locator('#resign').click();await guest.getByRole('dialog').getByRole('button',{name:'Resign',exact:true}).click();await expect(host.locator('#game-status')).toHaveText('White wins.');
 await host.locator('#rematch').click();await guest.locator('#rematch').click();await expect(host.locator('#move-count')).toHaveText('0 moves');await expect(guest.locator('#move-count')).toHaveText('0 moves');
 await context.close();
});
