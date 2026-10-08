"use strict";

const dropZone = document.getElementById("drop-zone");
const dropConfirm = document.getElementById("drop-confirm");
const fileInput = document.getElementById("file-input");
const fileListSection = document.getElementById("file-list-section");
const fileListEl = document.getElementById("file-list");
const fileCountEl = document.getElementById("file-count");
const cleanAllBtn = document.getElementById("clean-all-btn");
const clearAllBtn = document.getElementById("clear-all-btn");

const optEnhance = document.getElementById("opt-enhance");
const optUpscaleMode = document.getElementById("opt-upscale-mode");
const upscaleHelp = document.getElementById("upscale-help");
const optFingerprint = document.getElementById("opt-fingerprint");
const noiseLevelRow = document.getElementById("noise-level-row");
const optNoiseLevel = document.getElementById("opt-noise-level");
const optQuality = document.getElementById("opt-quality");
const optQualityVal = document.getElementById("opt-quality-val");
const optFormat = document.getElementById("opt-format");
const optStripZwj = document.getElementById("opt-strip-zwj");
const optNormalizeTypography = document.getElementById("opt-normalize-typography");

const imageOptionsEl = document.getElementById("image-options");
const textOptionsEl = document.getElementById("text-options");
const docOptionsEl = document.getElementById("doc-options");
const advancedDetailsEl = document.getElementById("advanced-details");
const noFilesNoteEl = document.getElementById("no-files-note");

const writingFile = document.getElementById("writing-file");
let writingSourceFile = null;
const writingInput = document.getElementById("writing-input");
const writingOutput = document.getElementById("writing-output");
const writingStatus = document.getElementById("writing-status");
const rewriteButton = document.getElementById("rewrite-btn");
const grammarCheckButton = document.getElementById("grammar-check-btn");
const downloadRevision = document.getElementById("download-revision");
const useRevision = document.getElementById("use-revision");
const downloadDocx = document.getElementById("download-docx");
const downloadDraft = document.getElementById("download-draft");
const writingMode = document.getElementById("writing-mode");
const taskPrompt = document.getElementById("task-prompt");
const taskPromptLabel = document.getElementById("task-prompt-label");
const taskPromptHelp = document.getElementById("task-prompt-help");
const writingFeedback = document.getElementById("writing-feedback");
const wordCount = document.getElementById("word-count");
const modeGuidance = document.getElementById("mode-guidance");
const examDisclaimer = document.getElementById("exam-disclaimer");
const targetLevelField = document.getElementById("target-level-field");
const targetLevel = document.getElementById("target-level");

function updateTargetLevels() {
  const mode = writingMode.value;
  const choices = mode.startsWith("ielts_")
    ? ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9"].map((v) => [`ielts-${v}`, `IELTS Band ${v}`])
    : mode.startsWith("pte_")
      ? Array.from({ length: 81 }, (_, i) => String(i + 10)).map((v) => [`pte-${v}`, `PTE ${v}`])
      : [["accessible", "Accessible English"], ["academic", "General academic English"], ["advanced", "Advanced academic English"]];
  targetLevel.replaceChildren();
  choices.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    targetLevel.appendChild(option);
  });
  if (mode.startsWith("ielts_")) targetLevel.value = "ielts-6.5";
  else if (mode.startsWith("pte_")) targetLevel.value = "pte-65";
  else targetLevel.value = "academic";
  document.getElementById("target-level-label").textContent = mode.startsWith("ielts_")
    ? "Target IELTS band"
    : mode.startsWith("pte_")
      ? "Target PTE score (10–90)"
      : "English level";
  targetLevelField.hidden = mode === "general";
}

