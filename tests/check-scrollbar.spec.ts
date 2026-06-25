import { test } from '@playwright/test';

test('check overlay scrollbars in headless chrome', async ({ page }) => {
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

    return {
      scrollbarWidth,
      platform: navigator.platform,
    };
  });

  console.log('Native scrollbar width:', result.scrollbarWidth, 'px');
  console.log('Platform:', result.platform);
  if (result.scrollbarWidth === 0) {
    console.log('=> Overlay scrollbars (Chrome headless default). Scrollbar never consumes layout space.');
    console.log('=> The scrollbar-jitter theory is RULED OUT for this Chrome environment.');
    console.log('=> Layout jitter must come from a different source.');
  } else {
    console.log('=> Classic scrollbars. Width =', result.scrollbarWidth, 'px - LAYOUT SHIFT POSSIBLE.');
  }
});
