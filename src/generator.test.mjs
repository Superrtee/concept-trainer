import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generatePairs, selectFamily } from "./generator.mjs";
import { loadFamilies } from "./load.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const families = loadFamilies(path.join(root, "data", "families"));

test("built-in family meets the template and lexicon floor", () => {
  assert.equal(families.length, 1);
  const family = families[0];
  assert.equal(family.id, "consequence-weighing");
  const ids = family.slots.map((slot) => slot.id);
  assert.deepEqual(ids, [
    "definition",
    "mechanism",
    "failure_mode",
    "analogy",
    "edge_case",
    "application_example",
  ]);
  for (const slot of family.slots) {
    assert.ok(slot.prompts.length >= 20, slot.id);
    assert.ok(slot.templates.length >= 20, slot.id);
  }
  const entries = Object.values(family.lexicon).reduce((sum, list) => sum + list.length, 0);
  assert.ok(entries >= 50, `lexicon entries ${entries}`);
});

test("output is deterministic, filled, and not locked to one slot order", () => {
  const input = { concept: "night watch turnover", count: 12, families };
  const a = generatePairs(input);
  const b = generatePairs(input);
  assert.equal(a, b);
  assert.equal(a.includes("{"), false);
  assert.equal(a.includes("**"), false);
  assert.equal(a.includes("#"), false);
  assert.match(a, /^01  CONSEQUENCE WEIGHING\nconcept: night watch turnover\n\nPROMPT\n/);
  assert.equal(a.trimEnd().split("\n\n").length >= 12, true);

  const leads = [...a.matchAll(/RESPONSE\n([^:\n]+):/g)].map((match) => match[1]);
  assert.equal(leads.length, 12);
  assert.ok(new Set(leads).size >= 3, `leads: ${leads.join(", ")}`);

  const prompts = [...a.matchAll(/PROMPT\n([\s\S]*?)\n\nRESPONSE/g)].map((match) => match[1]);
  assert.equal(prompts.length, 12);
  assert.ok(new Set(prompts).size >= 8);
});

test("pair one does not change when the requested count grows", () => {
  const short = generatePairs({ concept: "sourdough", count: 2, families });
  const long = generatePairs({ concept: "sourdough", count: 5, families });
  const end = short.indexOf("\n\n02  ");
  assert.ok(end > 0);
  const first = short.slice(0, end);
  assert.ok(long.startsWith(first));
  assert.match(first, /RESPONSE\n/);
});

test("unknown topics still use the default family", () => {
  const family = selectFamily("replacing a bearing", families);
  assert.equal(family.id, "consequence-weighing");
  const text = generatePairs({ concept: "replacing a bearing", count: 1, families });
  assert.match(text, /concept: replacing a bearing/);
  assert.match(text, /replacing a bearing/);
});

test("bad input is rejected", () => {
  assert.throws(() => generatePairs({ concept: "   ", count: 1, families }), /Concept is required/);
  assert.throws(() => generatePairs({ concept: "x", count: 0, families }), /Pair count/);
  assert.throws(() => generatePairs({ concept: "x", count: 1.5, families }), /Pair count/);
});
