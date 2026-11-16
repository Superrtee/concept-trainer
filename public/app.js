const form = document.querySelector("#form");
const conceptInput = document.querySelector("#concept");
const countInput = document.querySelector("#count");
const output = document.querySelector("#output");
const status = document.querySelector("#status");
const generateButton = document.querySelector("#generate");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");
const conceptList = document.querySelector("#concepts");
const addForm = document.querySelector("#add-form");
const addLabel = document.querySelector("#add-label");
const addNote = document.querySelector("#add-note");

let lastConcept = "";
let concepts = [];

function setStatus(message, isError) {
  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
}

function slug(value) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return cleaned || "concept";
}

function setOutput(text) {
  output.value = text;
  const ready = text.length > 0;
  copyButton.disabled = !ready;
  downloadButton.disabled = !ready;
}

function renderConcepts() {
  conceptList.replaceChildren();
  const current = conceptInput.value.trim().toLowerCase();
  for (const concept of concepts) {
    const row = document.createElement("div");
    row.className = "item";
    row.setAttribute("role", "listitem");
    if (concept.label.toLowerCase() === current) row.classList.add("selected");

    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "pick";
    const title = document.createElement("strong");
    title.textContent = concept.label;
    pick.append(title);
    if (concept.note) {
      const note = document.createElement("span");
      note.textContent = concept.note;
      pick.append(note);
    }
    pick.addEventListener("click", () => {
      conceptInput.value = concept.label;
      renderConcepts();
      conceptInput.focus();
    });
    row.append(pick);

    if (concept.source === "custom") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "REMOVE";
      remove.addEventListener("click", () => removeConcept(concept.id));
      row.append(remove);
    }
    conceptList.append(row);
  }
}

async function loadConcepts() {
  const response = await fetch("/api/concepts");
  if (!response.ok) throw new Error(await response.text());
  concepts = await response.json();
  renderConcepts();
}

async function removeConcept(id) {
  const response = await fetch(`/api/concepts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const body = await response.text();
  if (!response.ok) {
    setStatus(body || "Could not remove concept.", true);
    return;
  }
  concepts = JSON.parse(body);
  renderConcepts();
  setStatus("Removed from this machine.", false);
}

conceptInput.addEventListener("input", renderConcepts);

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const label = addLabel.value.trim();
  const note = addNote.value.trim();
  if (!label) {
    setStatus("Concept is required.", true);
    return;
  }
  const response = await fetch("/api/concepts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, note }),
  });
  const body = await response.text();
  if (!response.ok) {
    setStatus(body || "Could not add concept.", true);
    return;
  }
  concepts = JSON.parse(body);
  addLabel.value = "";
  addNote.value = "";
  conceptInput.value = label;
  renderConcepts();
  setStatus("Added. It stays in data/concepts.user.json.", false);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const concept = conceptInput.value.trim();
  const count = Number(countInput.value);
  if (!concept) {
    setStatus("Concept is required.", true);
    return;
  }
  generateButton.disabled = true;
  setStatus("Generating.", false);
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept, count }),
    });
    const text = await response.text();
    if (!response.ok) {
      setOutput("");
      setStatus(text || "Could not generate pairs.", true);
      return;
    }
    lastConcept = concept;
    setOutput(text);
    const blocks = (text.match(/^\d+\s{2}/gm) || []).length;
    setStatus(`${blocks} pairs. Same concept and count always reprint the same text.`, false);
  } catch {
    setOutput("");
    setStatus("Generator did not respond.", true);
  } finally {
    generateButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  const text = output.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied.", false);
  } catch {
    output.focus();
    output.select();
    setStatus("Clipboard blocked. The text is selected — copy it from the field.", true);
  }
});

downloadButton.addEventListener("click", () => {
  const text = output.value;
  if (!text) return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `concept-trainer-${slug(lastConcept)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Download started.", false);
});

loadConcepts().catch((error) => {
  setStatus(error instanceof Error ? error.message : "Could not load concepts.", true);
});
