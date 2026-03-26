import { create } from "zustand";

// ─── Types ───

export type JobType = "url" | "sms" | "email" | "attachment" | "voice";

export interface AnalysisJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  label: string;
  file?: File;
}

export interface PipelineResult {
  type: JobType;
  status: "fulfilled" | "rejected";
  data?: Record<string, unknown>;
  error?: string;
  source?: "primary" | "extracted";
  foundIn?: "attachment" | "email" | "sms";
  extractedUrl?: string;
}

export interface AggregatedResult {
  primaryResults: PipelineResult[];
  extractedUrlResults: PipelineResult[];
  voiceResults: PipelineResult[];
  overallVerdict: "SAFE" | "SUSPICIOUS" | "DANGEROUS";
}

export type MessageRole = "user" | "thinking" | "result";

export interface Message {
  id: string;
  role: MessageRole;
  jobs?: AnalysisJob[];
  result?: AggregatedResult;
  thinkingText?: string;
  timestamp: Date;
}

// ─── Store ───

interface PortalStore {
  messages: Message[];
  pendingJobs: AnalysisJob[];
  isAnalyzing: boolean;

  addJob: (job: AnalysisJob) => void;
  removeJob: (id: string) => void;
  clearJobs: () => void;

  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  updateThinkingMessage: (id: string, text: string) => void;
  replaceThinkingWithResult: (id: string, result: AggregatedResult) => void;

  setAnalyzing: (v: boolean) => void;
}

function uuid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export const usePortalStore = create<PortalStore>((set) => ({
  messages: [],
  pendingJobs: [],
  isAnalyzing: false,

  addJob: (job) =>
    set((s) => ({ pendingJobs: [...s.pendingJobs, job] })),

  removeJob: (id) =>
    set((s) => ({
      pendingJobs: s.pendingJobs.filter((j) => j.id !== id),
    })),

  clearJobs: () => set({ pendingJobs: [] }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  setMessages: (msgs) => set({ messages: msgs }),

  updateThinkingMessage: (id, text) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, thinkingText: text } : m
      ),
    })),

  replaceThinkingWithResult: (id, result) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? { ...m, role: "result" as MessageRole, result, thinkingText: undefined }
          : m
      ),
    })),

  setAnalyzing: (v) => set({ isAnalyzing: v }),
}));

export { uuid };
