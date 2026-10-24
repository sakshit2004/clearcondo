/**
 * The owner bills ClearCondo plans to take on after property tax, in
 * order. None of these is live: each has a coming-soon tab in the owner
 * dashboard. Copy describes what's planned, never what works today.
 */
export interface OwnerBill {
  slug: "insurance" | "energy" | "mortgage";
  /** Dashboard tab label. */
  tab: string;
  title: string;
  summary: string;
  planned: string[];
  icon: string;
}

export const OWNER_BILLS: OwnerBill[] = [
  {
    slug: "insurance",
    tab: "Insurance",
    title: "Home & condo insurance",
    summary:
      "Whether your unit policy fits what the corporation's insurance and deductible actually leave you exposed to.",
    planned: [
      "Read the corporation's insurance certificate and its deductibles",
      "Check that your unit policy covers the deductible you could be charged",
      "Point out gaps, and cover you may be paying for twice",
    ],
    icon: "M9 2l6 2.5v4.2c0 3.6-2.5 6.4-6 7.3-3.5-.9-6-3.7-6-7.3V4.5z",
  },
  {
    slug: "energy",
    tab: "Energy",
    title: "Energy & electricity",
    summary: "What your unit's power and utilities cost against similar units, and where the bill can come down.",
    planned: [
      "Compare your bills with similar units",
      "Check your electricity and gas plan against current offers",
      "Separate what your condo fees already cover from what you pay yourself",
    ],
    icon: "M10 2L4 10h4.5L8 16l6-8H9.5z",
  },
  {
    slug: "mortgage",
    tab: "Mortgage",
    title: "Mortgage & refinancing",
    summary: "When a renewal or refinance would lower what you pay, using what you owe and what the unit is worth.",
    planned: [
      "Keep track of your renewal date",
      "Compare your rate with what lenders are offering",
      "Show when refinancing saves money after penalties and fees",
    ],
    icon: "M2 9l7-6 7 6M4 7.5V16h10V7.5M7.5 16v-4h3v4",
  },
];

export function ownerBill(slug: OwnerBill["slug"]): OwnerBill {
  return OWNER_BILLS.find((b) => b.slug === slug)!;
}
