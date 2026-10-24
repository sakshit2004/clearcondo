/** Anchor id for the flag at `index` in severity order — shared by the
 *  report cover's "where the money is" links and the flag list. */
export function flagAnchor(index: number): string {
  return `flag-${index + 1}`;
}
