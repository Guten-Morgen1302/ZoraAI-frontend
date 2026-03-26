"use client";

import { useEffect, useState, useRef } from "react";

/* ── Types ── */
interface VoiceAnalysisResult {
  request_id: string;
  analysis_id: string;
  status: string;
  filename: string;
  voice_analysis: {
    result: string;
    confidence: number;
    pred_label: number;
    chunks_analyzed: number;
  };
  transcript: string;
  fraud_report: {
    risk_score: number;
    is_fraud: boolean;
    system_logic: string;
    red_flags: string[];
  };
}

interface HistoryItem {
  request_id: string;
  filename: string;
  status: string;
  created_at: string | null;
  transcript: string;
  voice_result: string | null;
  confidence: number | null;
  risk_score: number | null;
  is_fraud: boolean | null;
}

/* ── Helpers ── */
function verdictColor(isDeepfake: boolean) {
  return isDeepfake
    ? { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.4)" }
    : { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.4)" };
}

function riskScoreColor(score: number) {
  if (score >= 7) return "text-red-400";
  if (score >= 4) return "text-amber-400";
  return "text-emerald-400";
}

function riskBadgeColor(score: number | null) {
  if (score === null) return "bg-white/[0.05] text-white/30";
  if (score >= 7) return "bg-red-500/15 text-red-400";
  if (score >= 4) return "bg-amber-500/15 text-amber-400";
  return "bg-emerald-500/15 text-emerald-400";
}

