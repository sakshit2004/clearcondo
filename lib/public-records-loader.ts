import {
  withDb,
  getReport,
  getReportDocuments,
  cityRecordsDbCache,
  recordPublicRecordFacts,
} from "@/lib/db";
import { rememberPublicRecordFacts } from "@/lib/agent-memory";
import { calgaryScope, extractPlanNumbers, normalizePlanNumber } from "@/lib/calgary/match";
import { assessReport, getCityRecords, type CityRecordsCache, type PublicRecordCheck } from "@/lib/calgary/check";
import { permitToFact } from "@/lib/calgary/facts";

/**
 * Server-side: the public record check for one of the user's reports.
 * Returns null when the report isn't theirs or the building is clearly
 * outside Calgary (the section is Calgary-only). Never throws for City
 * failures — those come back as status "unavailable".
 */
export async function loadPublicRecordCheck(
  userId: string,
  reportShortId: string
): Promise<PublicRecordCheck | null> {
  const reportId = `report:${decodeURIComponent(reportShortId)}`;
  const data = await withDb(async (db) => {
    const r = await getReport(db, userId, reportId);
    if (!r) return null;
    const docs = await getReportDocuments(db, userId, reportId);
    return { report: r.report, docs };
  });
  if (!data) return null;
  const { report, docs } = data;
  const facts = report.facts;
  if (calgaryScope(facts.address) === "outside") return null;

  const buildingId = String(report.building);
  // Plan numbers stated in the document text first, then the corp number
  // (in Alberta the corporation number is normally the plan number).
  const docPlans = extractPlanNumbers(docs.flatMap((d) => d.pages.map((p) => p.text)));
  const corpPlan = normalizePlanNumber(facts.corp_number);
  const planCandidates = [...docPlans, ...(corpPlan ? [corpPlan] : [])];

  // Each cache access opens its own short connection so no DB socket is
  // held open while the City API is being called.
  const cache: CityRecordsCache = {
    get: async (key) => (await withDb((db) => cityRecordsDbCache(db, userId).get(key))) ?? null,
    set: async (key, value) => {
      await withDb((db) => cityRecordsDbCache(db, userId).set(key, value));
    },
  };
  const { records, fromCache } = await getCityRecords(
    { planCandidates, address: facts.address },
    { cache, cacheKey: buildingId }
  );

  // Feed newly matched permits into building memory as public-record facts.
  if (!fromCache && records.status === "matched" && records.permits.status === "ok") {
    const permitFacts = records.permits.items.map((p) => permitToFact(p, records.plan));
    try {
      const fresh = await withDb((db) => recordPublicRecordFacts(db, userId, buildingId, permitFacts));
      if (fresh && fresh.length > 0) {
        await rememberPublicRecordFacts({ ownerId: userId, buildingRecordId: buildingId, facts: fresh });
      }
    } catch {
      /* memory is best-effort; the section still renders */
    }
  }

  return assessReport(records, {
    docPlans: planCandidates,
    docAddress: facts.address,
    docUnits: facts.units,
    docs,
  });
}
