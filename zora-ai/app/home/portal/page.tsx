"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Plus,
  ArrowUp,
  Paperclip,
  Link2,
  Mail,
  MessageSquare,
  Mic,
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileWarning,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import {
  usePortalStore,
  uuid,
  type AnalysisJob,
  type Message,
  type PipelineResult,
} from "@/lib/portalStore";
import { orchestrate } from "@/lib/orchestrator";
import {
  createPortalChat,
  deletePortalChat,
  getPortalChat,
  getPortalChats,
  updatePortalChat,
} from "@/lib/api";

// ━━━━━━━━━━━━━━━━━━━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━

function detectInputType(
  text: string
): { type: "url"; url: string } | { type: "email"; sender: string; subject: string; body: string } | { type: "sms"; text: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // URL detection
  if (/^https?:\/\//i.test(trimmed)) {
    return { type: "url", url: trimmed };
  }

  // Plain-domain URL detection (e.g. nike.com, www.nike.com/path)
  const plainDomainPattern = /^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#].*)?$/i;
  if (plainDomainPattern.test(trimmed) && !/\s/.test(trimmed)) {
    return {
      type: "url",
      url: `https://${trimmed}`,
    };
  }

  // Email detection
  if (/^From:/im.test(trimmed) && /Subject:/im.test(trimmed)) {
    const lines = trimmed.split("\n");
    let sender = "";
    let subject = "";
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^From:/i.test(line)) sender = line.replace(/^From:\s*/i, "");
      else if (/^Subject:/i.test(line)) subject = line.replace(/^Subject:\s*/i, "");
      else if (/^To:/i.test(line)) continue;
      else if (line === "" && bodyStart === 0) {
        bodyStart = i + 1;
        break;
      }
    }
    const body = lines.slice(bodyStart).join("\n").trim();
    return { type: "email", sender, subject, body };
  }

  // Default: SMS
  return { type: "sms", text: trimmed };
}

function getJobIcon(type: string) {
  switch (type) {
    case "url": return <Link2 size={14} />;
    case "sms": return <MessageSquare size={14} />;
    case "email": return <Mail size={14} />;
    case "attachment": return <Paperclip size={14} />;
    case "voice": return <Mic size={14} />;
    default: return <Shield size={14} />;
  }
}

