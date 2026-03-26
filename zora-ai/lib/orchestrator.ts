import {
  analyzeSMS,
  analyzeEmail,
  analyzeURL,
  analyzeAttachment,
  analyzeVoice,
} from "./api";
import type {
  AnalysisJob,
  PipelineResult,
  AggregatedResult,
} from "./portalStore";

// ─── Helpers ───

function extractURLsFromText(text: string): string[] {
  const seen = new Set<string>();

  const pushIfValid = (candidate: string) => {
    const normalized = normalizeUrlCandidate(candidate);
    if (normalized) seen.add(normalized);
  };

  const httpRegex = /https?:\/\/[^\s"'<>()[\]{}]+/gi;
  const domainRegex = /\b(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?(?:\/[\w\-./?%&=+#~]*)?/gi;

  for (const match of text.match(httpRegex) || []) {
    pushIfValid(match);
  }
  for (const match of text.match(domainRegex) || []) {
    pushIfValid(match);
  }

  return [...seen];
}

function normalizeUrlCandidate(raw: string): string | null {
  const cleaned = raw.trim().replace(/[),.;]+$/, "");
  if (!cleaned) return null;

  // Avoid classifying plain filenames as URLs.
  if (/^[\w.-]+\.(pdf|docx?|xlsx?|pptx?|dll|exe|zip|rar|7z|txt|json|csv|log)$/i.test(cleaned)) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

  try {
    const parsed = new URL(withScheme);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!parsed.hostname || !parsed.hostname.includes(".")) return null;

    return parsed.toString();
  } catch {
    return null;
  }
}

function determineVerdict(results: PipelineResult[]): "SAFE" | "SUSPICIOUS" | "DANGEROUS" {
  let maxThreat = 0;

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.data) continue;
    const d = r.data;

    // URL analysis
    const riskScore = Number(d.risk_score ?? 0);
    const phishProb = Number(d.phishing_probability ?? 0);

    // SMS/Email analysis
    const riskScoreAlt = Number(d.risk_score ?? 0);

    // Attachment analysis
    const verdict = String(d.final_verdict ?? "").toLowerCase();

    // Voice analysis
    const voiceResult = d.voice_analysis as Record<string, unknown> | undefined;
    const predLabel = Number(voiceResult?.pred_label ?? 0);

    // Compute per-result threat level
    let level = 0;

    if (r.type === "url") {
      level = Math.max(riskScore, phishProb);
    } else if (r.type === "sms" || r.type === "email") {
      level = riskScoreAlt;
    } else if (r.type === "attachment") {
      if (verdict === "malicious") level = 0.9;
      else if (verdict === "suspicious") level = 0.6;
      else level = 0.1;
    } else if (r.type === "voice") {
      level = predLabel === 1 ? 0.8 : 0.1;
    }

    maxThreat = Math.max(maxThreat, level);
  }

  if (maxThreat >= 0.7) return "DANGEROUS";
  if (maxThreat >= 0.4) return "SUSPICIOUS";
  return "SAFE";
}

// ─── Pipeline Runner ───

async function runPipeline(job: AnalysisJob): Promise<PipelineResult> {
  try {
    let res;
    switch (job.type) {
      case "sms":
        res = await analyzeSMS(job.payload.text as string);
        return { type: "sms", status: "fulfilled", data: res.data };
      case "email":
        res = await analyzeEmail(
          job.payload.sender as string,
          job.payload.subject as string,
          job.payload.body as string
        );
        return { type: "email", status: "fulfilled", data: res.data };
      case "url":
        res = await analyzeURL(job.payload.url as string);
        return { type: "url", status: "fulfilled", data: res.data };
      case "attachment":
        res = await analyzeAttachment(job.file!);
        return { type: "attachment", status: "fulfilled", data: res.data };
      case "voice":
        res = await analyzeVoice(job.file!);
        return { type: "voice", status: "fulfilled", data: res.data };
      default:
        return { type: job.type, status: "rejected", error: "Unknown job type" };
    }
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Pipeline failed";
    return { type: job.type, status: "rejected", error: msg };
  }
}