function updateWritingMode() {
  const examMode = writingMode.value !== "general";
  examDisclaimer.hidden = !examMode;
  taskPrompt.hidden = !examMode;
  taskPromptLabel.hidden = !examMode;
  taskPromptHelp.hidden = !examMode;
  const guidance = {
    general: "Grammar, spelling, punctuation, word choice, and sentence clarity.",
    ielts_task1: "IELTS Academic Task 1: at least 150 words. Feedback uses Task Achievement, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy.",
    ielts_task2: "IELTS Academic Task 2: at least 250 words. Feedback uses Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy.",
    pte_essay: "PTE Academic Write Essay: 200–300 words. Feedback checks content, organization, form, language range, grammar, spelling, and vocabulary.",
    pte_swt: "PTE Academic Summarize Written Text: one sentence, 5–75 words. Feedback checks source accuracy, form, grammar, and vocabulary.",
  };
  modeGuidance.textContent = guidance[writingMode.value];
  if (examMode) {
    taskPromptLabel.textContent = writingMode.value === "pte_swt" ? "Source passage" : "Task question / prompt";
    taskPromptHelp.textContent = writingMode.value === "ielts_task1"
      ? "Include the chart or diagram values in text form. Feedback checks overview, key features, comparisons, and accuracy; it cannot read chart images."
      : writingMode.value === "pte_swt"
        ? "Paste the passage the response summarizes. The practice check looks for one sentence and the current 5–75 word limit."
        : "Paste the exact task. Feedback checks relevance to the prompt, development, organization, vocabulary, grammar, and the task word range where applicable.";
  }
}

function updateWordCount() {
  const count = writingInput.value.trim() ? writingInput.value.trim().split(/\s+/u).length : 0;
  const ranges = { ielts_task1: " · minimum 150", ielts_task2: " · minimum 250", pte_essay: " · target 200–300", pte_swt: " · target 5–75, one sentence" };
  wordCount.textContent = `Approx. ${count} ${count === 1 ? "word" : "words"}${ranges[writingMode.value] || ""}`;
  downloadDraft.disabled = !writingInput.value.trim();
  downloadDocx.disabled = !writingInput.value.trim();
}

function addFeedbackText(parent, tag, text, className) {
  if (!text) return;
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.appendChild(node);
}

function renderWritingFeedback(data) {
  writingFeedback.replaceChildren();
  if (data.summary) addFeedbackText(writingFeedback, "p", data.summary);
  if (Array.isArray(data.strengths) && data.strengths.length) {
    addFeedbackText(writingFeedback, "h3", "What is working");
    const list = document.createElement("ul");
    data.strengths.forEach((item) => addFeedbackText(list, "li", item));
    writingFeedback.appendChild(list);
  }
  if (Array.isArray(data.improvements) && data.improvements.length) {
    addFeedbackText(writingFeedback, "h3", "Grammar and writing suggestions");
    data.improvements.forEach((item) => {
      const card = document.createElement("article");
      card.className = "feedback-item";
      addFeedbackText(card, "strong", item.category || "Suggestion");
      if (item.original) addFeedbackText(card, "p", `Your text: ${item.original}`);
      if (item.suggestion) addFeedbackText(card, "p", `Suggested: ${item.suggestion}`);
      if (item.reason) addFeedbackText(card, "p", item.reason);
      const actions = document.createElement("div");
      actions.className = "feedback-actions";
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "secondary-btn";
      apply.textContent = "Apply to draft";
      apply.disabled = !item.original || !item.suggestion;
      apply.addEventListener("click", () => {
        const start = writingInput.value.indexOf(item.original);
        if (start < 0) {
          writingStatus.textContent = "That exact wording is no longer in the draft; review the suggestion and edit it manually.";
          return;
        }
        writingInput.value = writingInput.value.slice(0, start) + item.suggestion + writingInput.value.slice(start + item.original.length);
        updateWordCount();
        apply.disabled = true;
        apply.textContent = "Applied";
        writingStatus.textContent = "Suggestion applied to the draft. Review the change before downloading.";
      });
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "secondary-btn";
      dismiss.textContent = "Dismiss";
      dismiss.addEventListener("click", () => {
        card.remove();
        writingFeedback.hidden = !writingFeedback.childElementCount;
      });
      actions.append(apply, dismiss);
      card.appendChild(actions);
      writingFeedback.appendChild(card);
    });
  }
  if (Array.isArray(data.exam_feedback) && data.exam_feedback.length) {
    addFeedbackText(writingFeedback, "h3", "Exam practice feedback");
    data.exam_feedback.forEach((item) => {
      const card = document.createElement("article");
      card.className = "feedback-item";
      addFeedbackText(card, "strong", item.criterion || "Criterion");
      addFeedbackText(card, "p", item.feedback || "");
      writingFeedback.appendChild(card);
    });
  }
  if (Array.isArray(data.task_checks) && data.task_checks.length) {
    addFeedbackText(writingFeedback, "h3", "Task form checks");
    data.task_checks.forEach((check) => addFeedbackText(writingFeedback, "p", check));
  }
  writingFeedback.hidden = !writingFeedback.childElementCount;
}

