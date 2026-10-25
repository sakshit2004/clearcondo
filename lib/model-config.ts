import type Anthropic from "@anthropic-ai/sdk";

/**
 * Model settings for the analysis and OCR calls, tuned for speed. Document
 * analysis here is extraction with verbatim quotes that are machine-checked
 * afterwards (lib/verify.ts), so it doesn't need long reasoning: thinking
 * off and low effort cut the time spent before the first JSON token.
 *
 * Env overrides (no code change needed):
 *   ANTHROPIC_MODEL     model id (default claude-sonnet-5-5)
 *   ANTHROPIC_EFFORT    low | medium | high | xhigh | max (default low)
 *   ANTHROPIC_THINKING  "on" to let the model think (default off where the model allows it)
 */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function analysisModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

export function analysisEffort(): Effort {
  const v = process.env.ANTHROPIC_EFFORT as Effort | undefined;
  return v && EFFORTS.includes(v) ? v : "low";
}

/**
 * The thinking setting that turns thinking off for this model, or undefined
 * to leave the model's default (adaptive). Each model family spells "off"
 * differently, and some can't turn it off at all:
 * - Sonnet 5.5: `between_tools` (only at effort high or below)
 * - Haiku 5.5 / Sonnet 5 / Opus 5: `disabled` (Haiku 5.5 / Opus 5 only at high or below)
 * - Opus 5.5 / Fable: can't be turned off; low effort is the lever
 */
export function thinkingParam(model: string, effort: Effort): Anthropic.ThinkingConfigParam | undefined {
  if (process.env.ANTHROPIC_THINKING === "on") return undefined;
  const lowEnough = effort === "low" || effort === "medium" || effort === "high";
  if (model.startsWith("claude-sonnet-5-5")) return lowEnough ? { type: "between_tools" } : undefined;
  if (model.startsWith("claude-haiku-5-5") || (model.startsWith("claude-opus-5") && !model.startsWith("claude-opus-5-5"))) {
    return lowEnough ? { type: "disabled" } : undefined;
  }
  if (model.startsWith("claude-sonnet-5")) return { type: "disabled" };
  return undefined;
}

/** The request fields shared by every analysis/OCR call. */
export function speedParams(model = analysisModel()) {
  const effort = analysisEffort();
  const thinking = thinkingParam(model, effort);
  return {
    model,
    output_config: { effort },
    ...(thinking ? { thinking } : {}),
  };
}