// ─── Orchestrator ───

export interface OrchestratorCallbacks {
  onThinkingUpdate: (text: string) => void;
}

export async function orchestrate(
  jobs: AnalysisJob[],
  callbacks: OrchestratorCallbacks
): Promise<AggregatedResult> {
  // Separate voice jobs — they bypass orchestration
  const voiceJobs = jobs.filter((j) => j.type === "voice");
  const primaryJobs = jobs.filter((j) => j.type !== "voice");

  callbacks.onThinkingUpdate("ZoraAI is analyzing...");

  // Step 1: Run all primary + voice jobs in parallel
  const allPromises = [
    ...primaryJobs.map((j) => runPipeline(j)),
    ...voiceJobs.map((j) => runPipeline(j)),
  ];

  const allResults = await Promise.allSettled(allPromises);

  const results: PipelineResult[] = allResults.map((r, i) => {
    if (r.status === "fulfilled") {
      return { ...r.value, source: "primary" as const };
    }
    const jobType = i < primaryJobs.length ? primaryJobs[i].type : voiceJobs[i - primaryJobs.length].type;
    return {
      type: jobType,
      status: "rejected" as const,
      error: r.reason?.message ?? "Pipeline failed",
      source: "primary" as const,
    };
  });

  const primaryResults = results.filter((r) => r.type !== "voice");
  const voiceResults = results.filter((r) => r.type === "voice");

  // Step 2: Extract URLs from primary results
  const userUrlSet = new Set(
    primaryJobs
      .filter((j) => j.type === "url")
      .map((j) => j.payload.url as string)
  );

  const extractedUrls: { url: string; foundIn: "attachment" | "email" | "sms" }[] = [];

  for (let i = 0; i < primaryJobs.length; i++) {
    const job = primaryJobs[i];
    const result = primaryResults[i];
    if (!result || result.status !== "fulfilled") continue;

    let textToScan = "";

    if (job.type === "attachment" && result.data) {
      // Scan attachment result for URLs
      textToScan = JSON.stringify(result.data);
    } else if (job.type === "email") {
      textToScan = (job.payload.body as string) || "";
    } else if (job.type === "sms") {
      textToScan = (job.payload.text as string) || "";
    }

    if (textToScan) {
      const urls = extractURLsFromText(textToScan);
      for (const url of urls) {
        if (!userUrlSet.has(url)) {
          userUrlSet.add(url); // deduplicate
          extractedUrls.push({
            url,
            foundIn: job.type as "attachment" | "email" | "sms",
          });
        }
      }
    }
  }

  // Step 3: Run secondary URL jobs
  let extractedUrlResults: PipelineResult[] = [];

  if (extractedUrls.length > 0) {
    callbacks.onThinkingUpdate(
      `Also analyzing ${extractedUrls.length} URL${extractedUrls.length > 1 ? "s" : ""} found inside content...`
    );

    const urlPromises = extractedUrls.map(async ({ url, foundIn }) => {
      try {
        const res = await analyzeURL(url);
        return {
          type: "url" as const,
          status: "fulfilled" as const,
          data: res.data,
          source: "extracted" as const,
          foundIn,
          extractedUrl: url,
        } satisfies PipelineResult;
      } catch {
        return {
          type: "url" as const,
          status: "rejected" as const,
          error: "URL analysis failed",
          source: "extracted" as const,
          foundIn,
          extractedUrl: url,
        } satisfies PipelineResult;
      }
    });

    extractedUrlResults = await Promise.all(urlPromises);
  }

  // Step 4: Aggregate
  const allFinal = [...primaryResults, ...extractedUrlResults, ...voiceResults];
  const overallVerdict = determineVerdict(allFinal);

  return {
    primaryResults,
    extractedUrlResults,
    voiceResults,
    overallVerdict,
  };
}
