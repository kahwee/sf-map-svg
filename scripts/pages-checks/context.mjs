export async function createCheckContext(browser, options) {
  const context = await browser.newContext(options);
  context.setDefaultTimeout(10_000);
  context.setDefaultNavigationTimeout(20_000);
  return context;
}
