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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AttachmentAnalyzeResponse | null>(null);
  const [history, setHistory] = useState<AttachmentHistoryItem[]>([]);
  const [selectedHistoryRequestId, setSelectedHistoryRequestId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

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
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Attachment File</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-white/75 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
            />
            {selectedFile && (
              <p className="mt-2 text-xs text-white/45">
                Selected: <span className="text-white/70">{selectedFile.name}</span> ({bytesToHuman(selectedFile.size)})
              </p>
            )}
          </div>

          <div className="flex items-center justify-end">
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-4">Recent Attachment Scans</h3>
          {history.length === 0 ? (
            <p className="text-xs text-white/20 font-medium">No past analyses yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.request_id}
                  type="button"
                  onClick={() => loadHistoryDetail(item.request_id)}
                  className={`w-full text-left px-3 py-3 rounded-xl bg-white/2 border transition-colors ${
                    selectedHistoryRequestId === item.request_id
                      ? "border-white/20"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <p className="text-xs text-white/55 font-medium truncate mb-1">{item.filename}</p>
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
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
