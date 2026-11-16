import { hashString, mulberry32 } from "./rng.mjs";

export const MIN_PAIRS = 1;
export const MAX_PAIRS = 200;
export const MAX_CONCEPT_LENGTH = 400;

/**
 * @typedef {Object} SlotDef
 * @property {string} id
 * @property {string} label
 * @property {string[]} prompts
 * @property {string[]} templates
 */

/**
 * @typedef {Object} Family
 * @property {string} id
 * @property {string} label
 * @property {boolean} [default]
 * @property {string[]} [keywords]
 * @property {Record<string, string[]>} lexicon
 * @property {SlotDef[]} slots
 */

/**
 * @param {string} template
 * @param {Record<string, string>} binding
 * @param {number} [depth]
 * @returns {string}
 */
export function fill(template, binding, depth = 0) {
  if (depth > 8) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, key) => {
    if (key === "concept") return binding.concept ?? whole;
    const value = binding[key];
    if (typeof value !== "string") return whole;
    return fill(value, binding, depth + 1);
  });
}

/** @param {string} text */
function asSentence(text) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * @param {string[]} list
 * @param {() => number} rng
 * @param {number} pairIndex
 */
function pickCycled(list, rng, pairIndex) {
  if (list.length === 0) throw new Error("Cannot sample an empty list");
  const start = Math.floor(rng() * list.length);
  const value = list[(start + pairIndex) % list.length];
  if (value === undefined) throw new Error("Cannot sample an empty list");
  return value;
}

/**
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 * @returns {T[]}
 */
function shuffle(items, rng) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

/**
 * @param {string} concept
 * @param {Family[]} families
 * @returns {Family}
 */
export function selectFamily(concept, families) {
  if (!families.length) throw new Error("No concept families loaded.");
  const text = concept.toLowerCase();
  /** @type {Family | null} */
  let best = null;
  let bestScore = 0;
  for (const family of families) {
    let score = 0;
    for (const keyword of family.keywords ?? []) {
      if (keyword && text.includes(keyword.toLowerCase())) score += keyword.length;
    }
    if (score > bestScore) {
      best = family;
      bestScore = score;
    }
  }
  if (best) return best;
  const fallback = families.find((family) => family.default) ?? families[0];
  if (!fallback) throw new Error("No concept families loaded.");
  return fallback;
}

/**
 * @param {string} concept
 * @param {Family} family
 * @param {number} pairIndex
 * @param {number} width
 */
function buildPair(concept, family, pairIndex, width) {
  const seed = hashString(`${family.id}\0${concept}\0${pairIndex}`);
  const rng = mulberry32(seed);

  /** @type {Record<string, string>} */
  const binding = { concept };
  const keys = Object.keys(family.lexicon).sort();
  for (const key of keys) {
    const values = family.lexicon[key];
    if (!values) continue;
    binding[key] = pickCycled(values, rng, pairIndex);
  }

  const ordered = shuffle(family.slots, rng);
  const lead = ordered[0];
  if (!lead) throw new Error(`Family ${family.id} has no slots`);

  const prompt = asSentence(fill(pickCycled(lead.prompts, rng, pairIndex), binding));
  const sections = ordered.map((slot) => {
    const body = asSentence(fill(pickCycled(slot.templates, rng, pairIndex), binding));
    return `${slot.label}: ${body}`;
  });

  const num = String(pairIndex).padStart(width, "0");
  return [
    `${num}  ${family.label.toUpperCase()}`,
    `concept: ${concept}`,
    "",
    "PROMPT",
    prompt,
    "",
    "RESPONSE",
    ...sections,
  ].join("\n");
}

/**
 * Swap point. UI and server call only this.
 * Same concept and pair index always return the same block.
 *
 * @param {{ concept: string, count: number, families: Family[] }} input
 * @returns {string}
 */
export function generatePairs(input) {
  const concept = String(input.concept ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const count = input.count;
  const families = input.families;

  if (!concept) throw new Error("Concept is required.");
  if (concept.length > MAX_CONCEPT_LENGTH) {
    throw new Error(`Keep the concept under ${MAX_CONCEPT_LENGTH} characters.`);
  }
  if (!Number.isInteger(count) || count < MIN_PAIRS || count > MAX_PAIRS) {
    throw new Error(`Pair count must be an integer from ${MIN_PAIRS} to ${MAX_PAIRS}.`);
  }
  if (!Array.isArray(families) || families.length === 0) {
    throw new Error("No concept families loaded.");
  }

  const family = selectFamily(concept, families);
  const blocks = [];
  for (let i = 1; i <= count; i++) {
    const width = Math.max(2, String(i).length);
    blocks.push(buildPair(concept, family, i, width));
  }
  return `${blocks.join("\n\n")}\n`;
}
