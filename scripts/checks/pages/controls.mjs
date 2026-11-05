/** Moves a native select to its next option from the keyboard. Chromium on macOS opens a popup that tests cannot drive, so the value is set directly when the keys leave it unchanged. */
export async function stepSelect(page, select) {
  const before = await select.inputValue();
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  if ((await select.inputValue()) !== before) return;
  const values = await select.locator('option').evaluateAll((all) => all.map((o) => o.value));
  await select.selectOption(values[values.indexOf(before) + 1]);
}
