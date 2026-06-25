import { test } from '@playwright/test';

// Run with --headed flag to get real scrollbar measurement
test('check real Windows scrollbar width (headed)', async ({ page }) => {
  await page.goto('http://localhost:3001');

  const result = await page.evaluate(() => {
    const outer = document.createElement('div');
    outer.style.cssText = 'overflow:scroll;width:100px;height:100px;position:fixed;top:-9999px';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:200px;height:200px';
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const scrollbarWidth = outer.offsetWidth - outer.clientWidth;
    document.body.removeChild(outer);

    return { scrollbarWidth };
  });

  console.log('Headed Chrome scrollbar width:', result.scrollbarWidth, 'px');
  if (result.scrollbarWidth > 0) {
    console.log('=> Classic scrollbars (' + result.scrollbarWidth + 'px). SCROLLBAR JITTER IS REAL IN HEADED CHROME.');
    console.log('=> Users on Windows will see content shift when scrollbar appears/disappears.');
  } else {
    console.log('=> Overlay scrollbars. No scrollbar layout jitter.');
  }
});
