"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import { Radar, Bar } from "react-chartjs-2";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, CategoryScale, LinearScale, BarElement);

/* ── Color helpers ── */
function riskColor(score: number) {
  if (score >= 0.7) return { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.4)", fill: "rgba(239,68,68,0.12)" };
  if (score >= 0.4) return { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.4)", fill: "rgba(245,158,11,0.12)" };
  return { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.4)", fill: "rgba(34,197,94,0.12)" };
}
function riskLabel(score: number) {
  if (score >= 0.7) return "High Risk";
  if (score >= 0.4) return "Medium Risk";
  return "Low Risk";
}
function barColor(score: number) {
  if (score >= 0.7) return "#ef4444";
  if (score >= 0.4) return "#f59e0b";
  return "#22c55e";
}
function riskBadgeColor(score: number | null) {
  if (score === null) return "bg-white/[0.05] text-white/30";
  if (score >= 0.7) return "bg-red-500/15 text-red-400";
  if (score >= 0.4) return "bg-amber-500/15 text-amber-400";
  return "bg-emerald-500/15 text-emerald-400";
}

/* ── Types ── */
interface EmailAnalysisResult {
  request_id?: string | null;
  message_id: string;
  thread_id: string | null;
  sender: string;
  subject: string;
  body: string;
  risk_score: number;
  nlp_score: number;
  similarity_score: number;
  stylometry_score: number;
  confidence: number;
  fraud_type: string;
  nlp_prediction: Record<string, unknown>;
  similarity: Record<string, unknown>;
  llm_enhanced: boolean;
  llm_explanation: string | null;
  llm_label: string | null;
  llm_confidence: number | null;
}

interface HistoryItem {
  request_id: string;
  text: string;
  subject: string | null;
  created_at: string | null;
  risk_score: number | null;
  fraud_type: string | null;
}

type EmailFeedbackLabel = "phishing" | "genuine";
type EmailFeedbackType = "correct" | "incorrect" | "modified";

