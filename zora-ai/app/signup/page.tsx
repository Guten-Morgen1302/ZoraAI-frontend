"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          full_name: fullName || null,
          organization_name: orgName || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Signup failed (${res.status})`);
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
          <h1 className="text-xl font-semibold mt-6 mb-2">Create your account</h1>
          <p className="text-sm text-white/40">
            Get started with Zora fraud intelligence
          </p>
        </div>

        {/* Error */}
        {error && <div className="auth-error mb-5">{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Email <span className="text-red-400">*</span>
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
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              className="auth-input"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              className="auth-input"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Organization
            </label>
            <input
              type="text"
              className="auth-input"
              placeholder="Acme Corp"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="auth-submit mt-2"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-white/30 mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-white/70 hover:text-white underline underline-offset-4 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
