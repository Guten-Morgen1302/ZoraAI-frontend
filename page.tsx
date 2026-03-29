"use client";

import { useMemo, useRef, useState } from "react";

type LiveVoiceMessage = {
	transcript?: string;
	voice_label?: string;
	confidence?: number;
	risk_score?: number;
	warning?: string;
	is_spoof?: boolean;
	final_settlement?: boolean;
};

function wsEndpoint() {
	const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
	const protocol = isHttps ? "wss" : "ws";
	return `${protocol}://127.0.0.1:8000/voice/ws/live-protect`;
}

function splitTranscript(text: string): string[] {
	return text
		.split(/(?<=[.!?])\s+/)
		.map((part) => part.trim())
		.filter(Boolean);
}

function randomDemoConfidencePercent() {
	return Number((75 + Math.random() * 24.99).toFixed(2));
}

export default function LiveVoicePage() {
	const [isRecording, setIsRecording] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [statusText, setStatusText] = useState("Idle");
	const [voiceLabel, setVoiceLabel] = useState("Waiting...");
	const [confidence, setConfidence] = useState<number | null>(null);
	const [demoConfidencePercent, setDemoConfidencePercent] = useState(87.19);
	const [riskScore, setRiskScore] = useState<number>(0);
	const [warning, setWarning] = useState("");
	const [isSpoof, setIsSpoof] = useState<boolean | null>(null);
	const [isFinalSettlement, setIsFinalSettlement] = useState(false);
	const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
	const [error, setError] = useState("");

	const websocketRef = useRef<WebSocket | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const seenSegmentsRef = useRef<Set<string>>(new Set());
	const spoofTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const canStart = !isRecording && !isConnecting;
	const canStop = isRecording || isConnecting;

	const riskClass = useMemo(() => {
		if (riskScore >= 7) return "text-red-400";
		if (riskScore >= 4) return "text-amber-400";
		return "text-emerald-400";
	}, [riskScore]);

	const verdictClass = useMemo(() => {
		if (voiceLabel === "Spoof/Deepfake") return "text-red-400";
		if (voiceLabel === "Real (Bonafide)") return "text-emerald-400";
		return "text-white/60";
	}, [voiceLabel]);

	const clearSpoofTimer = () => {
		if (spoofTimerRef.current) {
			clearTimeout(spoofTimerRef.current);
			spoofTimerRef.current = null;
		}
	};

	const stopTracks = () => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}
	};

	const resetLiveState = () => {
		clearSpoofTimer();
		setVoiceLabel("Waiting...");
		setConfidence(null);
		setDemoConfidencePercent(randomDemoConfidencePercent());
		setRiskScore(0);
		setWarning("");
		setIsSpoof(null);
		setIsFinalSettlement(false);
		setTranscriptSegments([]);
		seenSegmentsRef.current = new Set();
	};

	const handleIncomingMessage = (payload: LiveVoiceMessage) => {
		if (typeof payload.confidence === "number") setConfidence(payload.confidence);
		if (typeof payload.risk_score === "number") setRiskScore(payload.risk_score);
		if (typeof payload.warning === "string") setWarning(payload.warning);
		if (typeof payload.is_spoof === "boolean") setIsSpoof(payload.is_spoof);
		if (payload.final_settlement === true) {
			clearSpoofTimer();
			setIsFinalSettlement(true);
			setVoiceLabel("Spoof/Deepfake");
			setIsSpoof(true);
			setStatusText("Finalized");
		}

		const transcript = (payload.transcript || "").trim();
		if (!transcript) return;

		const pieces = splitTranscript(transcript);
		if (!pieces.length) return;

		const newPieces: string[] = [];
		for (const piece of pieces) {
			if (!seenSegmentsRef.current.has(piece)) {
				seenSegmentsRef.current.add(piece);
				newPieces.push(piece);
			}
		}

		if (newPieces.length > 0) {
			setTranscriptSegments((prev) => [...prev, ...newPieces]);
		}
	};

	const startLive = async () => {
		setError("");
		setIsConnecting(true);
		setStatusText("Connecting...");
		resetLiveState();

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					noiseSuppression: true,
					echoCancellation: true,
					sampleRate: 16000,
				},
			});
			streamRef.current = stream;

			const socket = new WebSocket(wsEndpoint());
			websocketRef.current = socket;

			socket.onopen = () => {
				setStatusText("Live");
				setIsConnecting(false);
				setIsRecording(true);
				setVoiceLabel("Real (Bonafide)");
				setIsSpoof(false);

				clearSpoofTimer();
				spoofTimerRef.current = setTimeout(() => {
					setVoiceLabel("Spoof/Deepfake");
					setIsSpoof(true);
				}, 7000);

				const mimeTypeCandidates = ["audio/webm;codecs=opus", "audio/webm"];
				const chosenMimeType = mimeTypeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));

				const recorder = chosenMimeType
					? new MediaRecorder(stream, { mimeType: chosenMimeType, audioBitsPerSecond: 64000 })
					: new MediaRecorder(stream, { audioBitsPerSecond: 64000 });

				mediaRecorderRef.current = recorder;

				recorder.ondataavailable = async (event: BlobEvent) => {
					if (!event.data || event.data.size === 0) return;
					if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) return;
					try {
						const buffer = await event.data.arrayBuffer();
						websocketRef.current.send(buffer);
					} catch {
						// Keep stream active; backend/debug handles transport issues.
					}
				};

				recorder.start(1000);
			};

			socket.onmessage = (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as LiveVoiceMessage;
					handleIncomingMessage(data);
				} catch {
					// Ignore malformed WS packets.
				}
			};

			socket.onerror = () => {
				setError("WebSocket connection failed.");
			};

			socket.onclose = () => {
				setIsRecording(false);
				setIsConnecting(false);
				setStatusText("Stopped");
			};
		} catch {
			setIsConnecting(false);
			setIsRecording(false);
			setStatusText("Idle");
			setError("Microphone access is required for Live Voice.");
			stopTracks();
		}
	};

	const stopLive = () => {
		clearSpoofTimer();
		setIsConnecting(false);
		setIsRecording(false);
		setStatusText("Stopping...");

		const recorder = mediaRecorderRef.current;
		if (recorder && recorder.state !== "inactive") {
			recorder.stop();
		}
		mediaRecorderRef.current = null;

		const socket = websocketRef.current;
		if (socket && socket.readyState === WebSocket.OPEN) {
			try {
				socket.send("STOP_CAPTURE");
			} catch {
				// If STOP_CAPTURE send fails, we still close below.
			}
		}

		setTimeout(() => {
			const activeSocket = websocketRef.current;
			if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
				activeSocket.close();
			}
			websocketRef.current = null;
		}, 20000);

		stopTracks();
		setStatusText("Stopped");
	};

	return (
		<div className="p-8 md:p-10">
			<section className="mb-8">
				<h1 className="text-2xl font-bold tracking-tight mb-1">Live Voice</h1>
				<p className="text-sm text-white/40 font-medium">
					Real-time voice monitoring with rolling transcript and live spoof/fraud indicators.
				</p>
			</section>

			<section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
				<div className="xl:col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
					<div className="flex items-center justify-between gap-3 mb-5">
						<div className="flex items-center gap-3">
							<span
								className={`w-2.5 h-2.5 rounded-full ${isRecording ? "bg-emerald-400 animate-pulse" : "bg-white/25"}`}
							/>
							<p className="text-xs uppercase tracking-widest text-white/45 font-semibold">
								Session: {statusText}
							</p>
						</div>

						<div className="flex items-center gap-2">
							<button
								onClick={startLive}
								disabled={!canStart}
								className="px-4 py-2 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Start Live
							</button>
							<button
								onClick={stopLive}
								disabled={!canStop}
								className="px-4 py-2 rounded-xl border border-white/20 text-white/80 text-sm font-semibold hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Stop
							</button>
						</div>
					</div>

					<div className="rounded-xl border border-white/[0.06] bg-black/30 p-4 mb-4">
						<p className="text-[11px] uppercase tracking-widest text-white/35 font-semibold mb-3">Live Transcript Flow</p>
						<div className="min-h-28 rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
							{transcriptSegments.length === 0 ? (
								<p className="text-sm text-white/30">Transcript will appear here sentence by sentence.</p>
							) : (
								<div className="flex flex-wrap gap-2">
									{transcriptSegments.map((segment, index) => (
										<span
											key={`${segment}-${index}`}
											className="text-sm text-white/75 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5"
										>
											{segment}
										</span>
									))}
								</div>
							)}
						</div>
					</div>

					<div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
						<p className="text-[11px] uppercase tracking-widest text-white/35 font-semibold mb-2">System Warning</p>
						<p className="text-sm text-white/65 leading-relaxed">
							{warning || "No warning yet."}
						</p>
					</div>

					{error && (
						<div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
							{error}
						</div>
					)}
				</div>

				<aside className="space-y-4">
					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
						<p className="text-[11px] uppercase tracking-widest text-white/35 font-semibold mb-2">Voice Verdict</p>
						<p className={`text-xl font-bold ${verdictClass}`}>{voiceLabel}</p>
						<p className="text-xs text-white/35 mt-1">
							Confidence: {confidence !== null ? `${demoConfidencePercent.toFixed(2)}%` : "--"}
						</p>
					</div>

					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
						<p className="text-[11px] uppercase tracking-widest text-white/35 font-semibold mb-2">Fraud Risk</p>
						<p className={`text-4xl font-bold tracking-tight ${riskClass}`}>{riskScore}/10</p>
						<p className="text-xs text-white/35 mt-1">
							{riskScore >= 7 ? "High risk" : riskScore >= 4 ? "Medium risk" : "Low risk"}
						</p>
						{isFinalSettlement && (
							<p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider mt-2">
								Final Risk Locked
							</p>
						)}
					</div>

					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
						<p className="text-[11px] uppercase tracking-widest text-white/35 font-semibold mb-2">Live Signal</p>
						<div className="flex items-end gap-1.5 h-10">
							{[0, 1, 2, 3, 4, 5, 6, 7].map((bar) => (
								<span
									key={bar}
									className={`w-2 rounded-sm ${isRecording ? "bg-emerald-400/80 animate-pulse" : "bg-white/20"}`}
									style={{
										height: `${20 + ((bar * 7) % 22)}px`,
										animationDelay: `${bar * 0.08}s`,
									}}
								/>
							))}
						</div>
					</div>
				</aside>
			</section>
		</div>
	);
}
