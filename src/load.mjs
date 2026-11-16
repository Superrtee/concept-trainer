import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} fileName
 * @param {unknown} data
 */
export function assertFamily(fileName, data) {
  if (!data || typeof data !== "object") {
    throw new Error(`${fileName}: family file must be a JSON object`);
  }
  const family = /** @type {Record<string, unknown>} */ (data);
  if (typeof family.id !== "string" || !family.id.trim()) {
    throw new Error(`${fileName}: missing id`);
  }
  if (typeof family.label !== "string" || !family.label.trim()) {
    throw new Error(`${fileName}: missing label`);
  }
  if (!family.lexicon || typeof family.lexicon !== "object" || Array.isArray(family.lexicon)) {
    throw new Error(`${fileName}: lexicon must be an object of string arrays`);
  }
  const lexicon = /** @type {Record<string, unknown>} */ (family.lexicon);
  for (const [key, values] of Object.entries(lexicon)) {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      throw new Error(`${fileName}: bad lexicon key "${key}"`);
    }
    if (!Array.isArray(values) || values.length === 0 || values.some((v) => typeof v !== "string" || !v.trim())) {
      throw new Error(`${fileName}: lexicon.${key} must be a non-empty array of strings`);
    }
  }
  if (!Array.isArray(family.slots) || family.slots.length === 0) {
    throw new Error(`${fileName}: slots must be a non-empty array`);
  }
  const seen = new Set();
  for (const slot of family.slots) {
    if (!slot || typeof slot !== "object") throw new Error(`${fileName}: bad slot`);
    const s = /** @type {Record<string, unknown>} */ (slot);
    if (typeof s.id !== "string" || typeof s.label !== "string") {
      throw new Error(`${fileName}: slot needs id and label`);
    }
    if (seen.has(s.id)) throw new Error(`${fileName}: duplicate slot ${s.id}`);
    seen.add(s.id);
    for (const field of ["prompts", "templates"]) {
      const list = s[field];
      if (!Array.isArray(list) || list.length === 0 || list.some((v) => typeof v !== "string" || !v.trim())) {
        throw new Error(`${fileName}: slot ${s.id}.${field} must be a non-empty array of strings`);
      }
    }
  }
  return family;
}

/** Read every *.json in a directory. A new family is a new file. */
export function loadFamilies(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Family directory not found: ${dir}`);
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error(`No family JSON files in ${dir}`);
  return files.map((name) => {
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    const data = JSON.parse(raw);
    return assertFamily(name, data);
  });
}