writingMode.addEventListener("change", () => { updateWritingMode(); updateWordCount(); });
writingMode.addEventListener("change", updateTargetLevels);
writingInput.addEventListener("input", updateWordCount);
updateWritingMode();
updateTargetLevels();

grammarCheckButton.addEventListener("click", async () => {
  if (!writingInput.value.trim()) {
    writingStatus.textContent = "Add or open a draft first.";
    return;
  }
  grammarCheckButton.disabled = true;
  writingStatus.textContent = "Checking English grammar with local LanguageTool…";
  try {
    const response = await fetch("/api/grammar-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: writingInput.value,
        english_variety: document.getElementById("writing-variety").value,
      }),
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Grammar check failed");
    writingFeedback.replaceChildren();
    addFeedbackText(writingFeedback, "h3", "Grammar and spelling suggestions");
    if (!data.matches.length) {
      addFeedbackText(writingFeedback, "p", "No issues found by the available grammar checks.");
    }
    data.matches.forEach((match) => {
      const card = document.createElement("article");
      card.className = "feedback-item";
      addFeedbackText(card, "strong", match.category || "Grammar");
      addFeedbackText(card, "p", match.message || "Review this phrase.");
      const original = writingInput.value.slice(match.offset, match.offset + match.length);
      if (original) addFeedbackText(card, "p", `Your text: ${original}`);
      const replacement = Array.isArray(match.replacements) ? match.replacements[0] : "";
      if (replacement) addFeedbackText(card, "p", `Suggested: ${replacement}`);
      const actions = document.createElement("div");
      actions.className = "feedback-actions";
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "secondary-btn";
      apply.textContent = "Apply suggestion";
      apply.disabled = !replacement || !original;
      apply.addEventListener("click", () => {
        const current = writingInput.value.slice(match.offset, match.offset + match.length);
        if (current !== original) {
          writingStatus.textContent = "The draft changed since this check. Run the grammar check again before applying this suggestion.";
          return;
        }
        writingInput.value = writingInput.value.slice(0, match.offset) + replacement + writingInput.value.slice(match.offset + match.length);
        updateWordCount();
        apply.disabled = true;
        apply.textContent = "Applied";
        writingStatus.textContent = "Grammar suggestion applied. Review the result in context.";
      });
      actions.appendChild(apply);
      card.appendChild(actions);
      writingFeedback.appendChild(card);
    });
    writingFeedback.hidden = false;
    writingStatus.textContent = "Local LanguageTool check complete. Review each suggestion before applying it.";
  } catch (error) {
    writingStatus.textContent = String(error).includes("could not reach local LanguageTool")
      ? `${String(error)} Install and start the LanguageTool local HTTP server.`
      : String(error);
  } finally {
    grammarCheckButton.disabled = false;
  }
});

writingFile.addEventListener("change", async () => {
  const file = writingFile.files && writingFile.files[0];
  if (!file) return;
  writingStatus.textContent = `Extracting text from ${file.name}…`;
  const form = new FormData();
  form.append("file", file, file.name);
  try {
    const response = await fetch("/api/extract-text", { method: "POST", body: form });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Could not extract text");
    writingSourceFile = file;
    writingInput.value = data.text;
    updateWordCount();
    writingOutput.value = "";
    writingFeedback.hidden = true;
    downloadRevision.disabled = true;
    useRevision.disabled = true;
    writingStatus.textContent = `Loaded ${file.name}. Check the extracted text before revising.`;
  } catch (error) {
    writingStatus.textContent = String(error);
  }
});

