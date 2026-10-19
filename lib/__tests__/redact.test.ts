import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  redactText,
  redactAnalysis,
  toPublicAnalysis,
  protectedPhrasesFor,
  REDACTED_NAME,
} from "../redact.ts";
import { verifyQuote } from "../verify.ts";
import type { Analysis, VerifiedAnalysis } from "../report-schema";
import type { PageText } from "../extract.ts";

const PROT = ["North Hill Terrace", "1234 North Hill Terrace NW", "0614321"];

describe("redactText — role-annotated names", () => {
  it("replaces directors with their roles", () => {
    assert.equal(
      redactText(
        "Present: D. Whitfield (President), S. Okafor (Vice-President), L. Tremblay (Treasurer), J. Park (Secretary), R. Alvarez (Director).",
        PROT
      ),
      "Present: the President, the Vice-President, the Treasurer, the Secretary, a director."
    );
  });

  it("handles comma-style role annotation", () => {
    assert.equal(
      redactText(
        "Also present: Maya Chen, Property Manager, TriWest Management Ltd.",
        PROT
      ),
      "Also present: the property manager, TriWest Management Ltd."
    );
  });

  it("handles leading-role style", () => {
    assert.equal(
      redactText("President D. Whitfield called the meeting to order.", PROT),
      "the President called the meeting to order."
    );
  });

  it("handles 'J. Park, Secretary' sign-off", () => {
    assert.equal(
      redactText("Certified a true copy — J. Park, Secretary.", PROT),
      "Certified a true copy — the Secretary."
    );
  });
});

describe("redactText — unknown names", () => {
  it("redacts an unknown initial+surname", () => {
    assert.equal(
      redactText("Seconded by R. Alvarez.", PROT),
      `Seconded by ${REDACTED_NAME}.`
    );
  });

  it("redacts a bare Firstname Lastname", () => {
    const out = redactText("Maya Chen attended.", PROT);
    assert.ok(!out.includes("Maya Chen"), `leaked: ${out}`);
    assert.ok(out.includes(REDACTED_NAME));
  });
});

describe("redactText — never-redact list", () => {
  it("leaves company names untouched", () => {
    const s =
      "The assessment prepared by Hartley Engineering (August 2026) was reviewed.";
    assert.equal(redactText(s, PROT), s);
  });

  it("leaves companies with suffixes untouched", () => {
    const s = "Maya Chen, Property Manager, TriWest Management Ltd. attended.";
    const out = redactText(s, PROT);
    assert.ok(out.includes("TriWest Management Ltd."), `mangled: ${out}`);
  });

  it("leaves unit numbers untouched", () => {
    const s =
      "Unit 1204: fourth noise complaint. The claim affecting units 304, 305 and 406 remains open.";
    assert.equal(redactText(s, PROT), s);
  });

  it("leaves building and corp identifiers untouched", () => {
    const s =
      'Condominium Corporation No. 0614321 ("North Hill Terrace"), 1234 North Hill Terrace NW.';
    assert.equal(redactText(s, PROT), s);
  });

  it("leaves dollar amounts and dates untouched", () => {
    const s =
      "A special assessment of $8,500 per unit was levied on April 22, 2026.";
    assert.equal(redactText(s, PROT), s);
  });

  it("leaves structural phrases untouched", () => {
    for (const s of [
      "The Annual General Meeting approved the minutes.",
      "The Board reviewed the reserve fund.",
      "The reserve fund balance was $745,000.",
    ]) {
      assert.equal(redactText(s, PROT), s, `mangled: ${s}`);
    }
  });

  it("is idempotent on its own output", () => {
    const once = redactText("Present: D. Whitfield (President).", PROT);
    assert.equal(redactText(once, PROT), once);
  });
});

