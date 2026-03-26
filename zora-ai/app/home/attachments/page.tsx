"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface AttachmentEngineResult {
  is_flagged: boolean;
  hits?: string[] | null;
  signature?: string | null;
  score?: number | null;
}

interface AttachmentAnalyzeResponse {
  request_id: string | null;
  analysis_id: string | null;
  filename: string;
  file_size: number;
  s3_url: string | null;
  status: string | null;
  final_verdict: string;
  engines: Record<string, AttachmentEngineResult>;
  features: Record<string, unknown>;
  llm_enhanced?: boolean;
  llm_label?: string | null;
  llm_confidence?: number | null;
  llm_explanation?: string | null;
  llm_key_indicators?: string[];
  llm_recommendations?: string[];
}

interface AttachmentHistoryItem {
  request_id: string;
  filename: string;
  file_size: number;
  created_at: string | null;
  status: string;
  final_verdict: string | null;
  flagged_engines: number;
}

function bytesToHuman(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function verdictStyle(verdict: string) {
  const normalized = (verdict || "").toLowerCase();
  if (normalized === "suspicious") {
    return {
      text: "#ef4444",
      badge: "bg-red-500/15 text-red-400 border border-red-500/30",
      card: "border-red-500/25 bg-red-500/5",
    };
  }
  return {
    text: "#22c55e",
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    card: "border-emerald-500/25 bg-emerald-500/5",
  };
}

function flattenNumericFeatures(
  value: unknown,
  prefix = "",
  output: Array<{ key: string; value: number }> = []
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    output.push({ key: prefix || "value", value });
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      flattenNumericFeatures(item, `${prefix}[${idx}]`, output);
    });
    return output;
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      const nextKey = prefix ? `${prefix}.${k}` : k;
      flattenNumericFeatures(v, nextKey, output);
    });
  }

  return output;
}

function isLikelyScoreKey(key: string) {
  return /(score|entropy|size|count|num_|ratio|risk|prob|length|sections|imports)/i.test(key);
}