rewriteButton.addEventListener("click", async () => {
  if (!writingInput.value.trim()) {
    writingStatus.textContent = "Add or open a draft first.";
    return;
  }
  rewriteButton.disabled = true;
  writingOutput.value = "";
  writingFeedback.hidden = true;
  downloadRevision.disabled = true;
  useRevision.disabled = true;
  writingStatus.textContent = "Revising with your local Ollama model…";
  try {
    const response = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: writingInput.value,
        mode: writingMode.value,
        target_level: targetLevel.value,
        task_prompt: taskPrompt.value,
        english_variety: document.getElementById("writing-variety").value,
        tone: document.getElementById("writing-tone").value,
        model: document.getElementById("writing-model").value.trim(),
        voice_sample: document.getElementById("voice-sample").value,
      }),
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Revision failed");
    writingOutput.value = data.revision;
    renderWritingFeedback(data);
    downloadRevision.disabled = false;
    downloadDocx.disabled = false;
    downloadDraft.disabled = false;
    useRevision.disabled = false;
    writingStatus.textContent = "Revision ready. Review it for meaning and factual accuracy before use.";
  } catch (error) {
    const message = String(error);
    writingStatus.textContent = message.includes("could not reach")
      ? `${message}. Start Ollama and pull the selected model.`
      : message;
  } finally {
    rewriteButton.disabled = false;
  }
});

useRevision.addEventListener("click", () => {
  if (!writingOutput.value) return;
  writingInput.value = writingOutput.value;
  updateWordCount();
  writingStatus.textContent = "Revision moved into the draft. You can edit it, run another pass, or download it.";
});

downloadDocx.addEventListener("click", async () => {
  if (!writingOutput.value) return;
  downloadDocx.disabled = true;
  writingStatus.textContent = "Preparing Word document…";
  try {
    const form = new FormData();
    form.append("file", writingSourceFile || new Blob([writingInput.value], { type: "text/plain" }), writingSourceFile?.name || "draft.txt");
    form.append("text", writingInput.value);
    const response = await fetch("/api/export-document", { method: "POST", body: form });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Export failed");
    downloadBase64(data.data_base64, data.filename, data.mime);
    const sourceName = writingSourceFile?.name.toLowerCase() || "";
    writingStatus.textContent = sourceName.endsWith(".docx")
      ? "Word document downloaded with the source package and layout preserved. Review the revised paragraphs."
      : sourceName.endsWith(".pdf")
        ? "PDF downloaded with the original pages preserved and revised text appended."
        : "Word document downloaded with the current draft.";
  } catch (error) {
    writingStatus.textContent = String(error);
  } finally {
    downloadDocx.disabled = false;
  }
});

