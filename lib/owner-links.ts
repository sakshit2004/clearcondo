/** Where an owner's building opens, keeping the unit typed in the search. */
export function ownerBuildingHref(plan: string, unit: string | null | undefined): string {
  return `/app/own/${encodeURIComponent(plan)}${unit ? `?unit=${encodeURIComponent(unit)}` : ""}`;
}
