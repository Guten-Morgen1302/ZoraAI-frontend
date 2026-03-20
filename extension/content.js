(() => {
  "use strict";

  const API_URL = "http://127.0.0.1:8000/text/email/analyze/extension";
  const BUTTON_CONTAINER_ID = "zora-actions";
  const PANEL_ID = "zora-result-panel";
  const EXPLANATION_COMPACT_THRESHOLD = 260;

  function getSender() {
    const senderName = document.querySelector("span.gD")?.textContent?.trim() || "";
    const senderEmailRaw = document.querySelector("span.go")?.textContent?.trim() || "";
    const senderEmail = senderEmailRaw.replace(/[<>]/g, "").trim();

    if (senderName && senderEmail) {
      return `${senderName} <${senderEmail}>`;
    }
    return senderName || senderEmail || "Unknown Sender";
  }

  function getSubject() {
    return document.querySelector("h2.hP")?.textContent?.trim() || "";
  }

  function getBody() {
    const bodies = document.querySelectorAll("div.a3s.aiL");
    if (!bodies.length) {
      return "";
    }
    const lastBody = bodies[bodies.length - 1];
    return lastBody?.innerText?.trim() || "";
  }

  function extractEmailData(withLlmExplanation) {
    const sender = getSender();
    const subject = getSubject();
    const body = getBody();

    if (!subject || !body) {
      return null;
    }

    return {
      sender,
      subject,
      body,
      with_llm_explanation: Boolean(withLlmExplanation),
    };
  }

  function removePreviousPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.remove();
    }
  }

  function showPanel(contentHtml) {
    removePreviousPanel();
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = contentHtml;
    document.body.appendChild(panel);

    const closeButton = panel.querySelector(".zora-panel-close");
    closeButton?.addEventListener("click", () => {
      panel.remove();
    });

    const toggleButton = panel.querySelector(".zora-explanation-toggle");
    if (toggleButton) {
      toggleButton.addEventListener("click", () => {
        const explanation = panel.querySelector(".zora-explanation-content");
        if (!explanation) {
          return;
        }

        const isCollapsed = explanation.classList.toggle("zora-collapsed");
        toggleButton.textContent = isCollapsed ? "Show more" : "Show less";
      });
    }
  }

  function renderPanelHeader() {
    return `
      <div class="zora-panel-header">
        <div class="zora-title">Zora AI Mail Analysis</div>
        <button type="button" class="zora-panel-close" aria-label="Close analysis panel">x</button>
      </div>
    `;
  }

  function renderExplanationSection(explanation) {
    const safeExplanation = escapeHtml(explanation);
    const shouldCompact = explanation.length > EXPLANATION_COMPACT_THRESHOLD;
    const collapsedClass = shouldCompact ? "zora-collapsed" : "";

    return `
      <div class="zora-row">
        <span class="zora-label">Explanation:</span>
        <div class="zora-explanation-content ${collapsedClass}">${safeExplanation}</div>
        ${shouldCompact ? '<button type="button" class="zora-explanation-toggle">Show more</button>' : ""}
      </div>
    `;
  }

  function setPhishingHighlight(shouldHighlight) {
    const bodies = document.querySelectorAll("div.a3s.aiL");
    if (!bodies.length) {
      return;
    }

    const lastBody = bodies[bodies.length - 1];
    if (!lastBody) {
      return;
    }

    if (shouldHighlight) {
      lastBody.classList.add("zora-highlight-phishing");
      return;
    }
    lastBody.classList.remove("zora-highlight-phishing");
  }

  function showResult(result) {
    const predictionRaw = String(result?.fraud_type || result?.llm_label || result?.nlp_prediction?.label || "unknown");
    const prediction = predictionRaw.toLowerCase();

    const confidenceValue = Number(result?.confidence ?? result?.llm_confidence ?? 0);
    const confidenceText = Number.isFinite(confidenceValue)
      ? `${(confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue).toFixed(2)}%`
      : "N/A";

    const explanation = result?.llm_explanation || "No explanation returned.";
    const isPhishing = prediction === "phishing";

    setPhishingHighlight(isPhishing);

    const predictionClass = isPhishing ? "zora-prediction-phishing" : "zora-prediction-safe";

    showPanel(`
      ${renderPanelHeader()}
      <div class="zora-row">
        <span class="zora-label">Prediction:</span>
        <span class="${predictionClass}">${predictionRaw}</span>
      </div>
      <div class="zora-row">
        <span class="zora-label">Confidence:</span>
        <span>${confidenceText}</span>
      </div>
      ${renderExplanationSection(explanation)}
    `);
  }

  function showLoader() {
    showPanel(`
      ${renderPanelHeader()}
      <div class="zora-loader">Analyzing...</div>
    `);
  }

  function showError(message) {
    setPhishingHighlight(false);
    showPanel(`
      ${renderPanelHeader()}
      <div class="zora-row">
        <span class="zora-label">Error:</span>
        <span>${escapeHtml(message)}</span>
      </div>
    `);
  }

  async function analyzeEmail(withLlmExplanation) {
    const payload = extractEmailData(withLlmExplanation);
    if (!payload) {
      showError("Could not extract full email data from this view.");
      return;
    }

    showLoader();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText || "Unknown error"}`);
      }

      const result = await response.json();
      showResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(message);
    }
  }

  function createButton(text, withLlmExplanation) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zora-btn";
    button.textContent = text;
    button.addEventListener("click", () => {
      analyzeEmail(withLlmExplanation);
    });
    return button;
  }

  function injectButtons() {
    if (document.querySelector(".zora-btn")) {
      return;
    }

    const subjectElement = document.querySelector("h2.hP");
    if (!subjectElement) {
      return;
    }

    const container = document.createElement("div");
    container.id = BUTTON_CONTAINER_ID;
    container.className = "zora-actions";

    const analyzeBtn = createButton("Analyze Mail", false);
    const analyzeExplainBtn = createButton("Analyze + Explain", true);

    container.appendChild(analyzeBtn);
    container.appendChild(analyzeExplainBtn);

    subjectElement.insertAdjacentElement("afterend", container);
  }

  function isEmailOpen() {
    return document.querySelector("h2.hP") !== null;
  }

  function ensureUiState() {
    if (!isEmailOpen()) {
      const existingContainer = document.getElementById(BUTTON_CONTAINER_ID);
      if (existingContainer) {
        existingContainer.remove();
      }
      return;
    }

    injectButtons();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
  }

  let observerDebounce;

  const observer = new MutationObserver(() => {
    window.clearTimeout(observerDebounce);
    observerDebounce = window.setTimeout(() => {
      ensureUiState();
    }, 120);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  ensureUiState();
})();
