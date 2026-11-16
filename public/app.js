const form = document.querySelector("#form");
const conceptInput = document.querySelector("#concept");
const countInput = document.querySelector("#count");
const output = document.querySelector("#output");
const status = document.querySelector("#status");
const generateButton = document.querySelector("#generate");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");

let lastConcept = "";

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
