"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Login failed (${res.status})`);
      }

      router.push("/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black px-6">
      {/* Back to home */}
      <Link
        href="/"
        className="absolute top-6 left-8 text-sm text-white/30 hover:text-white/60 transition-colors"
      >
        ← Back
      </Link>

      <div className="auth-card">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Zora
          </Link>
          <h1 className="text-xl font-semibold mt-6 mb-2">Welcome back</h1>
          <p className="text-sm text-white/40">
            Sign in to your account to continue
          </p>
        </div>

        {/* Error */}
        {error && <div className="auth-error mb-5">{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Email
            </label>
            <input
              type="email"
              className="auth-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Password
            </label>
            <input
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-submit mt-2"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-white/30 mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-white/70 hover:text-white underline underline-offset-4 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
