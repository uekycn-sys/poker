/**
 * Formats chip values as either raw comma-separated chips or `XX.X BB` units.
 */
export function formatChipsOrBb(
  amount: number,
  bigBlind: number,
  displayInBb: boolean,
): string {
  if (!displayInBb) {
    return amount.toLocaleString();
  }
  const bb = amount / Math.max(1, bigBlind);
  return `${bb.toFixed(1)} BB`;
}

/**
 * Formats signed chip deltas as `+X,XXX` or `+XX.X BB`.
 */
export function formatSignedChipsOrBb(
  delta: number,
  bigBlind: number,
  displayInBb: boolean,
): string {
  const sign = delta >= 0 ? '+' : '-';
  return `${sign}${formatChipsOrBb(Math.abs(delta), bigBlind, displayInBb)}`;
}

/**
 * Converts trailing numeric chip amounts inside engine action labels (e.g. `加注至 300`)
 * to `XX.X BB` when BB display mode is enabled.
 */
export function formatActionLabelWithBb(
  label: string | undefined,
  bigBlind: number,
  displayInBb: boolean,
): string | undefined {
  if (!label || !displayInBb) return label;
  return label.replace(/(\d+)$/, (numStr) =>
    formatChipsOrBb(Number(numStr), bigBlind, true),
  );
}
