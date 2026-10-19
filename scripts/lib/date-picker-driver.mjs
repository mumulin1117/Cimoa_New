// UI-only date entry helper. Uses the same keyboard interactions as a user;
// never reaches into Vue instances, Store internals or browser storage.
export async function choose_date_of_birth(page, value) {
  await page.locator('[data-interaction="age.openDatePicker.click.1"]:visible').click()
  const dialog = page.getByRole('dialog', { name: 'Date of birth', exact: true })
  await dialog.waitFor()
  for (const [index, label] of ['Year', 'Month', 'Day'].entries()) {
    const column = dialog.getByRole('spinbutton', { name: label, exact: true }), target = Number(value.split('-')[index])
    let current = Number(await column.getAttribute('aria-valuenow')), count = 0
    while (current !== target && count++ < 250) {
      const difference = target - current
      await column.press(Math.abs(difference) >= 10 ? difference > 0 ? 'PageUp' : 'PageDown' : difference > 0 ? 'ArrowUp' : 'ArrowDown')
      current = Number(await column.getAttribute('aria-valuenow'))
    }
    if (current !== target) throw Error(`Date picker cannot select ${label} ${target}`)
  }
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
}
