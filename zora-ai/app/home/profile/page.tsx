"use client";

import { useEffect, useMemo, useState } from "react";

interface UserInfo {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  organization_name: string | null;
}

interface ApiKeyListItem {
  key_id: string;
  masked_key: string;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

interface ApiKeyCreateResponse {
  key_id: string;
  api_key: string;
  expires_at: string;
  valid_for_days: number;
}

interface ApiKeyRevealResponse {
  key_id: string;
  api_key: string;
  expires_at: string;
}

const API_BASE = "http://localhost:8000";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function isExpired(value: string) {
  return new Date(value).getTime() < Date.now();
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [keysError, setKeysError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [lastGenerated, setLastGenerated] = useState<ApiKeyCreateResponse | null>(null);

  const [revealLoadingId, setRevealLoadingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [revealed, setRevealed] = useState<ApiKeyRevealResponse | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  const activeCount = useMemo(
    () => keys.filter((k) => k.is_active && !isExpired(k.expires_at)).length,
    [keys],
  );

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data: UserInfo = await res.json();
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  const loadKeys = async () => {
    setLoadingKeys(true);
    setKeysError("");
    try {
      const res = await fetch(`${API_BASE}/api-keys`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to load API keys (${res.status})`);
      }
      const data: ApiKeyListItem[] = await res.json();
      setKeys(data);
    } catch (err: unknown) {
      setKeysError(err instanceof Error ? err.message : "Failed to load API keys");
      setKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadKeys();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError("");
    setCopyMessage("");
    try {
      const res = await fetch(`${API_BASE}/api-keys/request`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to generate key (${res.status})`);
      }
      const data: ApiKeyCreateResponse = await res.json();
      setLastGenerated(data);
      setRevealed({ key_id: data.key_id, api_key: data.api_key, expires_at: data.expires_at });
      setModalOpen(true);
      await loadKeys();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate API key");
    } finally {
      setGenerating(false);
    }
  };

  const handleReveal = async (keyId: string) => {
    setRevealLoadingId(keyId);
    setCopyMessage("");
    try {
      const res = await fetch(`${API_BASE}/api-keys/${keyId}/reveal`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Failed to reveal key (${res.status})`);
      }
      const data: ApiKeyRevealResponse = await res.json();
      setRevealed(data);
      setModalOpen(true);
    } catch (err: unknown) {
      setKeysError(err instanceof Error ? err.message : "Failed to reveal API key");
    } finally {
      setRevealLoadingId(null);
    }
  };

  const handleCopy = async () => {
    if (!revealed?.api_key) {
      return;
    }
    try {
      await navigator.clipboard.writeText(revealed.api_key);
      setCopyMessage("Copied to clipboard.");
    } catch {
      setCopyMessage("Clipboard copy failed. Please copy manually.");
    }
  };

  return (
    <div className="p-8 md:p-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Profile & API Keys</h1>
          <p className="text-white/40 text-sm font-medium">
            Create and manage keys for SDK and direct API integrations.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? "Generating..." : "Generate API Key"}
        </button>
      </div>

      {generateError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {generateError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">User</p>
          <p className="text-sm font-semibold text-white/80 mt-2">{user?.full_name || "-"}</p>
          <p className="text-xs text-white/40 mt-1">{user?.email || "Not signed in"}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Active Keys</p>
          <p className="text-2xl font-bold mt-2">{activeCount}</p>
          <p className="text-xs text-white/35 mt-1">Valid and not expired</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Latest Key Expiry</p>
          <p className="text-sm font-semibold text-white/80 mt-2">
            {lastGenerated ? formatDateTime(lastGenerated.expires_at) : keys[0] ? formatDateTime(keys[0].expires_at) : "-"}
          </p>
          <p className="text-xs text-white/35 mt-1">Default validity: 90 days</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/40">Your API Keys</h2>
          <span className="text-xs text-white/30">{keys.length} total</span>
        </div>

        {keysError && (
          <div className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {keysError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-white/35 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
                <th className="px-5 py-3 font-semibold">Masked Key</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold">Expires</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingKeys && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-white/35">Loading API keys...</td>
                </tr>
              )}
              {!loadingKeys && keys.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-white/35">No API keys yet. Generate your first one.</td>
                </tr>
              )}
              {!loadingKeys &&
                keys.map((key) => {
                  const expired = isExpired(key.expires_at);
                  const statusText = !key.is_active ? "Revoked" : expired ? "Expired" : "Active";
                  const statusClass = !key.is_active
                    ? "bg-white/[0.06] text-white/45"
                    : expired
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-emerald-500/15 text-emerald-300";

                  return (
                    <tr key={key.key_id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3.5 font-mono text-[13px] text-white/75">{key.masked_key}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${statusClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-white/55">{formatDateTime(key.created_at)}</td>
                      <td className="px-5 py-3.5 text-white/55">{formatDateTime(key.expires_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleReveal(key.key_id)}
                          disabled={revealLoadingId === key.key_id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] text-white/70 hover:text-white hover:border-white/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Reveal key"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          {revealLoadingId === key.key_id ? "Opening..." : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && revealed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-zinc-950 shadow-2xl">
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">API Key</h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setCopyMessage("");
                }}
                className="text-white/40 hover:text-white/80 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-white/45">Store this key securely. It grants access to your account APIs.</p>

              <div className="rounded-xl border border-white/[0.1] bg-black/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/35 mb-2">Key Value</p>
                <p className="font-mono text-sm text-emerald-300 break-all">{revealed.api_key}</p>
              </div>

              <p className="text-xs text-white/45">Expires at: {formatDateTime(revealed.expires_at)}</p>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
                >
                  Copy to Clipboard
                </button>
                {copyMessage && <span className="text-xs text-white/50">{copyMessage}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