describe("redactText — hardened formats (adversarial probe follow-up)", () => {
  it("redacts LAST, FIRST attendance-list style", () => {
    const out = redactText("Attendees: Whitfield, Daryl; Chen, Maya.", PROT);
    assert.equal(out, `Attendees: ${REDACTED_NAME}; ${REDACTED_NAME}.`);
  });

  it("redacts ALL-CAPS names but keeps headers and motion boilerplate", () => {
    assert.equal(
      redactText("DARYL WHITFIELD seconded the motion.", PROT),
      `${REDACTED_NAME} seconded the motion.`
    );
    assert.equal(
      redactText("MEETING MINUTES — September 9, 2026.", PROT),
      "MEETING MINUTES — September 9, 2026."
    );
    assert.equal(
      redactText("BE IT RESOLVED THAT a special assessment be levied.", PROT),
      "BE IT RESOLVED THAT a special assessment be levied."
    );
    // Names redacted, motion boilerplate untouched.
    assert.equal(
      redactText("MOVED BY D. Whitfield, SECONDED BY J. Park, CARRIED.", PROT),
      `MOVED BY ${REDACTED_NAME}, SECONDED BY ${REDACTED_NAME}, CARRIED.`
    );
  });

  it("redacts apostrophe, hyphenated, and diacritic names", () => {
    assert.equal(
      redactText("Daryl O'Brien raised the parkade issue.", PROT),
      `${REDACTED_NAME} raised the parkade issue.`
    );
    assert.equal(
      redactText("D. O'Brien seconded.", PROT),
      `${REDACTED_NAME} seconded.`
    );
    assert.equal(
      redactText("Mary-Jane Watson voted against.", PROT),
      `${REDACTED_NAME} voted against.`
    );
    assert.equal(
      redactText("José García asked about insurance.", PROT),
      `${REDACTED_NAME} asked about insurance.`
    );
  });

  it("redacts initials without a dot", () => {
    assert.equal(
      redactText("Seconded by J Park.", PROT),
      `Seconded by ${REDACTED_NAME}.`
    );
  });

  it("redacts possessives with the name", () => {
    assert.equal(
      redactText("Daryl Whitfield's motion carried unanimously.", PROT),
      `${REDACTED_NAME} motion carried unanimously.`
    );
  });

  it("documents the surname-alone limit (possessive included)", () => {
    // A lone surname cannot be told apart from prose ("Whitfield" could be
    // a street), so it — and its possessive — are deliberately left alone.
    const s = "Whitfield's street is nearby.";
    assert.equal(redactText(s, PROT), s);
  });

  it("redacts email addresses", () => {
    assert.equal(
      redactText("Contact daryl.whitfield@example.com for details.", PROT),
      `Contact ${REDACTED_NAME} for details.`
    );
  });

  it("redacts titled names, dropping the title", () => {
    assert.equal(
      redactText("Dr. Daryl Whitfield presented the study.", PROT),
      `${REDACTED_NAME} presented the study.`
    );
    assert.equal(
      redactText("Mr. Park certified the minutes.", PROT),
      `${REDACTED_NAME} certified the minutes.`
    );
  });

  it("redacts three-word names whole", () => {
    assert.equal(
      redactText("Mary Jane Watson attended as observer.", PROT),
      `${REDACTED_NAME} attended as observer.`
    );
  });

  it("still keeps companies, units, money, and dates", () => {
    for (const s of [
      "Hartley Engineering (August 2026) delivered the report.",
      "Unit 1204 filed another complaint.",
      "The deductible is $100,000 after the June 2024 hail claim.",
    ]) {
      assert.equal(redactText(s, PROT), s, `mangled: ${s}`);
    }
  });
});

function minimalAnalysis(): Analysis {
  return {
    building: {
      name: "North Hill Terrace",
      corp_number: "0614321",
      address: "1234 North Hill Terrace NW",
      units: 84,
      year_built: 2009,
      monthly_contribution_avg_cad: 512,
    },
    structured_facts: {
      doc_date: "2026-09-09",
      reserve_balance_cad: 812400,
      reserve_recommended_cad: 1221000,
      contribution_monthly_cad: 512,
      insurance_deductible_cad: 100000,
      special_assessments: [
        {
          amount_per_unit_cad: 8500,
          total_cad: 714000,
          purpose: "Parkade membrane replacement, moved by D. Whitfield",
          status: "levied",
          evidence: {
            file_id: "file-0",
            page: 1,
            document_name: "minutes.pdf",
            quote:
              "BE IT RESOLVED that a special assessment of $8,500 per unit be levied, moved by D. Whitfield",
          },
        },
      ],
      litigation: [],
      rental_rules: null,
      rental_rules_evidence: null,
      fee_change_pct: 9,
    },
    flags: [
      {
        flag_type: "special_assessment",
        severity: "critical",
        title: "$8,500/unit special assessment levied",
        explanation:
          "The board voted the levy after J. Park presented the reserve study.",
        evidence: [
          {
            file_id: "file-0",
            page: 1,
            document_name: "minutes.pdf",
            quote:
              "BE IT RESOLVED that a special assessment of $8,500 per unit be levied, moved by D. Whitfield",
          },
        ],
        money_exposure: {
          amount_cad: 714000,
          per_unit_cad: 8500,
          basis: "$714,000 / 84 units",
        },
      },
    ],
    money_exposure_total_cad: 8500,
    money_exposure_basis: "$8,500 per unit buyer exposure",
    questions_for_realtor_lawyer: ["Ask Maya Chen about the payment schedule."],
    summary: "The President reported a healthy reserve position.",
  };
}

