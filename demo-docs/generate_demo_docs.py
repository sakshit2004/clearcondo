#!/usr/bin/env python3
"""Generate a synthetic, flag-rich condo document set for the ClearCondo hackathon demo.

All documents are FICTIONAL and watermarked as demo data. They model realistic
Alberta condominium documents (board minutes, AGM minutes, reserve fund plan
summary, estoppel-style information statement) with six baked-in red flags:

  R1  Special assessment: $8,500/unit for parkade membrane (voted, payable)
  R2  Reserve fund at 61% of study recommendation (below 70% "good" threshold)
  R3  Unfunded $1.15M building-envelope remediation -> future assessment risk
  R4  Litigation: window water-ingress claim (3 units), in mediation
  R5  Insurance deductible raised to $100,000 after 2024 hail claim
  R6  Proposed rental-restriction bylaw (15% cap; 22% currently rented) +
      repeat nuisance complaints re: unit 1204
"""
import html
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                HRFlowable, Table, TableStyle)

INK = HexColor("#1a1a1a")
MUTED = HexColor("#555555")
ACCENT = HexColor("#8a1f1f")
WATERMARK = "SAMPLE DOCUMENT \u2014 DEMO DATA ONLY \u00b7 Fictional corporation created for software demonstration"

CORP = "Condominium Corporation No. 0614321"
NAME = '"North Hill Terrace"'
ADDR = "1234 North Hill Terrace NW, Calgary, Alberta"


def p(text, style):
    return Paragraph(html.escape(text), style)


