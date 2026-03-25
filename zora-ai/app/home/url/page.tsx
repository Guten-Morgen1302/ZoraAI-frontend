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

function riskColor(score: number) {
  if (score >= 0.7) return { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.4)", fill: "rgba(239,68,68,0.12)" };
  if (score >= 0.4) return { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.4)", fill: "rgba(245,158,11,0.12)" };
  return { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.4)", fill: "rgba(34,197,94,0.12)" };
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function prettyKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  return fallback;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

interface URLAnalyzeResult {
  request_id: string;
  url: string;
  phishing_probability: number;
  risk_score: number;
  risk_level: string;
  model: string;
  persisted: boolean;
  pipeline_checks: Record<string, boolean | number | string>;
  risk_components: {
    url_score: number;
    content_score: number;
    cookie_score: number;
    infra_score: number;
    behavior_score: number;
  };
  llm_enhanced: boolean;
  llm_label: string | null;
  llm_confidence: number | null;
  llm_explanation: string | null;
  llm_key_indicators: string[];
  llm_recommendations: string[];
  url_features: Record<string, unknown>;
  domain_features: Record<string, unknown>;
  tls_features: Record<string, unknown>;
  homoglyph_features: Record<string, unknown>;
  sandbox_features: Record<string, unknown>;
  cookie_features: Record<string, unknown>;
  phishing_behavior_features: Record<string, unknown>;
  fingerprint_beacon_features: Record<string, unknown>;
  fused_features: Record<string, unknown>;
}

interface URLHistoryItem {
  request_id: string;
  url: string;
  created_at: string | null;
  status: string;
  risk_score: number | null;
  risk_level: string | null;
  phishing_probability: number | null;
}

export default function URLAnalyzerPage() {
  const [url, setUrl] = useState("");
  const [withLlmExplanation, setWithLlmExplanation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<URLAnalyzeResult | null>(null);
  const [history, setHistory] = useState<URLHistoryItem[]>([]);
  const [selectedHistoryRequestId, setSelectedHistoryRequestId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/url/history", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => {});
  }, []);

  const loadHistoryDetail = async (requestId: string) => {
    setHistoryLoadingId(requestId);
    setError("");

    try {
      const res = await fetch(`http://localhost:8000/url/history/${requestId}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to load URL history detail (${res.status})`);
      }
      const data: URLAnalyzeResult = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(requestId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load URL history detail");
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("http://localhost:8000/url/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: url.trim(),
          with_llm_explanation: withLlmExplanation,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `URL analysis failed (${res.status})`);
      }

      const data: URLAnalyzeResult = await res.json();
      setResult(data);
      setSelectedHistoryRequestId(null);
      fetch("http://localhost:8000/url/history", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then(setHistory)
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const rc = result ? riskColor(result.risk_score) : null;

  const riskComponents = result
    ? [
        { label: "URL", value: result.risk_components.url_score },
        { label: "Content", value: result.risk_components.content_score },
        { label: "Cookie", value: result.risk_components.cookie_score },
        { label: "Infra", value: result.risk_components.infra_score },
        { label: "Behavior", value: result.risk_components.behavior_score },
      ]
    : [];

  const radarData = result
    ? {
        labels: riskComponents.map((c) => c.label),
        datasets: [
          {
            label: "Risk Components",
            data: riskComponents.map((c) => c.value),
            backgroundColor: rc!.fill,
            borderColor: rc!.border,
            borderWidth: 2,
            pointBackgroundColor: rc!.text,
            pointBorderColor: rc!.text,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      }
    : null;

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 1,
        ticks: {
          stepSize: 0.2,
          color: "rgba(255,255,255,0.35)",
          backdropColor: "transparent",
          font: { size: 11 },
        },
        grid: { color: "rgba(255,255,255,0.06)" },
        angleLines: { color: "rgba(255,255,255,0.06)" },
        pointLabels: { color: "rgba(255,255,255,0.6)", font: { size: 13, weight: 600 as const } },
      },
    },
    plugins: {
      tooltip: { enabled: true },
      legend: { display: false },
    },
  };

  const barData = {
    labels: riskComponents.map((c) => c.label),
    datasets: [
      {
        label: "Component Score",
        data: riskComponents.map((c) => c.value),
        backgroundColor: ["#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa"],
        borderRadius: 6,
        barThickness: 24,
      },
    ],
  };

  const barOptions = {
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
        ticks: { color: "rgba(255,255,255,0.6)", font: { size: 13, weight: 600 as const } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
  };

  const pipelineRows = result ? Object.entries(result.pipeline_checks) : [];

  const sandboxNetworkCount = result ? asArray(result.sandbox_features.network_requests).length : 0;
  const sandboxScriptCount = result ? asNumber(result.sandbox_features.num_scripts) : 0;
  const sandboxExternalJsCount = result ? asArray(result.sandbox_features.external_js).length : 0;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight mb-1">URL Phishing Scanner</h1>
        <p className="text-white/40 text-sm font-medium mb-6">
          Submit a URL for layered phishing intelligence: lexical + infra + TLS + homoglyph + sandbox + ML + optional LLM reasoning.
        </p>

        <div className="rounded-2xl border border-white/8 bg-white/2 p-6 space-y-4">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Target URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-transparent border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 font-medium"
            />
          </div>

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
              disabled={loading || !url.trim()}
              className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Scanning...
                </>
              ) : (
                "Analyze URL"
              )}
            </button>
          </div>

          {error && <div className="mt-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">{error}</div>}
        </div>
      </section>

      {result && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Risk Score</p>
              <div className="text-4xl font-bold tracking-tighter" style={{ color: rc!.text }}>
                {formatPercent(result.risk_score)}
              </div>
              <span className="inline-block mt-3 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: rc!.bg, color: rc!.text }}>
                {result.risk_level}
              </span>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Phishing Probability</p>
              <div className="text-4xl font-bold tracking-tighter text-white">{formatPercent(result.phishing_probability)}</div>
              <p className="text-xs text-white/35 mt-2">Model: <span className="text-white/60">{result.model}</span></p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Sandbox</p>
              <div className="text-4xl font-bold tracking-tighter text-white">{sandboxNetworkCount}</div>
              <p className="text-xs text-white/35 mt-2">Network events observed</p>
            </div>

          </div>

          <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
            <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">URL Verdict</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Submitted URL</p>
                <p className="text-white/70 break-all">{result.url}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">LLM Verdict</p>
                <p className="text-white/70">
                  {result.llm_enhanced
                    ? `${asString(result.llm_label, "unknown").toUpperCase()} (${formatPercent(asNumber(result.llm_confidence, 0))})`
                    : "LLM not enabled"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-5">Risk Component Radar</h3>
              <div className="h-72">{radarData && <Radar data={radarData} options={radarOptions} />}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-5">Risk Component Breakdown</h3>
              <div className="h-72"><Bar data={barData} options={barOptions} /></div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
            <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Pipeline Execution Checks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {pipelineRows.map(([key, value]) => {
                const isBoolean = typeof value === "boolean";
                const isOk = isBoolean ? value : true;

                return (
                  <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5">
                    <span className="text-xs text-white/55 font-medium">{prettyKey(key)}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOk ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {isBoolean ? (value ? "OK" : "FAIL") : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Sandbox Snapshot</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">Final URL</span>
                  <span className="text-white/70 text-right max-w-[70%] truncate">{asString(result.sandbox_features.final_url, "-")}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">Redirects</span>
                  <span className="text-white/70">{asArray(result.sandbox_features.redirect_chain).length}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">DOM Length</span>
                  <span className="text-white/70">{asNumber(result.sandbox_features.dom_length)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">Scripts</span>
                  <span className="text-white/70">{sandboxScriptCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45">External JS</span>
                  <span className="text-white/70">{sandboxExternalJsCount}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50 mb-4">Security Signals</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">HTTPS</span>
                  <span className="text-white/70">{asNumber(result.url_features.has_https) ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">Certificate Issuer</span>
                  <span className="text-white/70">{asString(result.tls_features.certificate_issuer, "-")}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">HSTS Enabled</span>
                  <span className="text-white/70">{asNumber(result.tls_features.hsts_enabled) ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-white/45">Homoglyph Attack</span>
                  <span className="text-white/70">{asNumber(result.homoglyph_features.is_homoglyph_attack) ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45">Fast Flux</span>
                  <span className="text-white/70">{asNumber(result.domain_features.fast_flux_detected) ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>

          {result.llm_enhanced && result.llm_explanation && (
            <div className="rounded-2xl border border-white/8 bg-white/2 p-6 space-y-4">
              <h3 className="text-sm font-bold tracking-wider uppercase text-white/50">LLM Explanation</h3>
              <div className="text-sm text-white/65 leading-relaxed bg-white/2 rounded-xl border border-white/6 p-4">
                {result.llm_explanation}
              </div>

              {result.llm_key_indicators.length > 0 && (
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

              {result.llm_recommendations.length > 0 && (
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
              {JSON.stringify(
                {
                  url_features: result.url_features,
                  domain_features: result.domain_features,
                  tls_features: result.tls_features,
                  homoglyph_features: result.homoglyph_features,
                  cookie_features: result.cookie_features,
                  phishing_behavior_features: result.phishing_behavior_features,
                  fingerprint_beacon_features: result.fingerprint_beacon_features,
                  fused_features: result.fused_features,
                },
                null,
                2
              )}
            </pre>
          </details>
        </section>
      )}

      </div>

      <aside className="w-72 shrink-0 border-l border-white/6 bg-black/50 overflow-y-auto hidden xl:block">
        <div className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-4">Recent URL Scans</h3>
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
                  <p className="text-xs text-white/55 font-medium truncate mb-1">{item.url}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-white/25">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</span>
                    {item.risk_score !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.risk_score >= 0.7 ? "bg-red-500/15 text-red-400" : item.risk_score >= 0.4 ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                        {formatPercent(item.risk_score)}
                      </span>
                    )}
                  </div>
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

