import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { analysisEffort, analysisModel, speedParams, thinkingParam } from "../model-config.ts";

const saved = { ...process.env };
afterEach(() => {
  for (const k of ["ANTHROPIC_MODEL", "ANTHROPIC_EFFORT", "ANTHROPIC_THINKING"]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("model config", () => {
  it("defaults to Sonnet 5.5, low effort, thinking off", () => {
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_EFFORT;
    delete process.env.ANTHROPIC_THINKING;
    assert.equal(analysisModel(), "claude-sonnet-5-5");
    assert.equal(analysisEffort(), "low");
    assert.deepEqual(speedParams(), {
      model: "claude-sonnet-5-5",
      output_config: { effort: "low" },
      thinking: { type: "between_tools" },
    });
  });

  it("ignores an unknown effort", () => {
    process.env.ANTHROPIC_EFFORT = "turbo";
    assert.equal(analysisEffort(), "low");
  });

  it("spells thinking-off the way each model accepts it", () => {
    delete process.env.ANTHROPIC_THINKING;
    assert.deepEqual(thinkingParam("claude-sonnet-5-5", "low"), { type: "between_tools" });
    assert.equal(thinkingParam("claude-sonnet-5-5", "max"), undefined); // between_tools 400s above high
    assert.deepEqual(thinkingParam("claude-haiku-5-5", "medium"), { type: "disabled" });
    assert.deepEqual(thinkingParam("claude-opus-5", "high"), { type: "disabled" });
    assert.equal(thinkingParam("claude-opus-5-5", "low"), undefined); // can't be disabled
    assert.equal(thinkingParam("claude-fable-5-1", "low"), undefined);
  });

  it("lets thinking back on with ANTHROPIC_THINKING=on", () => {
    process.env.ANTHROPIC_THINKING = "on";
    assert.equal(thinkingParam("claude-sonnet-5-5", "low"), undefined);
    assert.equal("thinking" in speedParams("claude-sonnet-5-5"), false);
  });
});
