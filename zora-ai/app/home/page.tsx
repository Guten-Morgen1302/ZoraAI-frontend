"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface HistoryItem {
  request_id: string;
  text: string;
  created_at: string | null;
  risk_score: number | null;
  fraud_type: string | null;
}

function riskBadgeColor(score: number | null) {
  if (score === null) return "bg-white/[0.05] text-white/30";
  if (score >= 0.7) return "bg-red-500/15 text-red-400";
  if (score >= 0.4) return "bg-amber-500/15 text-amber-400";
  return "bg-emerald-500/15 text-emerald-400";
}

const modules = [
  {
    name: "SMS Analyzer",
    description: "Multi-signal fraud intelligence. NLP classification, stylometry forensics, vector memory, and LLM reasoning.",
    href: "/home/sms",
    live: true,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    name: "Email Analyzer",
    description: "Phishing detection with transformer NLP, stylometry scoring, Pinecone vector memory, and LLM reasoning.",
    href: "/home/email",
    live: true,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    name: "URL Scanner",
    description: "Multi-phase URL phishing — feature extraction, TLS intel, homoglyph detection, Playwright sandbox, ML risk scoring.",
    href: "#",
    live: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.556a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" />
      </svg>
    ),
  },
  {
    name: "Attachment Sandbox",
    description: "Static file analysis — YARA signatures, ClamAV antivirus, LightGBM PE classifier, type-specific parsers.",
    href: "#",
    live: false,
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
      </svg>
    ),
  },
  {
    name: "Voice Deepfake",
    description: "Audio deepfake detection with ResNet-BiLSTM, Whisper transcription, MFCC analysis, LLM fraud reasoning.",
    href: "#",
    live: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [smsHistory, setSmsHistory] = useState<HistoryItem[]>([]);
  const [emailHistory, setEmailHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/text/sms/history", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSmsHistory)
      .catch(() => {});
    fetch("http://localhost:8000/text/email/history", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setEmailHistory)
      .catch(() => {});
  }, []);

  return (
    <div className="p-8 md:p-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Threat Intelligence Dashboard</h1>
        <p className="text-white/40 text-sm font-medium">
          Analyze threats across SMS, email, URLs, files, and voice — powered by multi-signal AI.
        </p>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "5 Modules", color: "bg-white/[0.05] text-white/50" },
          { label: "Multi-Engine", color: "bg-white/[0.05] text-white/50" },
          { label: "LLM-Enhanced", color: "bg-emerald-500/10 text-emerald-400" },
          { label: `${smsHistory.length + emailHistory.length} Past Scans`, color: "bg-white/[0.05] text-white/50" },
        ].map((chip) => (
          <span key={chip.label} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${chip.color} border border-white/[0.06]`}>
            {chip.label}
          </span>
        ))}
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/30 mb-4">Analysis Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <Link
              key={mod.name}
              href={mod.href}
              className={`relative group rounded-2xl border p-5 transition-all duration-300 flex flex-col ${
                mod.live
                  ? "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                  : "bg-white/[0.015] border-white/[0.05] opacity-50 pointer-events-none"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/60">
                  {mod.icon}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  mod.live ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/[0.04] text-white/25 border border-white/[0.06]"
                }`}>
                  {mod.live ? "Live" : "Coming Soon"}
                </span>
              </div>
              <h3 className="text-base font-bold mb-1 tracking-tight">{mod.name}</h3>
              <p className="text-xs text-white/35 leading-relaxed flex-1 font-medium">{mod.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {(smsHistory.length > 0 || emailHistory.length > 0) && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/30 mb-4">Recent Activity</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* SMS History */}
            {smsHistory.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">SMS Scans</h3>
                  <Link href="/home/sms" className="text-[10px] font-semibold text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">View All</Link>
                </div>
                <div className="space-y-2">
                  {smsHistory.slice(0, 5).map((item) => (
                    <div key={item.request_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/60 font-medium truncate">{item.text}</p>
                        <p className="text-[10px] text-white/20 mt-0.5">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</p>
                      </div>
                      {item.risk_score !== null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskBadgeColor(item.risk_score)}`}>
                          {(item.risk_score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email History */}
            {emailHistory.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Email Scans</h3>
                  <Link href="/home/email" className="text-[10px] font-semibold text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">View All</Link>
                </div>
                <div className="space-y-2">
                  {emailHistory.slice(0, 5).map((item) => (
                    <div key={item.request_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/60 font-medium truncate">{item.text}</p>
                        <p className="text-[10px] text-white/20 mt-0.5">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</p>
                      </div>
                      {item.risk_score !== null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskBadgeColor(item.risk_score)}`}>
                          {(item.risk_score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
