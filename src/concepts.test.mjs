import assert from "node:assert/strict";
import test from "node:test";
import { mergeConcepts, normalizeConcept, readConceptList } from "./concepts.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const builtin = readConceptList(
  JSON.parse(
    fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "concepts.json"),
      "utf8",
    ),
  ),
  "builtin",
);

test("ships a mapped concept list", () => {
  assert.ok(builtin.length >= 12);
  assert.equal(new Set(builtin.map((concept) => concept.label.toLowerCase())).size, builtin.length);
});

test("custom concepts append and do not replace a built-in label", () => {
  const added = normalizeConcept({ label: "closing a valve with no relief path", note: "omission" }, "custom");
  const merged = mergeConcepts(builtin, [added]);
  assert.equal(merged.at(-1)?.label, added.label);
  const clash = normalizeConcept({ label: builtin[0]?.label, note: "nope" }, "custom");
  const again = mergeConcepts(builtin, [clash, added]);
  assert.equal(again.filter((concept) => concept.label.toLowerCase() === builtin[0]?.label.toLowerCase()).length, 1);
  assert.equal(again.find((concept) => concept.label === builtin[0]?.label)?.source, "builtin");
});

test("blank concepts are rejected", () => {
  assert.throws(() => normalizeConcept({ label: "   " }, "custom"), /Concept is required/);
});