describe("redactAnalysis", () => {
  it("redacts surfaces but keeps original quotes and building identity", () => {
    const redacted = redactAnalysis(minimalAnalysis());
    const flag = redacted.flags[0];

    // Surfaces redacted…
    assert.ok(!flag.explanation.includes("J. Park"), flag.explanation);
    // A generic role reference with no name passes through untouched.
    assert.equal(
      redacted.summary,
      "The President reported a healthy reserve position."
    );
    assert.ok(
      !redacted.questions_for_realtor_lawyer[0].includes("Maya Chen"),
      redacted.questions_for_realtor_lawyer[0]
    );
    assert.ok(
      !redacted.structured_facts.special_assessments[0].purpose.includes(
        "Whitfield"
      )
    );

    // …building identity never redacted.
    assert.equal(redacted.building.name, "North Hill Terrace");
    assert.equal(redacted.building.corp_number, "0614321");

    // Evidence: original quote preserved, display version redacted.
    const ev = flag.evidence[0];
    assert.ok(ev.quote.includes("D. Whitfield"), "original quote must be kept");
    assert.ok(
      ev.quote_display && !ev.quote_display.includes("D. Whitfield"),
      `quote_display leaked: ${ev.quote_display}`
    );
    assert.notEqual(ev.quote_display, ev.quote);
  });

  it("verification still passes on the ORIGINAL quote", () => {
    const redacted = redactAnalysis(minimalAnalysis());
    const pages: PageText[] = [
      {
        page: 1,
        text: "BE IT RESOLVED that a special assessment of $8,500 per unit be levied, moved by D. Whitfield",
      },
    ];
    const v = verifyQuote(redacted.flags[0].evidence[0].quote, pages, 1);
    assert.equal(v.verified, true);
    assert.equal(v.matchType, "exact_page");
  });

  it("protectedPhrasesFor covers name, address, corp number", () => {
    const phrases = protectedPhrasesFor(minimalAnalysis().building);
    assert.ok(phrases.includes("North Hill Terrace"));
    assert.ok(phrases.includes("0614321"));
  });
});

describe("toPublicAnalysis", () => {
  it("replaces original quotes with redacted display versions", () => {
    const verified = {
      flags: [
        {
          evidence: [
            {
              quote: "moved by D. Whitfield",
              quote_display: "moved by the President",
            },
          ],
        },
      ],
      structured_facts: {
        special_assessments: [
          {
            evidence: {
              quote: "D. Whitfield voted yes",
              quote_display: "the President voted yes",
            },
          },
        ],
        litigation: [],
        rental_rules_evidence: null,
      },
    } as unknown as VerifiedAnalysis;
    const pub = toPublicAnalysis(verified);
    assert.equal(pub.flags[0].evidence[0].quote, "moved by the President");
    assert.equal(
      pub.structured_facts.special_assessments[0].evidence.quote,
      "the President voted yes"
    );
    // quote_display itself survives
    assert.equal(
      pub.flags[0].evidence[0].quote_display,
      "moved by the President"
    );
  });

  it("falls back to quote when quote_display is absent (pre-redaction data)", () => {
    const verified = {
      flags: [
        { evidence: [{ quote: "a plain historical quote" }] },
      ],
      structured_facts: {
        special_assessments: [],
        litigation: [],
        rental_rules_evidence: null,
      },
    } as unknown as VerifiedAnalysis;
    const pub = toPublicAnalysis(verified);
    assert.equal(pub.flags[0].evidence[0].quote, "a plain historical quote");
  });
});