downloadRevision.addEventListener("click", () => {
  if (!writingOutput.value) return;
  const blob = new Blob([writingOutput.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "revised-draft.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

downloadDraft.addEventListener("click", () => {
  if (!writingInput.value) return;
  const blob = new Blob([writingInput.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "edited-draft.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

// Plain-language noise-level choices, mapped to the underlying
// strength/fraction knobs so nobody has to understand those directly.
const NOISE_LEVELS = {
  light: { strength: 1, fraction: 0.15 },
  medium: { strength: 2, fraction: 0.25 },
  strong: { strength: 3, fraction: 0.4 },
};

const UPSCALE_HELP = {
  none: "Enlarges the image using high-quality resampling — sharper resize, doesn't invent detail that wasn't captured.",
  "classical-2": "Enlarges the image using high-quality resampling — sharper resize, doesn't invent detail that wasn't captured.",
  "classical-4": "Enlarges the image using high-quality resampling — sharper resize, doesn't invent detail that wasn't captured.",
  "ai-4": "Uses a real AI model to invent plausible detail while enlarging 4× — genuinely improves low-res images, but the added detail is generated, not recovered from the original.",
};

optUpscaleMode.addEventListener("change", () => {
  upscaleHelp.textContent = UPSCALE_HELP[optUpscaleMode.value] || UPSCALE_HELP.none;
});

optQuality.addEventListener("input", () => (optQualityVal.textContent = optQuality.value));
optFingerprint.addEventListener("change", () => {
  noiseLevelRow.hidden = !optFingerprint.checked;
});

/** @type {Map<string, {file: File, id: string, inspect: object|null, inspectError: string|null, cleanState: "idle"|"working"|"done"|"error", cleanError: string|null, isNew: boolean}>} */
const entries = new Map();
let nextId = 0;
let confirmTimer = null;

function fileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".text", ".html", ".htm", ".svg"];
const DOC_EXTENSIONS = [".docx", ".xlsx", ".pptx"];
const PDF_EXTENSIONS = [".pdf"];
const MEDIA_EXTENSIONS = [".mp3", ".mp4", ".m4a", ".m4v", ".mov"];

function isTextFile(file) {
  const name = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isDocFile(file) {
  const name = file.name.toLowerCase();
  return DOC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isPdfFile(file) {
  const name = file.name.toLowerCase();
  return PDF_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isMediaFile(file) {
  const name = file.name.toLowerCase();
  return MEDIA_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function addFiles(fileList) {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  const existingKeys = new Set(Array.from(entries.values()).map((e) => fileKey(e.file)));
  let added = 0;
  let duplicates = 0;
  const newIds = [];

  for (const file of files) {
    if (existingKeys.has(fileKey(file))) {
      duplicates++;
      continue;
    }
    existingKeys.add(fileKey(file));
    const id = `f${nextId++}`;
    entries.set(id, {
      file,
      id,
      isText: isTextFile(file),
      isDoc: isDocFile(file),
      isPdf: isPdfFile(file),
      isMedia: isMediaFile(file),
      inspect: null,
      inspectError: null,
      cleanState: "idle",
      cleanError: null,
      isNew: true,
    });
    newIds.push(id);
    added++;
  }

  showDropConfirm(added, duplicates);

  if (added === 0) return;

  fileListSection.hidden = false;
  render();
  fileListSection.scrollIntoView({ behavior: "smooth", block: "nearest" });

  for (const id of newIds) {
    runInspect(id);
  }

  // Drop the "just added" highlight after it's had a moment to be seen.
  setTimeout(() => {
    for (const id of newIds) {
      const entry = entries.get(id);
      if (entry) entry.isNew = false;
    }
    render();
  }, 2000);
}

function showDropConfirm(added, duplicates) {
  if (confirmTimer) clearTimeout(confirmTimer);
  let message;
  if (added > 0 && duplicates > 0) {
    message = `✓ Added ${added} image${added === 1 ? "" : "s"} (${duplicates} already in the list)`;
  } else if (added > 0) {
    message = `✓ Added ${added} image${added === 1 ? "" : "s"} — see below`;
  } else {
    message = `Already in the list below — nothing new added`;
  }
  dropConfirm.textContent = message;
  dropConfirm.hidden = false;
  confirmTimer = setTimeout(() => {
    dropConfirm.hidden = true;
  }, 4000);
}

function clearAll() {
  entries.clear();
  fileListSection.hidden = true;
  fileListEl.innerHTML = "";
  render();
}

async function runInspect(id) {
  const entry = entries.get(id);
  if (!entry) return;
  const form = new FormData();
  form.append("file", entry.file, entry.file.name);
  let endpoint = "/api/inspect";
  if (entry.isText) endpoint = "/api/inspect-text";
  else if (entry.isDoc) endpoint = "/api/inspect-doc";
  else if (entry.isPdf) endpoint = "/api/inspect-pdf";
  else if (entry.isMedia) endpoint = "/api/inspect-media";
  try {
    const res = await fetch(endpoint, { method: "POST", body: form });
    const data = await res.json();
    if (data.ok) {
      entry.inspect = data;
    } else {
      entry.inspectError = data.error || "inspect failed";
    }
  } catch (e) {
    entry.inspectError = String(e);
  }
  render();
}

async function runClean(id) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.cleanState = "working";
  entry.cleanError = null;
  render();

  const form = new FormData();
  form.append("file", entry.file, entry.file.name);

  let endpoint = "/api/clean";
  if (entry.isText) {
    endpoint = "/api/clean-text";
    form.append("strip_zero_width_joiner", optStripZwj.checked ? "true" : "false");
    form.append("normalize_typography", optNormalizeTypography.checked ? "true" : "false");
  } else if (entry.isDoc) {
    endpoint = "/api/clean-doc";
  } else if (entry.isPdf) {
    endpoint = "/api/clean-pdf";
  } else if (entry.isMedia) {
    endpoint = "/api/clean-media";
  } else {
    const noise = NOISE_LEVELS[optNoiseLevel.value] || NOISE_LEVELS.medium;
    form.append("enhance", optEnhance.checked ? "true" : "false");
    form.append("reset_fingerprint", optFingerprint.checked ? "true" : "false");
    form.append("fingerprint_strength", String(noise.strength));
    form.append("fingerprint_fraction", String(noise.fraction));
    form.append("jpeg_quality", optQuality.value);

    const mode = optUpscaleMode.value;
    if (mode === "classical-2") form.append("upscale", "2");
    else if (mode === "classical-4") form.append("upscale", "4");
    else if (mode === "ai-4") form.append("ai_upscale", "true");

    if (optFormat.value) form.append("format", optFormat.value);
  }

  try {
    const res = await fetch(endpoint, { method: "POST", body: form });
    const data = await res.json();
    if (!data.ok) {
      entry.cleanState = "error";
      entry.cleanError = data.error || "clean failed";
      render();
      return;
    }
    downloadBase64(data.data_base64, data.filename, data.mime);
    entry.cleanState = "done";
    entry.cleanReport = data;
  } catch (e) {
    entry.cleanState = "error";
    entry.cleanError = String(e);
  }
  render();
}

function downloadBase64(base64, filename, mime) {
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  const blob = new Blob([buf], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function render() {
  fileListEl.innerHTML = "";
  for (const entry of entries.values()) {
    fileListEl.appendChild(renderCard(entry));
  }
  const anyWorking = Array.from(entries.values()).some((e) => e.cleanState === "working");
  cleanAllBtn.disabled = entries.size === 0 || anyWorking;
  fileCountEl.textContent = entries.size > 0 ? `(${entries.size})` : "";
  updateOptionsVisibility();
}

// Options adapt to what's actually in the file list: image controls
// (enhance/upscale/fingerprint/format/quality) only make sense for images,
// text controls only make sense for text files. Before anything is
// dropped, default to showing the image options since that's the primary
// use case.
function updateOptionsVisibility() {
  const all = Array.from(entries.values());
  const hasImages = all.some((e) => !e.isText && !e.isDoc && !e.isPdf && !e.isMedia);
  const hasText = all.some((e) => e.isText);
  const hasDocs = all.some((e) => e.isDoc);

  imageOptionsEl.hidden = !hasImages;
  advancedDetailsEl.hidden = !hasImages;
  textOptionsEl.hidden = !hasText;
  docOptionsEl.hidden = !hasDocs;
  noFilesNoteEl.hidden = all.length > 0;
}

function renderCard(entry) {
  const card = document.createElement("div");
  card.className = entry.isNew ? "file-card file-card-new" : "file-card";

  const header = document.createElement("div");
  header.className = "file-card-header";

  const name = document.createElement("span");
  name.className = "file-name";
  name.textContent = entry.file.name;
  header.appendChild(name);

  const meta = document.createElement("span");
  meta.className = "file-meta";
  if (entry.inspect && entry.isText) {
    meta.textContent = `text · ${entry.inspect.char_count} chars`;
  } else if (entry.inspect && entry.isDoc) {
    meta.textContent = "office document";
  } else if (entry.inspect && entry.isPdf) {
    meta.textContent = "PDF document";
  } else if (entry.inspect && entry.isMedia) {
    meta.textContent = "audio/video file";
  } else if (entry.inspect) {
    meta.textContent = `${entry.inspect.format.toUpperCase()} ${entry.inspect.width}x${entry.inspect.height} · ${formatBytes(entry.inspect.bytes)}`;
  } else if (entry.inspectError) {
    meta.textContent = "unreadable";
  } else {
    meta.textContent = "inspecting…";
  }
  header.appendChild(meta);

  card.appendChild(header);

  if (entry.inspect) {
    const frontmatterFindings = entry.inspect.frontmatter_findings || [];
    const htmlFindings = entry.inspect.html_findings || [];
    const svgFindings = entry.inspect.svg_findings || [];
    const typographyFindings = entry.inspect.typography_findings || [];
    const totalFindings =
      entry.inspect.findings.length +
      frontmatterFindings.length +
      htmlFindings.length +
      svgFindings.length +
      typographyFindings.length;

    const badge = document.createElement("span");
    if (entry.inspect.clean) {
      badge.className = "badge badge-ok";
      badge.textContent = entry.isText
        ? "no hidden characters found"
        : entry.isDoc || entry.isPdf || entry.isMedia
          ? "no identifying metadata found"
          : "no metadata found";
    } else {
      badge.className = "badge badge-warn";
      badge.textContent = `${totalFindings} finding${totalFindings === 1 ? "" : "s"}`;
    }
    card.appendChild(badge);

    if (totalFindings > 0) {
      const findings = document.createElement("div");
      findings.className = "findings";
      for (const f of entry.inspect.findings) {
        const row = document.createElement("div");
        row.className = "finding-row";
        const cat = document.createElement("span");
        cat.className = "cat";
        cat.textContent = entry.isDoc
          ? `[${f.part}]`
          : entry.isPdf || entry.isMedia
            ? `[${f.location}]`
            : `[${f.category}]`;
        const label = document.createElement("span");
        if (entry.isText) {
          label.textContent = `${f.codepoint} ×${f.count}`;
        } else if (entry.isDoc || entry.isPdf || entry.isMedia) {
          label.textContent = `${f.field} = ${f.value}`;
        } else {
          label.textContent = `${f.label} (${formatBytes(f.size_bytes)})`;
        }
        row.appendChild(cat);
        row.appendChild(label);
        findings.appendChild(row);
      }
      for (const f of frontmatterFindings) {
        const row = document.createElement("div");
        row.className = "finding-row";
        const cat = document.createElement("span");
        cat.className = "cat";
        cat.textContent = "[frontmatter]";
        const label = document.createElement("span");
        label.textContent = `${f.key}: ${f.value}`;
        row.appendChild(cat);
        row.appendChild(label);
        findings.appendChild(row);
      }
      for (const f of htmlFindings) {
        const row = document.createElement("div");
        row.className = "finding-row";
        const cat = document.createElement("span");
        cat.className = "cat";
        cat.textContent = f.kind === "comment" ? "[html comment]" : "[html meta]";
        const label = document.createElement("span");
        label.textContent = f.kind === "comment" ? f.value : `${f.label}: ${f.value}`;
        row.appendChild(cat);
        row.appendChild(label);
        findings.appendChild(row);
      }
      for (const f of svgFindings) {
        const row = document.createElement("div");
        row.className = "finding-row";
        const cat = document.createElement("span");
        cat.className = "cat";
        cat.textContent =
          f.kind === "comment" ? "[svg comment]" : f.kind === "metadata-element" ? "[svg metadata]" : "[svg attr]";
        const label = document.createElement("span");
        label.textContent = f.value ? `${f.label}: ${f.value}` : f.label;
        row.appendChild(cat);
        row.appendChild(label);
        findings.appendChild(row);
      }
      for (const f of typographyFindings) {
        const row = document.createElement("div");
        row.className = "finding-row";
        const cat = document.createElement("span");
        cat.className = "cat";
        cat.textContent = `[typography:${f.kind}]`;
        const label = document.createElement("span");
        label.textContent = `${f.codepoint} ×${f.count}`;
        row.appendChild(cat);
        row.appendChild(label);
        findings.appendChild(row);
      }
      card.appendChild(findings);
    }
  } else if (entry.inspectError) {
    const badge = document.createElement("span");
    badge.className = "badge badge-err";
    badge.textContent = "error";
    card.appendChild(badge);
    const err = document.createElement("div");
    err.className = "status-line err";
    err.textContent = entry.inspectError;
    card.appendChild(err);
  }

  if (entry.cleanState === "working") {
    const s = document.createElement("div");
    s.className = "status-line";
    s.textContent =
      optUpscaleMode.value === "ai-4" ? "AI upscaling — may take a few seconds…" : "cleaning…";
    card.appendChild(s);
  } else if (entry.cleanState === "done") {
    const s = document.createElement("div");
    s.className = "status-line";
    s.textContent = "cleaned and downloaded";
    card.appendChild(s);
  } else if (entry.cleanState === "error") {
    const s = document.createElement("div");
    s.className = "status-line err";
    s.textContent = entry.cleanError;
    card.appendChild(s);
  }

  return card;
}

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

cleanAllBtn.addEventListener("click", () => {
  for (const id of entries.keys()) runClean(id);
});

clearAllBtn.addEventListener("click", clearAll);
