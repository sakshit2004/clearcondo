import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateRefCode,
  isRefCode,
  normalizeRefCode,
  validateServiceOrderInput,
  statusLabel,
  REF_CODE_PATTERN,
} from "../service-order.ts";

describe("generateRefCode", () => {
  it("matches the CC-XXXXXX pattern with an unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRefCode();
      assert.match(code, REF_CODE_PATTERN);
      // No characters that get misread over the phone.
      assert.doesNotMatch(code, /[0O1IL]/);
    }
  });

  it("does not repeat across a batch", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateRefCode()));
    assert.equal(codes.size, 500);
  });
});

describe("isRefCode / normalizeRefCode", () => {
  it("accepts lowercase and padded input after normalization", () => {
    assert.equal(isRefCode(normalizeRefCode(" cc-ab3k9q ")), true);
  });
  it("rejects malformed codes", () => {
    assert.equal(isRefCode("CC-AB3K9"), false);
    assert.equal(isRefCode("CC-AB3K9QQ"), false);
    assert.equal(isRefCode("XX-AB3K9Q"), false);
    assert.equal(isRefCode("CC-AB3K0Q"), false); // 0 is not in the alphabet
    assert.equal(isRefCode(""), false);
  });
});

describe("validateServiceOrderInput", () => {
  const ok = {
    realtorName: "Jordan Lee",
    brokerage: null,
    email: "jordan@brokerage.ca",
    propertyAddress: "Unit 506, 1234 North Hill Terrace NW, Calgary",
    conditionDate: null,
  };

  it("accepts a complete order", () => {
    assert.equal(validateServiceOrderInput(ok), null);
    assert.equal(
      validateServiceOrderInput({ ...ok, conditionDate: "2026-11-02" }),
      null
    );
  });

  it("requires a name", () => {
    assert.match(validateServiceOrderInput({ ...ok, realtorName: "" })!, /name/);
    assert.match(validateServiceOrderInput({ ...ok, realtorName: "J" })!, /name/);
  });

  it("requires a deliverable email", () => {
    assert.match(validateServiceOrderInput({ ...ok, email: "" })!, /email/);
    assert.match(validateServiceOrderInput({ ...ok, email: "jordan@" })!, /email/);
    assert.match(
      validateServiceOrderInput({ ...ok, email: "jordan brokerage.ca" })!,
      /email/
    );
  });

  it("requires a property address", () => {
    assert.match(
      validateServiceOrderInput({ ...ok, propertyAddress: "" })!,
      /address/
    );
    assert.match(
      validateServiceOrderInput({ ...ok, propertyAddress: "Calgary" })!,
      /address/
    );
  });

  it("rejects a nonsense condition date but allows an empty one", () => {
    assert.match(
      validateServiceOrderInput({ ...ok, conditionDate: "next Friday-ish" })!,
      /date/
    );
    assert.equal(validateServiceOrderInput({ ...ok, conditionDate: null }), null);
  });
});

describe("statusLabel", () => {
  it("has a label for every status", () => {
    assert.equal(statusLabel("received"), "Package received");
    assert.equal(statusLabel("in_review"), "Report in preparation");
    assert.equal(statusLabel("delivered"), "Report delivered");
  });
});