def build(filename, title, subtitle, blocks):
    doc = SimpleDocTemplate(
        filename, pagesize=LETTER,
        topMargin=0.7 * inch, bottomMargin=0.8 * inch,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        title=title, author="ClearCondo demo data (fictional)")

    s_title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=15,
                             leading=19, textColor=INK, spaceAfter=2)
    s_sub = ParagraphStyle("s", fontName="Helvetica", fontSize=10.5,
                           leading=14, textColor=MUTED, spaceAfter=2)
    s_head = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11.5,
                            leading=15, textColor=INK, spaceBefore=12,
                            spaceAfter=5)
    s_body = ParagraphStyle("b", fontName="Helvetica", fontSize=10,
                            leading=14.5, textColor=INK, spaceAfter=5)
    s_bold = ParagraphStyle("bb", parent=s_body, fontName="Helvetica-Bold")
    s_small = ParagraphStyle("sm", fontName="Helvetica-Oblique", fontSize=8.5,
                             leading=11.5, textColor=MUTED, spaceAfter=4)
    s_wm = ParagraphStyle("wm", fontName="Helvetica-Bold", fontSize=7.5,
                          leading=10, textColor=ACCENT, alignment=1,
                          spaceAfter=8)

    story = [p(WATERMARK, s_wm),
             p(CORP, s_sub), p(NAME, s_sub),
             p(title, s_title)]
    if subtitle:
        story.append(p(subtitle, s_sub))
    story.append(HRFlowable(width="100%", thickness=1, color=INK,
                            spaceBefore=6, spaceAfter=10))

    for kind, text in blocks:
        if kind == "h":
            story.append(p(text, s_head))
        elif kind == "b":
            story.append(p(text, s_body))
        elif kind == "bold":
            story.append(p(text, s_bold))
        elif kind == "note":
            story.append(p(text, s_small))
        elif kind == "table":
            rows, widths = text
            t = Table([[p(c, s_body) for c in row] for row in rows],
                      colWidths=widths)
            t.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, MUTED),
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#eeeeee")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(t)
            story.append(Spacer(1, 8))

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFont("Helvetica-Oblique", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(4.25 * inch, 0.55 * inch, WATERMARK)
        canvas.drawRightString(7.65 * inch, 0.55 * inch,
                               "Page %d" % d.page)
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print("wrote", filename)


# ---------------------------------------------------------------- doc 1
build(
    "demo-01-board-minutes-2026-09-09.pdf",
    "Minutes of the Meeting of the Board of Directors",
    "Held on September 9, 2026, at 7:00 p.m. \u2014 Amenity Room, " + ADDR,
    [
        ("bold", "Present: D. Whitfield (President), S. Okafor (Vice-President), "
                 "L. Tremblay (Treasurer), J. Park (Secretary), R. Alvarez (Director). "
                 "Regrets: none. Also present: Maya Chen, Property Manager, "
                 "TriWest Management Ltd."),
        ("h", "1. Call to Order"),
        ("b", "The President called the meeting to order at 7:04 p.m. A quorum "
              "of directors was present."),
        ("h", "2. Approval of Agenda / 3. Approval of Minutes of July 8, 2026"),
        ("b", "Both carried unanimously."),
        ("h", "4. Financial Report (period ending August 31, 2026)"),
        ("b", "Operating account balance $42,310. Reserve fund balance $812,400. "
              "Three units are more than 60 days in arrears (total $6,240); "
              "collection letters have been issued."),
        ("h", "5. Building Envelope Engineering Report"),
        ("b", "The Board reviewed the building envelope condition assessment "
              "prepared by Hartley Engineering (August 2026). The report "
              "identifies deteriorated sealant joints and cladding failures on "
              "the east elevation and recommends full remediation within three "
              "years. The preliminary opinion of probable cost is $1,150,000, "
              "which is not currently funded in the reserve fund plan."),
        ("b", "MOVED that management be directed to obtain three competitive "
              "quotes for envelope remediation for the Board's review at the "
              "November meeting. Carried."),
        ("h", "6. Insurance Renewal"),
        ("b", "The 2026/27 insurance renewal has been bound. The deductible "
              "has increased to $100,000 per occurrence following the June "
              "2024 hail claim ($380,000 paid). Annual premium is $96,400, an "
              "18% increase over last year."),
        ("h", "7. Parkade Membrane Project Update"),
        ("b", "Work is approximately 60% complete and on schedule for "
              "November completion. Special assessment installment collection "
              "stands at 91%."),
        ("h", "8. Litigation Update"),
        ("b", "The window water-ingress claim affecting units 304, 305 and 406 "
              "remains in mediation; the next session is scheduled for "
              "October 28, 2026. Legal counsel advises that no provision is "
              "required at this time."),
        ("h", "9. Resident Matters"),
        ("b", "Unit 1204: fourth noise complaint in six months (late-night "
              "music). The Board authorized a final warning letter; fines under "
              "section 12.4 of the bylaws will apply to any recurrence."),
        ("h", "10. Proposed Bylaw Amendment \u2014 Rental Restrictions"),
        ("b", "The Board reviewed a draft amendment that would cap rentals at "
              "15% of units (22% of units are currently rented). The amendment "
              "will be presented for an owner vote at the 2027 Annual General "
              "Meeting."),
        ("h", "11. Next Meeting / Adjournment"),
        ("b", "Next meeting: November 11, 2026. The meeting adjourned at "
              "9:12 p.m."),
        ("note", "Certified a true copy of the minutes \u2014 J. Park, Secretary."),
    ],
)

# ---------------------------------------------------------------- doc 2
build(
    "demo-02-agm-minutes-2026-04-22.pdf",
    "Minutes of the Annual General Meeting",
    "Held on April 22, 2026, at 7:00 p.m. \u2014 Amenity Room, " + ADDR,
    [
        ("b", "Quorum: 58 of 84 units were represented in person or by proxy "
              "(69%). The President chaired the meeting; the Secretary recorded "
              "the minutes."),
        ("h", "1. President's Report"),
        ("b", "The President summarized 2025 operations, including completion "
              "of the lobby refurbishment and commissioning of the 2025 "
              "reserve fund study update."),
        ("h", "2. Financial Statements (fiscal year ended December 31, 2025)"),
        ("b", "The audited financial statements were presented and adopted. "
              "The reserve fund balance at year-end was $745,000 against a "
              "study-recommended balance of $1,221,000 \u2014 approximately "
              "61% funded."),
        ("h", "3. Special Resolution \u2014 Special Assessment"),
        ("b", "WHEREAS the parkade membrane has reached the end of its service "
              "life and the 2025 reserve fund study identifies its replacement "
              "at a cost of $714,000, and WHEREAS the reserve fund cannot "
              "absorb this expenditure without falling below prudent levels, "
              "BE IT RESOLVED that a special assessment of $8,500 per unit "
              "($714,000 in total) be levied, payable in four quarterly "
              "installments of $2,125 commencing July 1, 2026."),
        ("b", "Result: 71% in favour. The resolution was declared passed."),
        ("h", "4. 2026 Operating Budget"),
        ("b", "The 2026 budget was presented, reflecting a 9% increase in "
              "monthly contributions, driven by insurance costs and the "
              "adopted reserve fund plan."),
        ("h", "5. Election of Directors"),
        ("b", "D. Whitfield, S. Okafor and L. Tremblay were elected to "
              "two-year terms by acclamation."),
        ("h", "6. Owner Questions"),
        ("b", "Several owners asked about staining observed on the east "
              "elevation cladding. The Board confirmed it has commissioned a "
              "building envelope engineering assessment, expected in summer "
              "2026."),
        ("b", "The meeting adjourned at 8:47 p.m."),
        ("note", "Certified a true copy of the minutes \u2014 J. Park, Secretary."),
    ],
)

# ---------------------------------------------------------------- doc 3
build(
    "demo-03-reserve-fund-plan-summary-2026.pdf",
    "Reserve Fund Plan \u2014 Summary for Owners (2026)",
    "Adopted by the Board on March 11, 2026, based on the 2025 reserve fund "
    "study update prepared by Hartley Engineering.",
    [
        ("h", "Funding position"),
        ("table", (
            [["Item", "Amount"],
             ["Reserve fund balance, Jan 1, 2026", "$745,000"],
             ["Study-recommended balance", "$1,221,000"],
             ["Funded status", "61% (study rates 70%+ as \u201cgood\u201d)"],
             ["2026 annual contribution", "$198,000 (avg $196/unit/month)"],
             ["Planned contribution increases", "12% per year, 2027\u20132029"]],
            [3.4 * inch, 3.1 * inch])),
        ("h", "Five-year capital outlook"),
        ("table", (
            [["Project", "Year", "Est. cost", "Funding"],
             ["Parkade membrane replacement", "2026", "$714,000",
              "Special assessment ($8,500/unit)"],
             ["Elevator modernization", "2027", "$220,000", "Reserve fund"],
             ["Building envelope remediation", "2028\u20132029",
              "$1,150,000 (preliminary)", "NOT YET FUNDED"],
             ["Roof membrane (phase 2)", "2030", "$310,000",
              "Reserve fund (planned)"]],
            [2.2 * inch, 0.9 * inch, 1.5 * inch, 1.9 * inch])),
        ("b", "Note: this plan assumes no further special assessments beyond "
              "the 2026 parkade levy. The building envelope project identified "
              "in the 2026 engineering assessment is not yet funded; the Board "
              "will revisit funding options once competitive quotes are "
              "received."),
        ("note", "Owners may request the full reserve fund study from the "
                 "property manager. This summary is provided for convenience; "
                 "refer to the full study for detailed component schedules."),
    ],
)

# ---------------------------------------------------------------- doc 4
build(
    "demo-04-information-statement-unit-506.pdf",
    "Condominium Information Statement \u2014 Unit 506",
    "Issued October 2, 2026, at the request of the registered owner, for "
    "provision to a prospective buyer. " + CORP + ", " + ADDR + ".",
    [
        ("h", "Unit and contributions"),
        ("table", (
            [["Item", "Detail"],
             ["Monthly contribution (2026)", "$512"],
             ["Contribution arrears", "None"],
             ["Parking", "Stall P-88 (titled)"],
             ["Storage", "Locker S-12 (assigned)"]],
            [2.6 * inch, 3.9 * inch])),
        ("h", "Special assessments"),
        ("b", "Special assessment levied April 22, 2026: $8,500 per unit for "
              "parkade membrane replacement. For Unit 506: $4,250 paid to "
              "date; $4,250 remains payable in two quarterly installments of "
              "$2,125 (January 1 and April 1, 2027). The installments run "
              "with the unit on sale."),
        ("h", "Insurance"),
        ("b", "Corporation's insurance deductible is $100,000 per occurrence "
              "(increased at the 2026 renewal following the June 2024 hail "
              "claim). Buyers should obtain a unit owner's policy covering "
              "the deductible exposure, improvements and personal liability."),
        ("h", "Legal proceedings"),
        ("b", "No proceedings against Unit 506. The Corporation is a party to "
              "an ongoing mediation concerning window water-ingress affecting "
              "units 304, 305 and 406; no provision has been recorded."),
        ("h", "Bylaws and governance"),
        ("b", "Current bylaws filed at Land Titles. The Board intends to "
              "present a rental-restriction amendment (15% cap) for an owner "
              "vote at the 2027 AGM; 22% of units are currently rented."),
        ("note", "Issued by TriWest Management Ltd. as agent for the "
                 "Corporation. Fee $75 + GST."),
    ],
)

# ---------------------------------------------------------------- 2024 variant
# Older document set for the SAME fictional building, used to demonstrate the
# "what changed since the last review" memory diff. Numbers are deliberately
# different from the 2026 set: no special assessment yet, lower deductible,
# no litigation, thinner (but slightly better-funded) reserves.

build(
    "demo-2024-01-board-minutes-2024-09-11.pdf",
    "Minutes of the Meeting of the Board of Directors",
    "Held on September 11, 2024, at 7:00 p.m. \u2014 Amenity Room, " + ADDR,
    [
        ("bold", "Present: D. Whitfield (President), S. Okafor (Vice-President), "
                 "L. Tremblay (Treasurer), J. Park (Secretary), R. Alvarez (Director). "
                 "Also present: Maya Chen, Property Manager, TriWest Management Ltd."),
        ("h", "1. Call to Order"),
        ("b", "The President called the meeting to order at 7:02 p.m. A quorum "
              "of directors was present."),
        ("h", "2. Financial Report (period ending August 31, 2024)"),
        ("b", "Operating account balance $38,900. Reserve fund balance $660,000. "
              "Two units are more than 60 days in arrears (total $3,100)."),
        ("h", "3. Parkade Condition"),
        ("b", "Management reported the parkade membrane is showing wear with "
              "minor ponding in two areas. The 2024 reserve fund study "
              "anticipates replacement in 2026 at an estimated cost of "
              "$700,000, which is not yet funded. The Board asked management "
              "to obtain updated quotes in early 2025."),
        ("h", "4. Insurance Renewal"),
        ("b", "The 2024/25 insurance renewal has been bound with a per-occurrence "
              "deductible of $25,000. Annual premium is $74,200."),
        ("h", "5. Legal"),
        ("b", "The Board confirmed there are no known legal proceedings "
              "involving the Corporation at this time."),
        ("h", "6. Resident Matters"),
        ("b", "No new complaints. The Board reminded owners of the quiet-hours "
              "bylaw (10 p.m. to 8 a.m.)."),
        ("h", "7. Next Meeting / Adjournment"),
        ("b", "Next meeting: November 13, 2024. The meeting adjourned at "
              "8:31 p.m."),
        ("note", "Certified a true copy of the minutes \u2014 J. Park, Secretary."),
    ],
)

build(
    "demo-2024-02-reserve-fund-plan-summary-2024.pdf",
    "Reserve Fund Plan \u2014 Summary for Owners (2024)",
    "Adopted by the Board on March 13, 2024, based on the 2024 reserve fund "
    "study prepared by Hartley Engineering.",
    [
        ("h", "Funding position"),
        ("table", (
            [["Item", "Amount"],
             ["Reserve fund balance, Jan 1, 2024", "$660,000"],
             ["Study-recommended balance", "$1,050,000"],
             ["Funded status", "63% (study rates 70%+ as \u201cgood\u201d)"],
             ["2024 annual contribution", "$176,400 (avg $175/unit/month)"],
             ["Planned contribution increases", "4% per year, 2025\u20132026"]],
            [3.4 * inch, 3.1 * inch])),
        ("h", "Five-year capital outlook"),
        ("table", (
            [["Project", "Year", "Est. cost", "Funding"],
             ["Parkade membrane replacement", "2026", "$700,000 (preliminary)",
              "NOT YET FUNDED"],
             ["Elevator modernization", "2028", "$200,000", "Reserve fund"],
             ["Roof membrane (phase 2)", "2030", "$290,000",
              "Reserve fund (planned)"]],
            [2.2 * inch, 0.9 * inch, 1.5 * inch, 1.9 * inch])),
        ("b", "Note: the parkade membrane project anticipated for 2026 is not "
              "yet funded. The Board will revisit funding options once updated "
              "quotes are received in 2025."),
        ("note", "Owners may request the full reserve fund study from the "
                 "property manager. This summary is provided for convenience."),
    ],
)
