"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Mail,
  Link2,
  Paperclip,
  Mic,
  X,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
} from "lucide-react";
import {
  getSMSHistory,
  getEmailHistory,
  getURLHistory,
  getAttachmentHistory,
  getVoiceHistory,
  getSMSDetail,
  getEmailDetail,
  getURLDetail,
  getAttachmentDetail,
  getVoiceDetail,
} from "@/lib/api";

type TabKey = "sms" | "email" | "url" | "attachment" | "voice";

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "sms", label: "SMS", icon: <MessageSquare size={14} /> },
  { key: "email", label: "Email", icon: <Mail size={14} /> },
  { key: "url", label: "URL", icon: <Link2 size={14} /> },
  { key: "attachment", label: "Attachment", icon: <Paperclip size={14} /> },
  { key: "voice", label: "Voice", icon: <Mic size={14} /> },
];

function getVerdictBadge(item: Record<string, unknown>) {
  // Try various fields
  const riskScore = Number(item.risk_score ?? item.phishing_probability ?? -1);
  const verdict = String(item.final_verdict ?? item.fraud_type ?? "").toLowerCase();
  const voiceResult = String(item.voice_result ?? "").toLowerCase();

  let level: "safe" | "suspicious" | "dangerous" = "safe";

  if (riskScore >= 0) {
    if (riskScore >= 0.7) level = "dangerous";
    else if (riskScore >= 0.4) level = "suspicious";
  } else if (verdict === "malicious" || voiceResult.includes("spoof") || voiceResult.includes("deepfake")) {
    level = "dangerous";
  } else if (verdict === "suspicious") {
    level = "suspicious";
  }

  const colors = {
    safe: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    suspicious: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    dangerous: "bg-red-500/15 text-red-400 border-red-500/20",
  };

  const icons = {
    safe: <ShieldCheck size={12} />,
    suspicious: <ShieldAlert size={12} />,
    dangerous: <ShieldX size={12} />,
  };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[level]}`}>
      {icons[level]}
      {level.toUpperCase()}
    </span>
  );
}

function getScoreDisplay(item: Record<string, unknown>) {
  const riskScore = Number(item.risk_score ?? item.phishing_probability ?? -1);
  if (riskScore < 0) return null;
  return (
    <span className="text-xs font-bold text-white/50">
      {(riskScore * 100).toFixed(0)}%
    </span>
  );
}

function getPreview(tab: TabKey, item: Record<string, unknown>): string {
  if (tab === "sms") return String(item.text ?? "").slice(0, 80) || "—";
  if (tab === "email") return String(item.subject ?? item.text ?? "").slice(0, 80) || "—";
  if (tab === "url") return String(item.url ?? "").slice(0, 80) || "—";
  if (tab === "attachment") return String(item.filename ?? "").slice(0, 80) || "—";
  if (tab === "voice") return String(item.transcript ?? item.filename ?? "").slice(0, 80) || "—";
  return "—";
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("type") as TabKey) || "sms";
  const initialId = searchParams.get("id") || null;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [data, setData] = useState<Record<TabKey, Record<string, unknown>[] | null>>({
    sms: null, email: null, url: null, attachment: null, voice: null,
  });
  const [loading, setLoading] = useState(false);
  const [detailPanel, setDetailPanel] = useState<{ loading: boolean; data: Record<string, unknown> | null; id: string | null }>({
    loading: false,
    data: null,
    id: initialId,
  });

  const fetchers: Record<TabKey, () => Promise<Record<string, unknown>[]>> = {
    sms: async () => (await getSMSHistory()).data,
    email: async () => (await getEmailHistory()).data,
    url: async () => (await getURLHistory()).data,
    attachment: async () => (await getAttachmentHistory()).data,
    voice: async () => (await getVoiceHistory()).data,
  };

  const detailFetchers: Record<TabKey, (id: string) => Promise<Record<string, unknown>>> = {
    sms: async (id) => (await getSMSDetail(id)).data,
    email: async (id) => (await getEmailDetail(id)).data,
    url: async (id) => (await getURLDetail(id)).data,
    attachment: async (id) => (await getAttachmentDetail(id)).data,
    voice: async (id) => (await getVoiceDetail(id)).data,
  };

  const loadTab = useCallback(async (tab: TabKey) => {
    if (data[tab] !== null) return; // already loaded
    setLoading(true);
    try {
      const result = await fetchers[tab]();
      setData((prev) => ({ ...prev, [tab]: result }));
    } catch {
      setData((prev) => ({ ...prev, [tab]: [] }));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const loadDetail = useCallback(async (id: string, tab: TabKey) => {
    setDetailPanel({ loading: true, data: null, id });
    try {
      const result = await detailFetchers[tab](id);
      setDetailPanel({ loading: false, data: result, id });
    } catch {
      setDetailPanel({ loading: false, data: null, id });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  // Auto-load detail if id is in URL
  useEffect(() => {
    if (initialId && initialTab) {
      loadDetail(initialId, initialTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = data[activeTab] || [];

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 ${detailPanel.id ? "border-r border-white/[0.06]" : ""}`}>
        {/* Tabs */}
        <div className="flex-shrink-0 flex items-center gap-1 px-6 pt-6 pb-4 border-b border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setDetailPanel({ loading: false, data: null, id: null });
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-white/[0.08] text-white"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              <span className={activeTab === tab.key ? "text-white" : "text-white/30"}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="text-white/30 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-white/20">
              No {activeTab} analyses found
            </div>
          ) : (
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-[10px] text-white/25 uppercase tracking-wider font-semibold">
                <span>Input</span>
                <span>Verdict</span>
                <span>Score</span>
                <span>Date</span>
              </div>

              {items.map((item) => {
                const id = String(item.request_id ?? "");
                return (
                  <button
                    key={id}
                    onClick={() => loadDetail(id, activeTab)}
                    className={`w-full grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                      detailPanel.id === id
                        ? "bg-white/[0.06] border border-white/10"
                        : "hover:bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    <span className="text-xs text-white/60 font-medium truncate">
                      {getPreview(activeTab, item)}
                    </span>
                    <span>{getVerdictBadge(item)}</span>
                    <span>{getScoreDisplay(item)}</span>
                    <span className="text-[10px] text-white/25 whitespace-nowrap">
                      {item.created_at
                        ? new Date(String(item.created_at)).toLocaleDateString()
                        : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Side Panel */}
      {detailPanel.id && (
        <div className="w-[420px] flex-shrink-0 flex flex-col bg-black/40">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Details</span>
            <button
              onClick={() => setDetailPanel({ loading: false, data: null, id: null })}
              className="text-white/25 hover:text-white/60 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {detailPanel.loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={20} className="text-white/30 animate-spin" />
              </div>
            ) : detailPanel.data ? (
              <DetailView data={detailPanel.data} type={activeTab} />
            ) : (
              <p className="text-sm text-white/20 text-center mt-10">Failed to load details</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailView({ data }: { data: Record<string, unknown>; type: TabKey }) {
  const entries = Object.entries(data).filter(
    ([k]) => !["features", "fused_features", "url_features", "domain_features", "tls_features",
      "homoglyph_features", "sandbox_features", "cookie_features", "phishing_behavior_features",
      "fingerprint_beacon_features", "pipeline_checks", "risk_components", "engines"].includes(k)
  );

  return (
    <div className="space-y-4">
      {/* Verdict Section */}
      {"risk_score" in data ? (
        <div className="bg-white/[0.04] rounded-xl p-4">

          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">Threat Score</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-white">
              {(Number(data.risk_score) * 100).toFixed(0)}%
            </span>
            {getVerdictBadge(data)}
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                Number(data.risk_score) >= 0.7
                  ? "bg-red-500"
                  : Number(data.risk_score) >= 0.4
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Number(data.risk_score) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* LLM Explanation */}
      {data.llm_explanation ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">AI Explanation</p>
          <p className="text-xs text-white/50 leading-relaxed">{String(data.llm_explanation)}</p>
        </div>
      ) : null}

      {/* Key/Value pairs */}
      <div className="space-y-2">
        {entries.map(([key, val]) => {
          if (val === null || val === undefined || typeof val === "object") return null;
          return (
            <div key={key} className="flex items-start gap-3 py-1.5">
              <span className="text-[10px] text-white/25 uppercase tracking-wider font-semibold min-w-[100px] pt-0.5">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-white/60 break-all">{String(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="text-white/30 animate-spin" />
      </div>
    }>
      <HistoryContent />
    </Suspense>
  );
}
