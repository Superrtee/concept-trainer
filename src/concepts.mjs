const MAX_LABEL = 400;
const MAX_NOTE = 160;

/** @param {string} label */
export function conceptId(label) {
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return cleaned || "concept";
}

/**
 * @param {unknown} raw
 * @param {"builtin" | "custom"} source
 */
export function normalizeConcept(raw, source) {
  if (!raw || typeof raw !== "object") throw new Error("Concept must be an object.");
  const record = /** @type {Record<string, unknown>} */ (raw);
  const label = String(record.label ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const note = String(record.note ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!label) throw new Error("Concept is required.");
  if (label.length > MAX_LABEL) throw new Error(`Keep the concept under ${MAX_LABEL} characters.`);
  if (note.length > MAX_NOTE) throw new Error(`Keep the note under ${MAX_NOTE} characters.`);
  const id = typeof record.id === "string" && record.id.trim() ? conceptId(record.id) : conceptId(label);
  return { id, label, note, source };
}

/**
 * @param {unknown} data
 * @param {"builtin" | "custom"} source
 */
export function readConceptList(data, source) {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray(/** @type {{ concepts?: unknown }} */ (data).concepts)
      ? /** @type {{ concepts: unknown[] }} */ (data).concepts
      : null;
  if (!list) throw new Error("Concept file must be a list or { concepts: [] }.");
  return list.map((item) => normalizeConcept(item, source));
}

/**
 * Builtin first, then custom. Same label cannot appear twice.
 * @param {{ id: string, label: string, note: string, source: string }[]} builtin
 * @param {{ id: string, label: string, note: string, source: string }[]} custom
 */
export function mergeConcepts(builtin, custom) {
  /** @type {Map<string, { id: string, label: string, note: string, source: string }>} */
  const byLabel = new Map();
  for (const concept of builtin) byLabel.set(concept.label.toLowerCase(), concept);
  for (const concept of custom) {
    const key = concept.label.toLowerCase();
    if (byLabel.has(key)) continue;
    byLabel.set(key, concept);
  }
  return [...byLabel.values()];
}
