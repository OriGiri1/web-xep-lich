// Mobile audit: run with browser_run_code_unsafe { filename }. Read-only: never applies a status.
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const tag = 'after';

  const audit = () => {
    const vw = innerWidth;
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX;
        if (o !== 'visible') return true;
      }
      return false;
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const name = (el) =>
      (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    const overflow = [...document.querySelectorAll('body *')]
      .filter((el) => visible(el) && !clipped(el))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 0.5 || r.left < -0.5; })
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)} [${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}]`);
    // Group small targets by kind so the 100s of grid cells show up as one line.
    const small = {};
    for (const el of document.querySelectorAll('button, a, [role=button], input, select, textarea')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) continue;
      const kind = el.closest('[data-cell]') ? (el.getAttribute('aria-label')?.startsWith('Sửa lí do') ? 'grid: nút bút chì lí do' : 'grid: ô giờ') : name(el);
      const k = `${kind} (${Math.round(r.width)}x${Math.round(r.height)})`;
      small[k] = (small[k] || 0) + 1;
    }
    const smallFont = [...document.querySelectorAll('input, select, textarea')]
      .filter(visible)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${name(el)}: ${getComputedStyle(el).fontSize}`);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, overflow, small, smallFont };
  };

  const out = {};
  const shot = async (key) => {
    out[key] = await p.evaluate(audit);
    await p.screenshot({ path: `.playwright-mcp/${tag}-${key}.png` });
  };

  await p.goto('http://localhost:5179');
  await p.waitForSelector('[data-cell]');
  await p.waitForTimeout(800);
  await shot('1-week');
  await p.getByRole('button', { name: 'Ngày', exact: true }).tap();
  await p.waitForTimeout(400);
  await shot('2-day');
  await p.getByRole('button', { name: 'Tháng', exact: true }).tap();
  await p.waitForTimeout(400);
  await shot('3-month');
  await p.getByRole('button', { name: 'Tuần', exact: true }).tap();
  await p.waitForTimeout(400);

  // Reason dialog via the pencil on an existing "reason" cell: opens the dialog without writing anything.
  const pencil = p.locator('[aria-label^="Sửa lí do"]').first();
  if (await pencil.count()) {
    await pencil.scrollIntoViewIfNeeded();
    await pencil.tap();
    await p.waitForTimeout(400);
    await shot('4-reason-dialog');
    // Simulate the phone keyboard: the visual viewport shrinks and the window resizes / scrolls.
    await p.setViewportSize({ width: 375, height: 480 });
    await p.evaluate(() => window.scrollBy(0, 40));
    await p.waitForTimeout(400);
    out.reasonOpenAfterKeyboard = await p.locator('[role=dialog]').count();
    out.inputFocused = await p.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    await p.screenshot({ path: `.playwright-mcp/${tag}-5-keyboard.png` });
    await p.setViewportSize({ width: 375, height: 812 });
    await p.keyboard.press('Escape');
  } else out.reasonDialog = 'no reason cell to open';

  // Inline title editor (blur without changes saves nothing).
  await p.evaluate(() => scrollTo(0, 0));
  await p.getByRole('button', { name: /^Tên nhóm/ }).tap();
  await p.waitForTimeout(300);
  await shot('6-title-edit');
  await p.keyboard.press('Escape');

  await ctx.close();
  return out;
}
