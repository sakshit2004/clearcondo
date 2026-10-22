import { randomInt } from "crypto";
import type { PageText } from "./extract";

/**
 * Service orders — the ClearCondo service front door.
 *
 * The service framing: a realtor (or an unrepresented buyer) does not sign
 * up for a tool. They send the document package, we run the same analysis
 * pipeline, and a finished, client-ready report goes back to their inbox.
 * An order captures who sent it, which property it concerns, and the
 * extracted document text (raw PDF bytes are never stored — the same rule
 * as the self-serve app). Fulfilment runs the stored pages through the
 * normal pipeline; the order's status tracks the hand-off.
 */

export type ServiceOrderStatus = "received" | "in_review" | "delivered";

export interface ServiceOrderDoc {
  filename: string;
  docType: string;
  pageCount: number;
  charCount: number;
  /** extracted | ocr | failed — mirrors the document table's status. */
  status: string;
  pages: PageText[];
}

export interface ServiceOrderInput {
  realtorName: string;
  brokerage: string | null;
  email: string;
  propertyAddress: string;
  conditionDate: string | null;
}

export interface ServiceOrder extends ServiceOrderInput {
  refCode: string;
  status: ServiceOrderStatus;
  documents: ServiceOrderDoc[];
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Reference codes                                                     */
/* ------------------------------------------------------------------ */

/** Unambiguous alphabet: no 0/O, 1/I/L — a ref code can be read over the phone. */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REF_CODE_PATTERN = /^CC-[A-HJ-KM-NP-Z2-9]{6}$/;

export function generateRefCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  }
  return `CC-${suffix}`;
}

export function isRefCode(value: string): boolean {
  return REF_CODE_PATTERN.test(value.trim().toUpperCase());
}

export function normalizeRefCode(value: string): string {
  return value.trim().toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns the first validation error for the order form fields, or null
 * when the input is acceptable. Field-level copy is written for the
 * sender, not for a developer.
 */
export function validateServiceOrderInput(
  input: Partial<ServiceOrderInput>
): string | null {
  if (!input.realtorName || input.realtorName.trim().length < 2) {
    return "Tell us your name so the report can carry it.";
  }
  if (!input.email || !EMAIL_PATTERN.test(input.email.trim())) {
    return "Enter the email the finished report should go to.";
  }
  if (!input.propertyAddress || input.propertyAddress.trim().length < 8) {
    return "Enter the property address this package is for.";
  }
  if (
    input.conditionDate &&
    Number.isNaN(Date.parse(input.conditionDate))
  ) {
    return "The condition date doesn't look like a date.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Status copy                                                         */
/* ------------------------------------------------------------------ */

export function statusLabel(status: ServiceOrderStatus): string {
  switch (status) {
    case "received":
      return "Package received";
    case "in_review":
      return "Report in preparation";
    case "delivered":
      return "Report delivered";
  }
}

export function statusDescription(status: ServiceOrderStatus): string {
  switch (status) {
    case "received":
      return "We have your document package. It is queued for analysis — every claim in the report will be checked against the page it cites before anything is sent back.";
    case "in_review":
      return "Your package is being read and verified now. The finished report goes to your inbox as soon as verification completes.";
    case "delivered":
      return "Your verified report has been delivered to the email on this order. Keep this reference code with the client file.";
  }
}