export default function AttachmentAnalyzerPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [withLlmExplanation, setWithLlmExplanation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AttachmentAnalyzeResponse | null>(null);
  const [history, setHistory] = useState<AttachmentHistoryItem[]>([]);
  const [selectedHistoryRequestId, setSelectedHistoryRequestId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyDeletingId, setHistoryDeletingId] = useState<string | null>(null);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [pendingHistoryAction, setPendingHistoryAction] = useState<{ type: "delete" | "clear"; requestId?: string } | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/attachment/history", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => {});
  }, []);

  const loadHistoryDetail = async (requestId: string) => {
    setHistoryLoadingId(requestId);
    setError("");

    try {
      const res = await fetch(`http://localhost:8000/attachment/history/${requestId}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to load attachment history detail (${res.status})`);
      }
      const data: AttachmentAnalyzeResponse = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(requestId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load attachment history detail");
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const executeDeleteHistoryItem = async (requestId: string) => {
    setHistoryDeletingId(requestId);
    setError("");
    try {
      const res = await fetch(`http://localhost:8000/attachment/history/${requestId}`, {
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
      const res = await fetch("http://localhost:8000/attachment/history", {
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

  const engineEntries = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.engines || {});
  }, [result]);

  const engineScoreRows = useMemo(() => {
    if (!result) return [];

    return engineEntries.map(([name, payload]) => {
      const raw = typeof payload.score === "number" ? payload.score : payload.is_flagged ? 1 : 0;
      const normalized = Math.max(0, Math.min(raw, 1));
      return {
        name: name.toUpperCase(),
        value: normalized,
      };
    });
  }, [result, engineEntries]);

  const flaggedCount = useMemo(() => {
    return engineEntries.filter(([, payload]) => payload.is_flagged).length;
  }, [engineEntries]);

  const featureTopRows = useMemo(() => {
    if (!result) return [];

    const all = flattenNumericFeatures(result.features)
      .filter((item) => Number.isFinite(item.value))
      .filter((item) => isLikelyScoreKey(item.key))
      .filter((item) => Math.abs(item.value) <= 1e9);

    const normalized = all.map((item) => ({
      key: item.key,
      value: item.value,
      abs: Math.abs(item.value),
    }));

    normalized.sort((a, b) => b.abs - a.abs);
    return normalized.slice(0, 10);
  }, [result]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("with_llm_explanation", withLlmExplanation.toString());

      const res = await fetch("http://localhost:8000/attachment/analyze", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Attachment analysis failed (${res.status})`);
      }

      const data: AttachmentAnalyzeResponse = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(null);
      fetch("http://localhost:8000/attachment/history", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then(setHistory)
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const verdict = result?.final_verdict || "";
  const vStyle = verdictStyle(verdict);

  const engineBarData = {
    labels: engineScoreRows.map((r) => r.name),
    datasets: [
      {
        label: "Engine Risk Signal",
        data: engineScoreRows.map((r) => r.value),
        backgroundColor: engineScoreRows.map((r) => (r.value >= 0.75 ? "#ef4444" : r.value >= 0.4 ? "#f59e0b" : "#22c55e")),
        borderRadius: 8,
        barThickness: 32,
      },
    ],
  };

  const engineBarOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        min: 0,
        max: 1,
        ticks: { color: "rgba(255,255,255,0.35)", stepSize: 0.2, font: { size: 11 } },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        ticks: { color: "rgba(255,255,255,0.6)", font: { size: 12, weight: 600 as const } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
  };

  const verdictDonutData = {
    labels: ["Flagged Engines", "Non-Flagged Engines"],
    datasets: [
      {
        data: [flaggedCount, Math.max(engineEntries.length - flaggedCount, 0)],
        backgroundColor: ["rgba(239,68,68,0.85)", "rgba(34,197,94,0.8)"],
        borderColor: ["rgba(239,68,68,1)", "rgba(34,197,94,1)"],
        borderWidth: 1,
      },
    ],
  };

  const featureBarData = {
    labels: featureTopRows.map((r) => r.key.split(".").slice(-2).join(".")),
    datasets: [
      {
        label: "Feature Magnitude",
        data: featureTopRows.map((r) => r.value),
        backgroundColor: "rgba(56,189,248,0.75)",
        borderColor: "rgba(56,189,248,1)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const featureBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: "rgba(255,255,255,0.35)", maxRotation: 45, minRotation: 20, font: { size: 10 } },
        grid: { color: "rgba(255,255,255,0.04)" },
      },
      y: {
        ticks: { color: "rgba(255,255,255,0.35)", font: { size: 11 } },
        grid: { color: "rgba(255,255,255,0.04)" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Attachment Sandbox Analyzer</h1>
        <p className="text-white/40 text-sm font-medium mb-6">
          Upload files to run static threat analysis with YARA, ClamAV, and ML scoring engines.
        </p>

        <div className="rounded-2xl border border-white/8 bg-white/2 p-6 space-y-4">
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/20 hover:border-white/40 bg-white/5'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-white/10 rounded-full">
                <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">
                  {isDragging ? 'Drop file here components...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-white/50 mt-1">
                  Supports binaries, documents, archives and PE files. Max size: 100MB.
                </p>
              </div>
            </div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </div>
          
          {selectedFile && (
            <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-white/90 truncate max-w-[300px]">{selectedFile.name}</p>
                  <p className="text-xs text-white/40">{bytesToHuman(selectedFile.size)}</p>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withLlmExplanation}
                onChange={(e) => setWithLlmExplanation(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-emerald-500"
              />
              <span className="text-xs text-white/50 font-medium">Include LLM Explanation</span>
            </label>

            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedFile}
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
                "Analyze Attachment"
              )}
            </button>
          </div>

          {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">{error}</div>}
        </div>
      </section>

      {result && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className={`rounded-2xl border p-6 text-center ${vStyle.card}`}>
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Final Verdict</p>
              <div className="text-2xl font-bold tracking-tight" style={{ color: vStyle.text }}>
                {result.final_verdict.toUpperCase()}
              </div>
              <span className={`inline-block mt-3 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${vStyle.badge}`}>
                {result.status || "completed"}
              </span>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">File Name</p>
              <div className="text-sm text-white/70 break-all font-medium">{result.filename}</div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">File Size</p>
              <div className="text-3xl font-bold tracking-tight text-white">{bytesToHuman(result.file_size)}</div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Flagged Engines</p>
              <div className="text-3xl font-bold tracking-tight text-white">{flaggedCount}/{engineEntries.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-5">Engine Risk Signal</h3>
              <div className="h-72">
                <Bar data={engineBarData} options={engineBarOptions} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-5">Flagged vs Non-Flagged</h3>
              <div className="h-72 flex items-center justify-center">
                <Doughnut data={verdictDonutData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { labels: { color: "rgba(255,255,255,0.7)" } },
                  },
                }} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
            <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Engine Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {engineEntries.map(([name, payload]) => (
                <div key={name} className="rounded-xl border border-white/8 bg-black/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/55">{name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payload.is_flagged ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                      {payload.is_flagged ? "FLAGGED" : "CLEAN"}
                    </span>
                  </div>
                  {typeof payload.score === "number" && (
                    <p className="text-xs text-white/55">Score: <span className="text-white/75">{payload.score.toFixed(4)}</span></p>
                  )}
                  {payload.signature && (
                    <p className="text-xs text-white/55 break-all">Signature: <span className="text-white/75">{payload.signature}</span></p>
                  )}
                  {payload.hits && payload.hits.length > 0 && (
                    <div>
                      <p className="text-xs text-white/55 mb-1">Hits:</p>
                      <div className="flex flex-wrap gap-1">
                        {payload.hits.slice(0, 6).map((hit) => (
                          <span key={hit} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">{hit}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {featureTopRows.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-5">Top Numeric Features</h3>
              <div className="h-80">
                <Bar data={featureBarData} options={featureBarOptions} />
              </div>
            </div>
          )}

          {result.llm_enhanced && result.llm_explanation && (
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 space-y-4">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50">LLM Explanation</h3>
              
              <div className="text-sm text-white/65 leading-relaxed bg-white/2 rounded-xl border border-white/6 p-4">
                {result.llm_explanation}
              </div>

              {result.llm_label && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/45 uppercase tracking-wider font-semibold">Verdict:</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    result.llm_label.toLowerCase() === 'malicious' || result.llm_label.toLowerCase() === 'suspicious' 
                    ? 'bg-red-500/15 text-red-400' 
                    : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {result.llm_label.toUpperCase()} {result.llm_confidence ? `(${(result.llm_confidence * 100).toFixed(1)}%)` : ''}
                  </span>
                </div>
              )}

              {result.llm_key_indicators && result.llm_key_indicators.length > 0 && (
                <div>
                  <p className="text-xs text-white/45 uppercase tracking-wider font-semibold mb-2">Key Indicators</p>
                  <div className="flex flex-wrap gap-2">
                    {result.llm_key_indicators.map((item, idx) => (
                      <span key={`${item}-${idx}`} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/12 text-emerald-300 border border-emerald-500/20">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.llm_recommendations && result.llm_recommendations.length > 0 && (
                <div>
                  <p className="text-xs text-white/45 uppercase tracking-wider font-semibold mb-2">Recommendations</p>
                  <ul className="space-y-1">
                    {result.llm_recommendations.map((item, idx) => (
                      <li key={`${item}-${idx}`} className="text-sm text-white/60">- {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <details className="rounded-2xl border border-white/8 bg-white/2 p-6">
            <summary className="cursor-pointer text-sm font-bold tracking-wider uppercase text-white/50">Raw Feature Payload</summary>
            <pre className="mt-4 text-xs text-white/55 overflow-auto max-h-130 bg-black/35 border border-white/6 rounded-xl p-4 leading-relaxed">
              {JSON.stringify(result.features, null, 2)}
            </pre>
          </details>
        </section>
      )}

      </div>

      <aside className="w-72 shrink-0 border-l border-white/6 bg-black/50 overflow-y-auto hidden xl:block">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/30">Recent Attachment Scans</h3>
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
                {pendingHistoryAction.type === "clear" ? "Clear all attachment scan history?" : "Delete this attachment scan from history?"}
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
                  className={`px-3 py-3 rounded-xl bg-white/2 border transition-colors ${
                    selectedHistoryRequestId === item.request_id
                      ? "border-white/20"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => loadHistoryDetail(item.request_id)}
                      className="text-xs text-white/55 font-medium truncate text-left hover:text-white/80"
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-white/25">{bytesToHuman(item.file_size)}</span>
                    {item.final_verdict && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.final_verdict.toLowerCase() === "suspicious" ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                        {item.final_verdict.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/25 mt-1">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</p>
                  {historyLoadingId === item.request_id && (
                    <p className="text-[10px] text-white/35 mt-2">Loading analysis...</p>
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