export default function VoiceAnalyzerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VoiceAnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryRequestId, setSelectedHistoryRequestId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyDeletingId, setHistoryDeletingId] = useState<string | null>(null);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [pendingHistoryAction, setPendingHistoryAction] = useState<{ type: "delete" | "clear"; requestId?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistoryDetail = async (requestId: string) => {
    setHistoryLoadingId(requestId);
    setError("");

    try {
      const res = await fetch(`http://localhost:8000/voice/history/${requestId}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to load history detail (${res.status})`);
      }

      const data: VoiceAnalysisResult = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(requestId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load history detail");
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const executeDeleteHistoryItem = async (requestId: string) => {
    setHistoryDeletingId(requestId);
    setError("");
    try {
      const res = await fetch(`http://localhost:8000/voice/history/${requestId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to delete history item (${res.status})`);
      }

      setHistory((prev) => prev.filter((item) => item.request_id !== requestId));
      if (selectedHistoryRequestId === requestId) {
        setSelectedHistoryRequestId(null);
        setResult(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete history item");
    } finally {
      setHistoryDeletingId(null);
    }
  };

  const executeClearHistory = async () => {
    setHistoryClearing(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/voice/history", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to clear history (${res.status})`);
      }

      setHistory([]);
      setSelectedHistoryRequestId(null);
      setResult(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to clear history");
    } finally {
      setHistoryClearing(false);
    }
  };

  const handleDeleteHistoryItem = (requestId: string) => {
    if (historyDeletingId || historyClearing) return;
    setPendingHistoryAction({ type: "delete", requestId });
  };

  const handleClearHistory = () => {
    if (historyClearing || historyDeletingId) return;
    setPendingHistoryAction({ type: "clear" });
  };

  const confirmPendingHistoryAction = async () => {
    if (!pendingHistoryAction) return;

    if (pendingHistoryAction.type === "delete" && pendingHistoryAction.requestId) {
      await executeDeleteHistoryItem(pendingHistoryAction.requestId);
    }
    if (pendingHistoryAction.type === "clear") {
      await executeClearHistory();
    }
    setPendingHistoryAction(null);
  };

  useEffect(() => {
    fetch("http://localhost:8000/voice/history", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/voice/analyse", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Analysis failed (${res.status})`);
      }
      const data: VoiceAnalysisResult = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(data.request_id);
      // Refresh history
      fetch("http://localhost:8000/voice/history", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then(setHistory)
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith("audio/")) {
      setFile(droppedFile);
    }
  };

  const isDeepfake = result ? result.voice_analysis.pred_label === 1 : false;
  const vc = result ? verdictColor(isDeepfake) : null;

  return (
    <div className="flex h-full">
      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto p-8 md:p-10">
        {/* Input Panel */}
        <section className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Voice Deepfake Analyzer</h1>
          <p className="text-white/40 text-sm font-medium mb-6">
            Upload an audio file to detect deepfake/spoofed speech and analyze fraud intent via transcript.
          </p>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-white/30 bg-white/[0.04]"
                  : file
                  ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                  : "border-white/[0.08] hover:border-white/15 hover:bg-white/[0.02]"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) setFile(selected);
                }}
              />
              <svg className="w-8 h-8 mx-auto mb-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-emerald-400">{file.name}</p>
                  <p className="text-xs text-white/30 mt-1">{(file.size / 1024).toFixed(1)} KB — Click or drop to replace</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-white/40">Drop an audio file here or click to browse</p>
                  <p className="text-xs text-white/20 mt-1">Supports MP3, WAV, FLAC, OGG, M4A</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleAnalyze}
                disabled={loading || !file}
                className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  "Analyze Audio"
                )}
              </button>
            </div>
            {error && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        {result && (
          <section className="space-y-6">
            {/* ── Verdict Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Voice Verdict */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Voice Verdict</p>
                <div className="text-2xl font-bold tracking-tight mb-2" style={{ color: vc!.text }}>
                  {result.voice_analysis.result}
                </div>
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ backgroundColor: vc!.bg, color: vc!.text }}
                >
                  {(result.voice_analysis.confidence * 100).toFixed(1)}% confidence
                </span>
              </div>

              {/* Fraud Risk */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Fraud Risk</p>
                <div className={`text-5xl font-bold tracking-tighter ${riskScoreColor(result.fraud_report.risk_score)}`}>
                  {result.fraud_report.risk_score}/10
                </div>
                <span
                  className={`inline-block mt-3 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    result.fraud_report.is_fraud
                      ? "bg-red-500/15 text-red-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  {result.fraud_report.is_fraud ? "Fraud Detected" : "Not Fraud"}
                </span>
              </div>

              {/* Analysis Meta */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Analysis</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Chunks Analyzed</p>
                    <p className="text-lg font-bold text-white">{result.voice_analysis.chunks_analyzed}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Filename</p>
                    <p className="text-xs text-white/50 font-medium truncate">{result.filename}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Red Flags ── */}
            {result.fraud_report.red_flags && result.fraud_report.red_flags.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Red Flags</h3>
                <div className="flex flex-wrap gap-2.5">
                  {result.fraud_report.red_flags.map((flag, i) => (
                    <span
                      key={i}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Transcript ── */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Transcript</h3>
              <div className="text-sm text-white/60 leading-relaxed font-mono bg-white/[0.02] rounded-xl border border-white/[0.06] p-5 whitespace-pre-wrap">
                {result.transcript || "No transcript available."}
              </div>
            </div>

            {/* ── LLM Fraud Analysis ── */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Fraud Analysis Report</h3>
              <div className="text-sm text-white/60 leading-relaxed font-mono bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
                {result.fraud_report.system_logic || "No analysis available."}
              </div>
            </div>

            {/* Request IDs */}
            <div className="text-center space-y-1">
              <p className="text-[10px] text-white/20 font-mono tracking-wider">REQUEST ID: {result.request_id}</p>
              <p className="text-[10px] text-white/15 font-mono tracking-wider">ANALYSIS ID: {result.analysis_id}</p>
            </div>
          </section>
        )}
      </div>

      {/* ── Right History Panel ── */}
      <aside className="w-72 flex-shrink-0 border-l border-white/[0.06] bg-black/50 overflow-y-auto hidden xl:block">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/30">Recent Voice Scans</h3>
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={history.length === 0 || historyClearing || historyDeletingId !== null}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-white/15 text-white/55 hover:text-white/75 hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {historyClearing ? "Clearing..." : "Clear"}
            </button>
          </div>
          {pendingHistoryAction && (
            <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
              <p className="text-[11px] text-amber-200 font-medium mb-2">
                {pendingHistoryAction.type === "clear" ? "Clear all voice scan history?" : "Delete this voice scan from history?"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={confirmPendingHistoryAction}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-amber-400 text-black"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setPendingHistoryAction(null)}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-white/20 text-white/70"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {history.length === 0 ? (
            <p className="text-xs text-white/20 font-medium">No past analyses yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.request_id}
                  className={`px-3 py-3 rounded-xl bg-white/[0.02] border transition-colors ${
                    selectedHistoryRequestId === item.request_id
                      ? "border-white/[0.18]"
                      : "border-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => loadHistoryDetail(item.request_id)}
                      className="text-xs text-white/50 font-medium truncate text-left hover:text-white/80"
                    >
                      {item.filename}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistoryItem(item.request_id)}
                      disabled={historyDeletingId === item.request_id || historyClearing}
                      className="shrink-0 text-white/35 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Delete scan"
                    >
                      {historyDeletingId === item.request_id ? (
                        <span className="text-[9px]">...</span>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-5-3h4a1 1 0 011 1v2H9V5a1 1 0 011-1z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/30 truncate mb-1.5">{item.transcript || "—"}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/20">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.voice_result && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            item.voice_result.includes("Spoof")
                              ? "bg-red-500/15 text-red-400"
                              : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {item.voice_result.includes("Spoof") ? "SPOOF" : "REAL"}
                        </span>
                      )}
                      {item.risk_score !== null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskBadgeColor(item.risk_score)}`}>
                          {item.risk_score}/10
                        </span>
                      )}
                    </div>
                  </div>
                  {historyLoadingId === item.request_id && (
                    <p className="text-[10px] text-white/30 mt-2">Loading analysis...</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
