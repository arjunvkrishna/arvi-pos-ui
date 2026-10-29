/** Theme colours for charts, read from the design tokens so light and dark both look right. */
export function chartColors() {
  const css = getComputedStyle(document.documentElement);
  const rgb = (name: string) => `rgb(${css.getPropertyValue(name).trim()})`;
  return { muted: rgb('--muted'), fg: rgb('--fg'), line: rgb('--line') };
}