function getVerdictColor(verdict: string) {
  switch (verdict) {
    case "DANGEROUS": return { bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400", icon: <ShieldX size={20} /> };
    case "SUSPICIOUS": return { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", icon: <ShieldAlert size={20} /> };
    default: return { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", icon: <ShieldCheck size={20} /> };
  }
}

function getThreatScoreFromResult(result: PipelineResult): number {
  if (result.status !== "fulfilled" || !result.data) return 0;
  const d = result.data;
  if (result.type === "url") return Math.round((Number(d.risk_score ?? d.phishing_probability ?? 0)) * 100);
  if (result.type === "sms" || result.type === "email") return Math.round(Number(d.risk_score ?? 0) * 100);
  if (result.type === "attachment") {
    const v = String(d.final_verdict ?? "").toLowerCase();
    if (v === "malicious") return 90;
    if (v === "suspicious") return 60;
    return 10;
  }
  return 0;
}

function getScoreColor(score: number) {
  if (score >= 70) return "bg-red-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-emerald-500";
}

function getPipelineLabel(type: string) {
  switch (type) {
    case "url": return "🔗 URL Analysis";
    case "sms": return "💬 SMS Analysis";
    case "email": return "📧 Email Analysis";
    case "attachment": return "📎 Attachment Analysis";
    case "voice": return "🎤 Voice Analysis";
    default: return "Analysis";
  }
}

interface PortalChatListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
}

interface PortalChatDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Record<string, unknown>[];
}

function deserializeMessages(raw: Record<string, unknown>[]): Message[] {
  return raw
    .filter((m) => typeof m === "object" && m !== null)
    .map((m) => {
      const msg = m as Record<string, unknown>;
      const id = typeof msg.id === "string" && msg.id.trim() ? msg.id : uuid();
      const role = msg.role === "user" || msg.role === "thinking" || msg.role === "result" ? msg.role : "thinking";
      const ts = msg.timestamp;
      const parsedTs = typeof ts === "string" || typeof ts === "number" ? new Date(ts) : new Date();
      return {
        id,
        role,
        jobs: Array.isArray(msg.jobs) ? (msg.jobs as AnalysisJob[]) : undefined,
        result: typeof msg.result === "object" && msg.result !== null ? (msg.result as Message["result"]) : undefined,
        thinkingText: typeof msg.thinkingText === "string" ? msg.thinkingText : undefined,
        timestamp: Number.isNaN(parsedTs.getTime()) ? new Date() : parsedTs,
      };
    });
}

function serializeMessages(messages: Message[]): Record<string, unknown>[] {
  return messages.map((message) => ({
    ...message,
    jobs: message.jobs?.map((job) => {
      const { file: _file, ...rest } = job;
      return rest;
    }),
    timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
  })) as Record<string, unknown>[];
}

function deriveTitleFromMessages(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user" && (m.jobs?.length ?? 0) > 0);
  if (!firstUser || !firstUser.jobs || firstUser.jobs.length === 0) return "New Chat";
  const raw = firstUser.jobs[0].label?.trim() || "New Chat";
  return raw.length > 42 ? `${raw.slice(0, 42)}...` : raw;
}

function formatChatDate(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━ Attachment Picker ━━━━━━━━━━━━━━━━━━━━━

function AttachmentPicker({
  open,
  onClose,
  onAddJob,
}: {
  open: boolean;
  onClose: () => void;
  onAddJob: (job: AnalysisJob) => void;
}) {
  const [mode, setMode] = useState<"menu" | "url" | "email" | "sms">("menu");
  const [urlVal, setUrlVal] = useState("");
  const [emailSender, setEmailSender] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsText, setSmsText] = useState("");

  const { getRootProps: getFileProps, getInputProps: getFileInput } = useDropzone({
    onDrop: (files) => {
      files.forEach((f) => {
        onAddJob({
          id: uuid(),
          type: "attachment",
          payload: { filename: f.name },
          label: f.name,
          file: f,
        });
      });
      resetAndClose();
    },
    noClick: false,
    noKeyboard: true,
  });

  const { getRootProps: getVoiceProps, getInputProps: getVoiceInput } = useDropzone({
    accept: { "audio/*": [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".webm"] },
    onDrop: (files) => {
      files.forEach((f) => {
        onAddJob({
          id: uuid(),
          type: "voice",
          payload: { filename: f.name },
          label: f.name,
          file: f,
        });
      });
      resetAndClose();
    },
    noClick: false,
    noKeyboard: true,
  });

  function resetAndClose() {
    setMode("menu");
    setUrlVal("");
    setEmailSender("");
    setEmailSubject("");
    setEmailBody("");
    setSmsText("");
    onClose();
  }

  function addUrl() {
    if (!urlVal.trim()) return;
    onAddJob({ id: uuid(), type: "url", payload: { url: urlVal.trim() }, label: urlVal.trim() });
    resetAndClose();
  }

  function addEmail() {
    if (!emailBody.trim()) return;
    onAddJob({
      id: uuid(),
      type: "email",
      payload: { sender: emailSender, subject: emailSubject, body: emailBody },
      label: emailSubject || "Email",
    });
    resetAndClose();
  }

  function addSms() {
    if (!smsText.trim()) return;
    onAddJob({
      id: uuid(),
      type: "sms",
      payload: { text: smsText.trim() },
      label: smsText.trim().slice(0, 50),
    });
    resetAndClose();
  }

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 animate-fade-in-up">
      {mode === "menu" && (
        <div className="p-2">
          <div {...getFileProps()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors">
            <input {...getFileInput()} />
            <Paperclip size={16} className="text-white/40" />
            <span className="text-sm text-white/70 font-medium">Upload File</span>
          </div>
          <button onClick={() => setMode("url")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors">
            <Link2 size={16} className="text-white/40" />
            <span className="text-sm text-white/70 font-medium">Add URL</span>
          </button>
          <button onClick={() => setMode("email")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors">
            <Mail size={16} className="text-white/40" />
            <span className="text-sm text-white/70 font-medium">Paste Email</span>
          </button>
          <button onClick={() => setMode("sms")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors">
            <MessageSquare size={16} className="text-white/40" />
            <span className="text-sm text-white/70 font-medium">Paste SMS</span>
          </button>
          <div {...getVoiceProps()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors">
            <input {...getVoiceInput()} />
            <Mic size={16} className="text-white/40" />
            <span className="text-sm text-white/70 font-medium">Upload Voice</span>
          </div>
        </div>
      )}

      {mode === "url" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Add URL</span>
            <button onClick={() => setMode("menu")} className="text-white/30 hover:text-white/60"><X size={14} /></button>
          </div>
          <input
            value={urlVal}
            onChange={(e) => setUrlVal(e.target.value)}
            placeholder="https://suspicious-site.com"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && addUrl()}
          />
          <button onClick={addUrl} className="w-full bg-white text-black text-xs font-semibold py-2 rounded-lg hover:bg-white/90 transition-colors">
            Add
          </button>
        </div>
      )}

      {mode === "email" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Paste Email</span>
            <button onClick={() => setMode("menu")} className="text-white/30 hover:text-white/60"><X size={14} /></button>
          </div>
          <input
            value={emailSender}
            onChange={(e) => setEmailSender(e.target.value)}
            placeholder="Sender email"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
          />
          <input
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Subject"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
          />
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Email body"
            rows={4}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors resize-none"
          />
          <button onClick={addEmail} className="w-full bg-white text-black text-xs font-semibold py-2 rounded-lg hover:bg-white/90 transition-colors">
            Add
          </button>
        </div>
      )}

      {mode === "sms" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Paste SMS</span>
            <button onClick={() => setMode("menu")} className="text-white/30 hover:text-white/60"><X size={14} /></button>
          </div>
          <textarea
            value={smsText}
            onChange={(e) => setSmsText(e.target.value)}
            placeholder="Paste suspicious SMS message..."
            rows={4}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors resize-none"
            autoFocus
          />
          <button onClick={addSms} className="w-full bg-white text-black text-xs font-semibold py-2 rounded-lg hover:bg-white/90 transition-colors">
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━ Job Chips ━━━━━━━━━━━━━━━━━━━━━

function JobChip({ job, onRemove }: { job: AnalysisJob; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/10 rounded-full px-3 py-1.5 text-xs font-medium text-white/70 group">
      <span className="text-white/40">{getJobIcon(job.type)}</span>
      <span className="max-w-[180px] truncate">{job.label}</span>
      <button onClick={onRemove} className="text-white/25 hover:text-white/60 ml-1 transition-colors">
        <X size={12} />
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━ Messages ━━━━━━━━━━━━━━━━━━━━━

function UserMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] bg-white/[0.06] border border-white/10 rounded-2xl rounded-br-md px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {msg.jobs?.map((j) => (
            <span key={j.id} className="inline-flex items-center gap-1.5 bg-white/[0.06] rounded-full px-2.5 py-1 text-xs text-white/60">
              <span className="text-white/40">{getJobIcon(j.type)}</span>
              <span className="max-w-[200px] truncate">{j.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThinkingMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] bg-white/[0.03] border border-white/[0.08] rounded-2xl rounded-bl-md px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Shield size={20} className="text-orange-400 animate-pulse" />
            <div className="absolute inset-0 animate-ping">
              <Shield size={20} className="text-orange-400/30" />
            </div>
          </div>
          <span className="text-sm text-white/60 font-medium">{msg.thinkingText || "ZoraAI is analyzing..."}</span>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━ Threat Card ━━━━━━━━━━━━━━━━━━━━━

function ThreatCard({ result }: { result: PipelineResult }) {
  const score = getThreatScoreFromResult(result);
  const scoreColor = getScoreColor(score);
  const data = result.data || {};

  const explanation =
    (data.llm_explanation as string) ||
    (data.explanation as string) ||
    "";

  // Extract flags / signals
  const flags: string[] = [];
  if (result.type === "url") {
    const rl = String(data.risk_level ?? "");
    if (rl) flags.push(rl);
    const model = String(data.model ?? "");
    if (model && model !== "unknown") flags.push(model);
  } else if (result.type === "sms") {
    const ft = String(data.fraud_type ?? "");
    if (ft && ft !== "unknown") flags.push(ft);
    if (data.llm_enhanced) flags.push("LLM-Enhanced");
  } else if (result.type === "email") {
    const ft = String(data.fraud_type ?? "");
    if (ft && ft !== "unknown") flags.push(ft);
    if (data.llm_enhanced) flags.push("LLM-Enhanced");
  } else if (result.type === "attachment") {
    const fv = String(data.final_verdict ?? "");
    if (fv) flags.push(fv);
  }

  const requestId = data.request_id as string | undefined;

  if (result.status === "rejected") {
    return (
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileWarning size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">{getPipelineLabel(result.type)}</span>
        </div>
        <p className="text-xs text-amber-400/60">Pipeline unavailable — {result.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white/80">{getPipelineLabel(result.type)}</span>
        {result.source === "extracted" && result.foundIn && (
          <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-semibold">
            Found in {result.foundIn}
          </span>
        )}
      </div>

      {result.extractedUrl && (
        <p className="text-xs text-white/40 mb-2 font-mono truncate">{result.extractedUrl}</p>
      )}

      {/* Threat Score Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Threat Score</span>
          <span className="text-xs font-bold text-white/70">{score}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${scoreColor} transition-all duration-700`} style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {flags.map((f, i) => (
            <span key={i} className="text-[10px] bg-white/[0.06] text-white/50 px-2 py-0.5 rounded-full border border-white/[0.08] font-medium">
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <p className="text-xs text-white/40 leading-relaxed line-clamp-3">{explanation}</p>
      )}

      {/* View Report Link */}
      {requestId && (
        <a href={`/home/history?type=${result.type}&id=${requestId}`} className="inline-flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 mt-3 transition-colors font-semibold uppercase tracking-wider">
          View Full Report <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━ Voice Card ━━━━━━━━━━━━━━━━━━━━━

function VoiceCard({ result }: { result: PipelineResult }) {
  if (result.status === "rejected") {
    return (
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">🎤 Voice Analysis</span>
        </div>
        <p className="text-xs text-amber-400/60">Pipeline unavailable — {result.error}</p>
      </div>
    );
  }

  const data = result.data || {};
  const voiceAnalysis = (data.voice_analysis || {}) as Record<string, unknown>;
  const fraudReport = (data.fraud_report || {}) as Record<string, unknown>;
  const transcript = String(data.transcript ?? "");
  const confidence = Number(voiceAnalysis.confidence ?? 0);
  const voiceResult = String(voiceAnalysis.result ?? "Unknown");
  const riskScore = Number(fraudReport.risk_score ?? 0);
  const isFraud = Boolean(fraudReport.is_fraud);

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:border-white/15 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Mic size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-white/80">🎤 Voice Analysis</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white/[0.04] rounded-lg p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Deepfake Score</p>
          <p className={`text-lg font-bold ${confidence > 0.7 ? "text-red-400" : "text-emerald-400"}`}>
            {(confidence * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-white/40">{voiceResult}</p>
        </div>
        <div className="bg-white/[0.04] rounded-lg p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Fraud Intent</p>
          <p className={`text-lg font-bold ${isFraud ? "text-red-400" : "text-emerald-400"}`}>
            {isFraud ? "Detected" : "None"}
          </p>
          <p className="text-[10px] text-white/40">Risk: {(riskScore * 100).toFixed(0)}%</p>
        </div>
      </div>

      {transcript && (
        <div className="bg-white/[0.03] rounded-lg p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Transcript</p>
          <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{transcript.slice(0, 200)}</p>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━ Result Message ━━━━━━━━━━━━━━━━━━━━━

function ResultMessage({ msg }: { msg: Message }) {
  const [extractedOpen, setExtractedOpen] = useState(false);
  const result = msg.result!;
  const vd = getVerdictColor(result.overallVerdict);
  const attachmentAutoScanCount = result.extractedUrlResults.filter(
    (r) => r.source === "extracted" && r.foundIn === "attachment"
  ).length;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] w-full space-y-3">
        {/* Verdict Banner */}
        <div className={`${vd.bg} ${vd.border} border rounded-2xl rounded-bl-md px-5 py-4 flex items-center gap-3`}>
          <span className={vd.text}>{vd.icon}</span>
          <div>
            <p className={`text-base font-bold ${vd.text}`}>{result.overallVerdict}</p>
            <p className="text-xs text-white/40 mt-0.5">
              {result.primaryResults.length + result.extractedUrlResults.length + result.voiceResults.length} pipeline{result.primaryResults.length + result.extractedUrlResults.length + result.voiceResults.length !== 1 && "s"} completed
            </p>
          </div>
          {attachmentAutoScanCount > 0 && (
            <span className="ml-auto text-[10px] bg-blue-500/15 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/25 font-semibold uppercase tracking-wider">
              Auto-scanned from attachment: {attachmentAutoScanCount}
            </span>
          )}
        </div>

        {/* Primary Result Cards */}
        {result.primaryResults.map((r, i) => (
          <ThreatCard key={`primary-${i}`} result={r} />
        ))}

        {/* Extracted URLs Section */}
        {result.extractedUrlResults.length > 0 && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <button
              onClick={() => setExtractedOpen(!extractedOpen)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                URLs found inside content ({result.extractedUrlResults.length})
              </span>
              {extractedOpen ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
            </button>
            {extractedOpen && (
              <div className="px-4 pb-4 space-y-3">
                {result.extractedUrlResults.map((r, i) => (
                  <ThreatCard key={`extracted-${i}`} result={r} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Voice Cards */}
        {result.voiceResults.map((r, i) => (
          <VoiceCard key={`voice-${i}`} result={r} />
        ))}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━ Main Portal Page ━━━━━━━━━━━━━━━━━━━━━

export default function PortalPage() {
  const {
    messages,
    pendingJobs,
    isAnalyzing,
    addJob,
    removeJob,
    clearJobs,
    addMessage,
    setMessages,
    updateThinkingMessage,
    replaceThinkingWithResult,
    setAnalyzing,
  } = usePortalStore();

  const [inputText, setInputText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chats, setChats] = useState<PortalChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatBootstrapped, setChatBootstrapped] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshChats = useCallback(async (): Promise<PortalChatListItem[]> => {
    const response = await getPortalChats();
    const list = (response.data ?? []) as PortalChatListItem[];
    setChats(list);
    return list;
  }, []);

  const openChat = useCallback(async (chatId: string) => {
    const response = await getPortalChat(chatId);
    const chat = response.data as PortalChatDetail;
    setMessages(deserializeMessages(chat.messages || []));
    setActiveChatId(chat.id);
  }, [setMessages]);

  const createNewChat = useCallback(async () => {
    const response = await createPortalChat({ title: "New Chat", messages: [] });
    const chat = response.data as PortalChatDetail;
    setActiveChatId(chat.id);
    setMessages([]);
    await refreshChats();
    return chat.id;
  }, [refreshChats, setMessages]);

  const ensureActiveChat = useCallback(async () => {
    if (activeChatId) return activeChatId;
    return createNewChat();
  }, [activeChatId, createNewChat]);

  const handleRenameStart = useCallback((chat: PortalChatListItem) => {
    setRenamingChatId(chat.id);
    setRenameDraft(chat.title || "New Chat");
  }, []);

  const handleRenameSave = useCallback(async (chatId: string) => {
    const nextTitle = renameDraft.trim() || "New Chat";
    try {
      await updatePortalChat(chatId, { title: nextTitle });
      await refreshChats();
    } finally {
      setRenamingChatId(null);
      setRenameDraft("");
    }
  }, [refreshChats, renameDraft]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    try {
      await deletePortalChat(chatId);
      const list = await refreshChats();
      if (chatId === activeChatId) {
        if (list.length > 0) {
          await openChat(list[0].id);
        } else {
          await createNewChat();
        }
      }
    } catch {
      // Keep UX resilient if delete fails.
    }
  }, [activeChatId, createNewChat, openChat, refreshChats]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const list = await refreshChats();
        if (!active) return;

        if (list.length === 0) {
          await createNewChat();
        } else {
          await openChat(list[0].id);
        }
      } catch {
        if (!active) return;
        setMessages([]);
      } finally {
        if (active) setChatBootstrapped(true);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [createNewChat, openChat, refreshChats, setMessages]);

  useEffect(() => {
    if (!chatBootstrapped || !activeChatId) return;

    const timeout = setTimeout(async () => {
      const payload = serializeMessages(messages);
      const title = deriveTitleFromMessages(messages);
      try {
        await updatePortalChat(activeChatId, { title, messages: payload });
        await refreshChats();
      } catch {
        // Ignore save jitter to avoid disrupting active analysis flow.
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [activeChatId, chatBootstrapped, messages, refreshChats]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  // Click outside to close picker
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-picker]")) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  // Auto-detect input on paste/type
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  }, []);

  async function handleSubmit() {
    await ensureActiveChat();

    // Collect jobs from pending + auto-detect from text input
    const jobsToSubmit = [...pendingJobs];

    if (inputText.trim()) {
      const detected = detectInputType(inputText.trim());
      if (detected) {
        if (detected.type === "url") {
          jobsToSubmit.push({
            id: uuid(),
            type: "url",
            payload: { url: detected.url },
            label: detected.url,
          });
        } else if (detected.type === "email") {
          jobsToSubmit.push({
            id: uuid(),
            type: "email",
            payload: { sender: detected.sender, subject: detected.subject, body: detected.body },
            label: detected.subject || "Email",
          });
        } else {
          jobsToSubmit.push({
            id: uuid(),
            type: "sms",
            payload: { text: detected.text },
            label: detected.text.slice(0, 50),
          });
        }
      }
    }

    if (jobsToSubmit.length === 0) return;

    // Add user message
    const userMsg: Message = {
      id: uuid(),
      role: "user",
      jobs: jobsToSubmit,
      timestamp: new Date(),
    };
    addMessage(userMsg);

    // Add thinking message
    const thinkingId = uuid();
    const thinkingMsg: Message = {
      id: thinkingId,
      role: "thinking",
      thinkingText: "ZoraAI is analyzing...",
      timestamp: new Date(),
    };
    addMessage(thinkingMsg);

    // Clear inputs
    setInputText("");
    clearJobs();
    setAnalyzing(true);

    try {
      const result = await orchestrate(jobsToSubmit, {
        onThinkingUpdate: (text) => updateThinkingMessage(thinkingId, text),
      });
      replaceThinkingWithResult(thinkingId, result);
    } catch {
      replaceThinkingWithResult(thinkingId, {
        primaryResults: [],
        extractedUrlResults: [],
        voiceResults: [],
        overallVerdict: "SUSPICIOUS",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // File drop zone for main area
  const { getRootProps: getDropProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      files.forEach((f) => {
        addJob({
          id: uuid(),
          type: "attachment",
          payload: { filename: f.name },
          label: f.name,
          file: f,
        });
      });
    },
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div {...getDropProps()} className="flex h-full relative">
      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-white/20">
          <div className="text-center">
            <Paperclip size={40} className="text-white/40 mx-auto mb-3" />
            <p className="text-white/60 font-medium">Drop files to analyze</p>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Chat Feed */}
        <div ref={feedRef} className="flex-1 overflow-y-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6">
                <Shield size={28} className="text-white/30" />
              </div>
              <h2 className="text-2xl font-bold text-white/80 mb-2 tracking-tight">ZoraAI Portal</h2>
              <p className="text-sm text-white/30 max-w-md leading-relaxed">
                Paste a URL, SMS, email, or upload a file to analyze for security threats. ZoraAI automatically determines which analysis pipelines to run.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {["Paste a suspicious URL", "Analyze an SMS", "Scan an email", "Upload a file"].map((hint) => (
                  <span key={hint} className="text-[10px] bg-white/[0.04] text-white/30 px-3 py-1.5 rounded-full border border-white/[0.06] font-medium">
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => {
                if (msg.role === "user") return <UserMessage key={msg.id} msg={msg} />;
                if (msg.role === "thinking") return <ThinkingMessage key={msg.id} msg={msg} />;
                if (msg.role === "result") return <ResultMessage key={msg.id} msg={msg} />;
                return null;
              })}
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-black/60 backdrop-blur-xl px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {/* Job Chips */}
            {pendingJobs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pendingJobs.map((job) => (
                  <JobChip key={job.id} job={job} onRemove={() => removeJob(job.id)} />
                ))}
              </div>
            )}

            {/* Input Row */}
            <div className="relative flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-2xl px-2 py-1.5 focus-within:border-white/20 transition-colors">
              {/* "+" Button */}
              <div data-picker className="relative">
                <button
                  onClick={() => setPickerOpen(!pickerOpen)}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors"
                  disabled={isAnalyzing}
                >
                  <Plus size={18} className="text-white/50" />
                </button>
                <AttachmentPicker
                  open={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onAddJob={(job) => {
                    addJob(job);
                    setPickerOpen(false);
                  }}
                />
              </div>

              {/* Text Input */}
              <input
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Paste a URL, SMS, email, or describe a threat..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none py-2 px-1 font-medium"
                disabled={isAnalyzing}
              />

              {/* Send Button */}
              <button
                onClick={handleSubmit}
                disabled={isAnalyzing && pendingJobs.length === 0 && !inputText.trim()}
                className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-400 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp size={18} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className={`${isSidebarCollapsed ? "w-14" : "w-80"} border-l border-white/[0.06] bg-white/[0.02] backdrop-blur-xl flex-shrink-0 transition-all duration-200`}>
        <div className="h-full flex flex-col">
          <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => setIsSidebarCollapsed((v) => !v)}
              className="h-9 w-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 flex items-center justify-center transition-colors"
              title={isSidebarCollapsed ? "Expand chats" : "Collapse chats"}
            >
              {isSidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            </button>
            {!isSidebarCollapsed && (
              <button
                onClick={() => {
                  void createNewChat();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                <Plus size={16} />
                New Chat
              </button>
            )}
          </div>
          {!isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!chatBootstrapped && (
              <p className="text-xs text-white/30 px-2 py-1">Loading chats...</p>
            )}
            {chatBootstrapped && chats.length === 0 && (
              <p className="text-xs text-white/30 px-2 py-1">No chats yet</p>
            )}
            {chats.map((chat) => {
              const isRenaming = renamingChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    activeChatId === chat.id
                      ? "bg-white/[0.07] border-white/20"
                      : "bg-transparent border-white/[0.08] hover:bg-white/[0.04] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => {
                        void openChat(chat.id);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      {isRenaming ? (
                        <input
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleRenameSave(chat.id);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setRenamingChatId(null);
                              setRenameDraft("");
                            }
                          }}
                          className="w-full bg-black/30 border border-white/20 rounded-md px-2 py-1 text-sm text-white/90 outline-none"
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-semibold text-white/80 truncate">{chat.title || "New Chat"}</p>
                      )}
                      <p className="text-[11px] text-white/35 mt-1 line-clamp-2">{chat.preview || "No messages yet"}</p>
                    </button>
                    <div className="flex items-center gap-1">
                      {isRenaming ? (
                        <button
                          onClick={() => {
                            void handleRenameSave(chat.id);
                          }}
                          className="h-7 w-7 rounded-md text-emerald-300 hover:bg-white/[0.08] flex items-center justify-center"
                          title="Save rename"
                        >
                          <Check size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRenameStart(chat)}
                          className="h-7 w-7 rounded-md text-white/45 hover:text-white/75 hover:bg-white/[0.08] flex items-center justify-center"
                          title="Rename chat"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          void handleDeleteChat(chat.id);
                        }}
                        className="h-7 w-7 rounded-md text-red-300/75 hover:text-red-200 hover:bg-red-500/10 flex items-center justify-center"
                        title="Delete chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-white/30 uppercase tracking-wider font-semibold">
                    <span>{chat.message_count} messages</span>
                    <span>{formatChatDate(chat.updated_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </aside>
    </div>
  );
}