export default function EmailAnalyzerPage() {
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeLLM, setIncludeLLM] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EmailAnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryRequestId, setSelectedHistoryRequestId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [humanLabel, setHumanLabel] = useState<EmailFeedbackLabel>("phishing");
  const [feedbackType, setFeedbackType] = useState<EmailFeedbackType>("incorrect");
  const [feedbackNotes, setFeedbackNotes] = useState("");

  const inferHumanLabelFromFraudType = (fraudType?: string): EmailFeedbackLabel => {
    const normalized = (fraudType || "").trim().toLowerCase();
    if (normalized === "genuine" || normalized === "safe" || normalized === "legitimate") {
      return "genuine";
    }
    return "phishing";
  };

  const getEmailModelPrediction = (analysis: EmailAnalysisResult): string => {
    const rawLabel = (analysis.nlp_prediction as { label?: unknown })?.label;
    if (typeof rawLabel === "string" && rawLabel.trim()) {
      return rawLabel.trim().toLowerCase();
    }
    return (analysis.fraud_type || "unknown").trim().toLowerCase();
  };

  useEffect(() => {
    fetch("http://localhost:8000/text/email/history", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => {});
  }, []);

  const loadHistoryDetail = async (requestId: string) => {
    setHistoryLoadingId(requestId);
    setError("");

    try {
      const res = await fetch(`http://localhost:8000/text/email/history/${requestId}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to load history detail (${res.status})`);
      }
      const data: EmailAnalysisResult = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(requestId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load email history detail");
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const handleAnalyze = async () => {
    if (!body.trim() || !sender.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("http://localhost:8000/text/email/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sender: sender.trim(),
          subject: subject.trim(),
          body: body.trim(),
          with_llm_explanation: includeLLM,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Analysis failed (${res.status})`);
      }
      const data: EmailAnalysisResult = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(data.request_id || null);
      setFeedbackSuccess("");
      fetch("http://localhost:8000/text/email/history", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then(setHistory)
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const openFeedbackModal = () => {
    if (!result) return;
    setHumanLabel(inferHumanLabelFromFraudType(result.fraud_type));
    setFeedbackType("incorrect");
    setFeedbackNotes("");
    setFeedbackError("");
    setFeedbackOpen(true);
  };

  const handleSubmitFeedback = async () => {
    if (!result) return;

    const analysisId = result.request_id || selectedHistoryRequestId;
    if (!analysisId) {
      setFeedbackError("Missing analysis id. Please load from history or run a fresh analysis.");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError("");
    try {
      const payload = {
        analysis_id: analysisId,
        source: "email",
        human_label: humanLabel,
        model_prediction: getEmailModelPrediction(result),
        model_confidence: result.confidence,
        feedback_type: feedbackType,
        notes: feedbackNotes.trim() || null,
      };

      const res = await fetch("http://localhost:8000/text/email/feeback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to submit feedback (${res.status})`);
      }

      setFeedbackOpen(false);
      setFeedbackSuccess("Thanks. Your email feedback was recorded.");
    } catch (err: unknown) {
      setFeedbackError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const rc = result ? riskColor(result.risk_score) : null;

  const radarData = result
    ? {
        labels: ["NLP Score", "Stylometry Score", "Similarity Score"],
        datasets: [{
          label: "Signal Strength",
          data: [result.nlp_score, result.stylometry_score, result.similarity_score],
          backgroundColor: rc!.fill,
          borderColor: rc!.border,
          borderWidth: 2,
          pointBackgroundColor: rc!.text,
          pointBorderColor: rc!.text,
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      }
    : null;

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true, max: 1,
        ticks: { stepSize: 0.2, color: "rgba(255,255,255,0.35)", backdropColor: "transparent", font: { size: 11 } },
        grid: { color: "rgba(255,255,255,0.06)" },
        angleLines: { color: "rgba(255,255,255,0.06)" },
        pointLabels: { color: "rgba(255,255,255,0.6)", font: { size: 13, weight: 600 as const } },
      },
    },
    plugins: { tooltip: { enabled: true }, legend: { display: false } },
  };

  const barScores = result
    ? [
        { label: "NLP", value: result.nlp_score },
        { label: "Stylometry", value: result.stylometry_score },
        { label: "Similarity", value: result.similarity_score },
      ]
    : [];

  const barData = {
    labels: barScores.map((s) => s.label),
    datasets: [{
      label: "Score",
      data: barScores.map((s) => s.value),
      backgroundColor: barScores.map((s) => barColor(s.value)),
      borderRadius: 6,
      barThickness: 28,
    }],
  };
  const barOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { min: 0, max: 1, ticks: { color: "rgba(255,255,255,0.35)", stepSize: 0.2, font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.04)" } },
      y: { ticks: { color: "rgba(255,255,255,0.6)", font: { size: 13, weight: 600 as const } }, grid: { display: false } },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  };

  return (
    <div className="flex h-full">
      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto p-8 md:p-10">
        {/* Input Panel */}
        <section className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Email Phishing Analyzer</h1>
          <p className="text-white/40 text-sm font-medium mb-6">
            Enter email details below to analyze for phishing, spoofing, and social engineering indicators.
          </p>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
            {/* Sender + Subject row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Sender</label>
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="e.g. support@bank-secure.com"
                  className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 font-medium"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Urgent: Account Verification Required"
                  className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 font-medium"
                />
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Email Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Paste the full email body here..."
                rows={6}
                className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none font-medium"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={includeLLM} onChange={(e) => setIncludeLLM(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500" />
                <span className="text-xs text-white/50 font-medium">Include LLM Explanation</span>
              </label>
              <button onClick={handleAnalyze} disabled={loading || !body.trim() || !sender.trim()} className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2">
                {loading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Analyzing...</>
                ) : "Analyze"}
              </button>
            </div>
            {error && <div className="mt-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">{error}</div>}
          </div>
        </section>

        {/* Results */}
        {result && (
          <section className="space-y-6">
            {feedbackSuccess && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 text-sm font-medium">
                {feedbackSuccess}
              </div>
            )}

            {/* Risk Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Overall Risk</p>
                <div className="text-5xl font-bold tracking-tighter" style={{ color: rc!.text }}>{(result.risk_score * 100).toFixed(1)}%</div>
                <span className="inline-block mt-3 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: rc!.bg, color: rc!.text }}>{riskLabel(result.risk_score)}</span>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Fraud Type</p>
                <div className="text-xl font-bold tracking-tight text-white mb-2">{result.fraud_type.replace(/_/g, " ").toUpperCase()}</div>
                <p className="text-xs text-white/40 font-medium">Confidence: <span className="text-white/70">{(result.confidence * 100).toFixed(1)}%</span></p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">AI Enhancement</p>
                <div className={`text-xl font-bold tracking-tight mb-2 ${result.llm_enhanced ? "text-emerald-400" : "text-white/30"}`}>{result.llm_enhanced ? "LLM Enhanced" : "Standard"}</div>
                {result.llm_label && <p className="text-xs text-white/40 font-medium">LLM Label: <span className="text-white/70">{result.llm_label.toUpperCase()}</span></p>}
              </div>
            </div>

            {/* Email Meta */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Email Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">From</p><p className="text-sm text-white/70 font-medium truncate">{result.sender}</p></div>
                <div><p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Subject</p><p className="text-sm text-white/70 font-medium truncate">{result.subject}</p></div>
                <div><p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Message ID</p><p className="text-sm text-white/40 font-mono truncate">{result.message_id}</p></div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-5">Signal Radar</h3>
                <div className="h-72">{radarData && <Radar data={radarData} options={radarOptions} />}</div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-5">Score Breakdown</h3>
                <div className="h-72"><Bar data={barData} options={barOptions} /></div>
              </div>
            </div>

            {/* LLM Explanation */}
            {result.llm_enhanced && result.llm_explanation && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">LLM Explanation</h3>
                <div className="text-sm text-white/60 leading-relaxed font-mono bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">{result.llm_explanation}</div>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white/80">Model got this wrong?</p>
                <p className="text-xs text-white/40">Report incorrect or modified email decisions to improve future detections.</p>
              </div>
              <button
                type="button"
                onClick={openFeedbackModal}
                className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition"
              >
                Report Decision Issue
              </button>
            </div>
          </section>
        )}
      </div>

      {/* ── Right History Panel ── */}
      <aside className="w-72 flex-shrink-0 border-l border-white/[0.06] bg-black/50 overflow-y-auto hidden xl:block">
        <div className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-4">Recent Email Scans</h3>
          {history.length === 0 ? (
            <p className="text-xs text-white/20 font-medium">No past analyses yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.request_id}
                  type="button"
                  onClick={() => loadHistoryDetail(item.request_id)}
                  className={`w-full text-left px-3 py-3 rounded-xl bg-white/[0.02] border transition-colors ${
                    selectedHistoryRequestId === item.request_id
                      ? "border-white/[0.18]"
                      : "border-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  <p className="text-xs text-white/50 font-medium truncate mb-1">{item.subject || item.text}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/20">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</span>
                    {item.risk_score !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskBadgeColor(item.risk_score)}`}>{(item.risk_score * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  {historyLoadingId === item.request_id && (
                    <p className="text-[10px] text-white/30 mt-2">Loading analysis...</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {feedbackOpen && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setFeedbackOpen(false)} />
          <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#050505] p-6 shadow-2xl">
            <h3 className="text-lg font-bold tracking-tight mb-1">Email Feedback</h3>
            <p className="text-xs text-white/45 mb-5">Only correction fields are editable. Analysis fields are auto-filled from the selected result.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Analysis ID</p>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/70 font-mono break-all">{result.request_id || selectedHistoryRequestId || "N/A"}</div>
              </div>
              <div>
                <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Source</p>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/70">email</div>
              </div>
              <div>
                <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Model Prediction</p>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/70">{getEmailModelPrediction(result)}</div>
              </div>
              <div>
                <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Model Confidence</p>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/70">{result.confidence.toFixed(4)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-[11px] text-white/35 uppercase tracking-wider">Human Label</span>
                <select
                  value={humanLabel}
                  onChange={(e) => setHumanLabel(e.target.value as EmailFeedbackLabel)}
                  className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                >
                  <option value="phishing">phishing</option>
                  <option value="genuine">genuine</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] text-white/35 uppercase tracking-wider">Feedback Type</span>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value as EmailFeedbackType)}
                  className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                >
                  <option value="correct">correct</option>
                  <option value="incorrect">incorrect</option>
                  <option value="modified">modified</option>
                </select>
              </label>
            </div>

            <label className="block mb-4">
              <span className="text-[11px] text-white/35 uppercase tracking-wider">Notes (Optional)</span>
              <textarea
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                rows={3}
                placeholder="Why is this decision wrong or how should it be corrected?"
                className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none"
              />
            </label>

            {feedbackError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{feedbackError}</div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="px-4 py-2 rounded-xl border border-white/[0.16] text-white/70 text-sm font-medium hover:bg-white/[0.05] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={feedbackSubmitting}
                className="px-4 py-2 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {feedbackSubmitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
