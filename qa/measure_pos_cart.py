#!/usr/bin/env python3
"""Measure actual React POS add -> visible CART TOTAL in Chromium.
No real tenant or database. Runs at mobile viewport with 4x CPU throttling.
"""
import json
import os
import shutil
import statistics
from playwright.sync_api import sync_playwright

TARGET = os.environ.get("POS_QA_URL", "http://127.0.0.1:4178/qa/pos-cart-speed.html")
CHROME = (os.environ.get("CHROME_PATH") or shutil.which("google-chrome")
          or shutil.which("google-chrome-stable") or shutil.which("chromium"))
if not CHROME:
    raise RuntimeError("Chrome executable not found")

JS_ADD = """async ({index, expected}) => {
  const products = [...document.querySelectorAll('[data-pos-product-card]')];
  const total = document.querySelector('[data-testid="pos-mobile-grand-total"]');
  if (!products[index] || !total) throw new Error('POS product / sticky cart total is missing');
  const read = () => Number((total.textContent || '').replace(/[^0-9]/g, ''));
  const initial = read();
  return new Promise((resolve, reject) => {
    let seen = false;
    const started = performance.now();
    const finish = () => {
      if (seen || read() !== expected) return;
      seen = true;
      const updatedAt = performance.now();
      observer.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clearTimeout(timeout);
        resolve({
          selectedCard: index + 1,
          previous: initial,
          expected,
          actual: read(),
          domMs: +(updatedAt - started).toFixed(2),
          paintedMs: +(performance.now() - started).toFixed(2)
        });
      }));
    };
    const observer = new MutationObserver(finish);
    observer.observe(total, { childList: true, characterData: true, subtree: true });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Cart total did not update to '+expected+
        ' (current '+read()+') within 8 seconds'));
    }, 8000);
    products[index].click();
    finish();
  });
}"""

def run_case(browser, count: int, mode: str):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2, is_mobile=True, has_touch=True,
    )
    page = context.new_page()
    cdp = context.new_cdp_session(page)
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    page_errors = []
    console_errors = []
    failed_responses = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("response", lambda res: failed_responses.append(f"{res.status} {res.url}") if res.status >= 400 else None)
    page.goto(f"{TARGET}?count={count}&images=on", wait_until="domcontentloaded", timeout=90000)
    try:
        page.wait_for_function("window.__ORVIX_BENCHMARK_READY__ === true", timeout=15000)
    except Exception:
        print("QA_BOOT_DEBUG="+json.dumps({
            "url": page.url,
            "title": page.title(),
            "pageErrors": page_errors[:12],
            "consoleErrors": console_errors[:12],
            "failedResponses": failed_responses[:12],
            "ready": page.evaluate("window.__ORVIX_BENCHMARK_READY__ || false"),
            "renderedRootText": page.locator("#root").inner_text(timeout=3000)[:700],
            "bodyText": page.locator("body").inner_text(timeout=3000)[:600],
        }),flush=True)
        raise
    page.wait_for_selector('[data-pos-product-card]', timeout=45000)
    page.wait_for_selector('[data-testid="pos-mobile-grand-total"]', timeout=45000)
    total = 0
    results = []
    for i in range(5):
        idx = i if mode == "distinct" else 0
        total += (idx + 1) * 1000
        result = page.evaluate(JS_ADD, {"index": idx, "expected": total})
        assert result["actual"] == total, result
        results.append(result)
    if page_errors:
        raise AssertionError(f"Page runtime errors: {page_errors[:5]}")
    context.close()
    return {
        "products": count, "mode": mode,
        "cpuThrottle": "4x", "measure": "click-to-total DOM and next painted frames",
        "rows": results,
        "maxDomMs": max(x["domMs"] for x in results),
        "averageDomMs": round(statistics.mean(x["domMs"] for x in results), 2),
        "maxPaintedMs": max(x["paintedMs"] for x in results),
    }

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, headless=True,
                                args=["--no-sandbox", "--disable-dev-shm-usage"])
    try:
        all_cases = []
        for count, mode in [(120,"distinct"),(350,"distinct"),(350,"repeated")]:
            case = run_case(browser, count, mode)
            all_cases.append(case)
            print("CART_TIMING_RESULT="+json.dumps(case,ensure_ascii=False),flush=True)
        assert all(x["maxDomMs"] < 1500 for x in all_cases), "Cart lag exceeded 1.5s"
        print("CART_TIMING_SUCCESS=15 clicks passed (1-5 items, 120/350 catalog, 4x CPU)", flush=True)
    finally:
        browser.close()
