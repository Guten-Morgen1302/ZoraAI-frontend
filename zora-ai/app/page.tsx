import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-16 py-5 bg-black/60 backdrop-blur-xl border-b border-white/[0.04]">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Zora
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="nav-btn-login">
            Log in
          </Link>
          <Link href="/signup" className="nav-btn-signup">
            Sign up
          </Link>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 hero-bg overflow-hidden font-sans">
        {/* Background image 1 */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/bg-image.png')" }}
        />

        {/* Content on top of overlay */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="animate-fade-in-up animate-delay-1 mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-sm text-white/70 badge-glow">
              <span className="text-xs font-semibold bg-white text-black px-2 py-0.5 rounded-full">
                NEW
              </span>
              Multi-signal fraud intelligence → Live now
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up animate-delay-2 text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.08] tracking-tight mb-6">
            The AI-powered fraud
            <br />
            detection backbone
            <br />
            <span className="gradient-text">for security teams</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up animate-delay-3 text-lg md:text-xl text-white/50 max-w-2xl leading-relaxed mb-10">
            Zora is the multi-signal fraud intelligence engine built for
            analysts. Layered NLP, stylometry, vector memory, and LLM reasoning
            — zero infrastructure headaches.
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up animate-delay-4 flex flex-col sm:flex-row items-center gap-4">
            <Link href="/signup" className="btn-primary">
              Get started free
            </Link>
            <Link href="#features" className="btn-secondary">
              Explore features
            </Link>
          </div>
        </div>
      </section>

      {/* Wrapping the rest of the page in font-space so that everything after Hero uses Space Grotesk */}
      <div className="font-[family-name:var(--font-space)] relative z-10">

        {/* ─── Features Section ─── */}
        <section id="features" className="relative py-32 px-6 md:px-16 overflow-hidden">
          
          {/* Background image 2 overlaying the black surface with some opacity */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 pointer-events-none mix-blend-screen"
            style={{ backgroundImage: "url('/bg-image-2.png')" }}
          />

          <div className="relative max-w-6xl mx-auto z-10">
            {/* Section header */}
            <div className="text-center mb-20">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
                Core Capabilities
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5 drop-shadow-lg">
                Multi-layered threat intelligence
              </h2>
              <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
                Every analysis combines deterministic, ML, and retrieval signals
                for defensible, explainable decisions.
              </p>
            </div>

            {/* Feature cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* ── SMS Analyzer ── */}
              <div className="glass-card p-8 bg-black/40 border-white/10 hover:border-white/20 transition-all duration-300">
                <h3 className="text-xl font-bold mb-3 tracking-wide">SMS Analyzer</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6 font-medium">
                  Multi-signal fraud intelligence pipeline that classifies risky
                  SMS content using layered evidence instead of relying on a
                  single model prediction.
                </p>
                <ul className="space-y-3.5 text-sm text-white/50 border-t border-white/10 pt-5">
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Transformer-based NLP semantic classification with confidence calibration
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Stylometry behavioral forensics — catches social engineering tone
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Vector memory similarity search over known fraud patterns
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Local LLM reasoning for ambiguous cases — zero cloud exposure
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    URL threat heuristics with DNS, entropy, and SSRF detection
                  </li>
                </ul>
              </div>

              {/* ── Email Analyzer ── */}
              <div className="glass-card p-8 bg-black/40 border-white/10 hover:border-white/20 transition-all duration-300">
                <h3 className="text-xl font-bold mb-3 tracking-wide">Email Analyzer</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6 font-medium">
                  Multi-signal phishing intelligence pipeline designed to classify
                  risky email content with layered evidence and full
                  auditability.
                </p>
                <ul className="space-y-3.5 text-sm text-white/50 border-t border-white/10 pt-5">
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Gmail API integration and browser extension payload support
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Transformer NLP phishing classification with calibrated confidence
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Stylometry scoring — detects manipulation tone and pressure
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Pinecone vector memory for known phishing family matching
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    End-to-end PostgreSQL persistence for auditability and retraining
                  </li>
                </ul>
              </div>

              {/* ── Attachment Sandbox ── */}
              <div className="glass-card p-8 bg-black/40 border-white/10 hover:border-white/20 transition-all duration-300">
                <h3 className="text-xl font-bold mb-3 tracking-wide">Attachment Sandbox</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6 font-medium">
                  Static file threat-analysis subsystem that analyzes uploaded
                  attachments without detonation using three independent detection
                  engines.
                </p>
                <ul className="space-y-3.5 text-sm text-white/50 border-t border-white/10 pt-5">
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    YARA signatures and heuristic rule matching
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    ClamAV antivirus engine for known malware families
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    LightGBM PE classifier (Thrember) + XGBoost fallback
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Type-specific parsers for PE, PDF, and Office documents
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/30 text-xs mt-1">●</span>
                    Conservative verdict synthesis — any engine flag marks suspicious
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider relative z-20" />

        {/* ─── How It Works ─── */}
        <section className="relative py-32 px-6 md:px-16 overflow-hidden">
          
          {/* Background image 3 mapping over Architecture section */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 pointer-events-none mix-blend-screen"
            style={{ backgroundImage: "url('/bg-image-3.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />

          <div className="relative max-w-4xl mx-auto text-center z-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
              Architecture
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 drop-shadow-lg">
              Weighted multi-signal scoring
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed mb-16">
              Every analysis fuses signals from independent engines into a single
              defensible risk score with typed outcomes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-card p-8 text-center bg-black/50 border-white/10">
                <div className="text-4xl font-bold text-white mb-3 tracking-tighter">40%</div>
                <div className="text-sm text-white/60 font-medium uppercase tracking-wider mb-2">
                  NLP Semantic
                </div>
                <p className="text-xs text-white/30 font-medium">
                  Transformer-based intent classification
                </p>
              </div>
              <div className="glass-card p-8 text-center bg-black/50 border-white/10">
                <div className="text-4xl font-bold text-white mb-3 tracking-tighter">30%</div>
                <div className="text-sm text-white/60 font-medium uppercase tracking-wider mb-2">
                  Similarity
                </div>
                <p className="text-xs text-white/30 font-medium">
                  Pinecone memory over known fraud patterns
                </p>
              </div>
              <div className="glass-card p-8 text-center bg-black/50 border-white/10">
                <div className="text-4xl font-bold text-white mb-3 tracking-tighter">30%</div>
                <div className="text-sm text-white/60 font-medium uppercase tracking-wider mb-2">
                  Stylometry
                </div>
                <p className="text-xs text-white/30 font-medium">
                  Writing behavior and social engineering tone
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider relative z-20" />

        {/* ─── APIs & SDKs Section ─── */}
        <section className="relative py-32 px-6 md:px-16 bg-black z-10">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
              For Developers
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5 drop-shadow-lg">
              APIs & SDKs — Coming Soon
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-16">
              Integrate Zora's fraud detection intelligence directly into your
              applications with our upcoming native packages.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {/* Removed emojis from SDK cards */}
              <div className="sdk-card bg-zinc-950/50 border-white/5">
                <div className="text-sm font-bold tracking-wider text-white">
                  REST API
                </div>
                <div className="text-xs text-white/40 mt-2 font-medium">JSON endpoints</div>
              </div>
              <div className="sdk-card bg-zinc-950/50 border-white/5">
                <div className="text-sm font-bold tracking-wider text-white">
                  PYTHON SDK
                </div>
                <div className="text-xs text-white/40 mt-2 font-medium">pip install zora-ai</div>
              </div>
              <div className="sdk-card bg-zinc-950/50 border-white/5">
                <div className="text-sm font-bold tracking-wider text-white">
                  NODE.JS SDK
                </div>
                <div className="text-xs text-white/40 mt-2 font-medium">npm install @zora/sdk</div>
              </div>
              <div className="sdk-card bg-zinc-950/50 border-white/5">
                <div className="text-sm font-bold tracking-wider text-white">
                  WEBHOOKS
                </div>
                <div className="text-xs text-white/40 mt-2 font-medium">Real-time alerts</div>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider relative z-20" />

        {/* ─── Footer ─── */}
        <footer className="relative py-16 px-6 md:px-16 bg-black z-10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-xl font-bold tracking-tight text-white/90">
              Zora
            </div>
            <p className="text-sm text-white/30 font-medium">
              © {new Date().getFullYear()} Zora. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-white/40 font-medium tracking-wide">
              <Link href="#features" className="hover:text-white transition-colors">
                FEATURES
              </Link>
              <Link href="/login" className="hover:text-white transition-colors">
                LOGIN
              </Link>
              <Link href="/signup" className="hover:text-white transition-colors">
                SIGN UP
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
