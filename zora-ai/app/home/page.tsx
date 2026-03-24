"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/[0.04] bg-black/60 backdrop-blur-xl">
        <div className="text-xl font-bold tracking-tight">
          Zora
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-sm text-white/50">Dashboard</div>
          <button 
            onClick={async () => {
              await fetch("http://localhost:8000/auth/logout", { method: "POST", credentials: "include" }).catch();
              router.push("/");
            }}
            className="text-sm font-medium hover:text-white/70 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Welcome to Zora</h1>
          <p className="text-white/50">Your AI-powered fraud intelligence dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 h-64 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-medium mb-2">SMS Analyzer</h3>
            <p className="text-sm text-white/40">Analyze SMS risk with multi-signal intelligence</p>
          </div>
          <div className="glass-card p-6 h-64 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-medium mb-2">Email Analyzer</h3>
            <p className="text-sm text-white/40">Detect phishing emails using layered evidence</p>
          </div>
          <div className="glass-card p-6 h-64 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-medium mb-2">Attachment Sandbox</h3>
            <p className="text-sm text-white/40">Static threat analysis for uploaded files</p>
          </div>
        </div>
      </main>
    </div>
  );
}
