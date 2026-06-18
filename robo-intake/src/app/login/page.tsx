"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type Phase = "idle" | "loading" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState("AWAITING CREDENTIALS");
  const [showPw, setShowPw] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    emailRef.current?.focus();
    // If already logged in, redirect
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase === "loading") return;

    if (!supabase) {
      setPhase("error");
      setStatusMsg("ERR: SUPABASE NOT CONFIGURED");
      return;
    }

    setPhase("loading");
    setStatusMsg("AUTHENTICATING...");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setPhase("error");
      setStatusMsg(`ERR: ${error.message.toUpperCase()}`);
      setTimeout(() => { setPhase("idle"); setStatusMsg("AWAITING CREDENTIALS"); }, 3000);
      return;
    }

    setPhase("success");
    setStatusMsg("ACCESS GRANTED — REDIRECTING");
    setTimeout(() => router.replace("/"), 900);
  };

  const isSupabaseConfigured = !!supabase;

  return (
    <div className="min-h-screen flex overflow-hidden bg-[#060d14]" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Left Panel — Radar / Brand ── */}
      <div
        className="hidden lg:flex flex-col justify-between relative w-[46%] shrink-0 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #060d14 0%, #0a1520 40%, #0d1b2a 100%)",
          borderRight: "1px solid rgba(14,165,160,0.12)",
          animation: "login-slidein 0.7s cubic-bezier(.22,.68,0,1.2) both",
        }}
      >
        {/* Grid overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(14,165,160,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,160,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Radar visualization — centered */}
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          {/* Concentric rings */}
          {[280, 210, 140, 72].map((size, i) => (
            <div
              key={size}
              className="absolute rounded-full border"
              style={{
                width: size,
                height: size,
                borderColor: `rgba(14,165,160,${0.06 + i * 0.03})`,
              }}
            />
          ))}

          {/* Ping rings */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border border-teal-500/20"
              style={{
                width: 280,
                height: 280,
                animation: `radar-ping 3.6s cubic-bezier(0,0,0.2,1) ${i * 1.2}s infinite`,
              }}
            />
          ))}

          {/* Sweep arm */}
          <div
            className="absolute"
            style={{
              width: 140,
              height: 140,
              borderRadius: "50%",
              background:
                "conic-gradient(from 0deg, transparent 270deg, rgba(14,165,160,0.35) 360deg)",
              animation: "radar-sweep 4s linear infinite",
              transformOrigin: "center center",
            }}
          />

          {/* Center dot */}
          <div
            className="absolute w-2 h-2 rounded-full bg-teal-400"
            style={{ boxShadow: "0 0 12px 4px rgba(14,165,160,0.6)", animation: "glow-pulse 2s ease-in-out infinite" }}
          />

          {/* Blip dots */}
          {[
            { top: "38%", left: "60%", delay: "0s" },
            { top: "58%", left: "44%", delay: "1.4s" },
            { top: "45%", left: "52%", delay: "2.1s" },
          ].map((b, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-teal-300"
              style={{
                top: b.top,
                left: b.left,
                opacity: 0.7,
                boxShadow: "0 0 6px 2px rgba(94,234,212,0.5)",
                animation: `radar-ping 3.6s ease-in-out ${b.delay} infinite`,
              }}
            />
          ))}
        </div>

        {/* Brand — top */}
        <div className="relative z-10 p-10">
          <span
            className="font-syne text-sm font-bold tracking-[0.3em] uppercase"
            style={{ color: "#0EA5A0" }}
          >
            ROBO AI
          </span>
        </div>

        {/* Copy — bottom */}
        <div className="relative z-10 p-10 pb-14">
          <h1
            className="font-syne text-4xl font-bold leading-tight text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            Intelligence<br />Operations<br />Console
          </h1>
          <p
            className="mt-4 text-sm leading-relaxed"
            style={{ color: "rgba(203,213,225,0.55)", fontFamily: "'JetBrains Mono', monospace" }}
          >
            Restricted access system.<br />
            Authorised personnel only.
          </p>

          {/* System status bar */}
          <div
            className="mt-8 flex items-center gap-2 text-xs"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(14,165,160,0.7)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" style={{ animation: "glow-pulse 1.8s ease-in-out infinite" }} />
            SYS ONLINE · AI ENGINE ACTIVE
          </div>
        </div>
      </div>

      {/* ── Right Panel — Login Form ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative"
        style={{ background: "#060d14" }}
      >
        {/* Subtle scanline texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(14,165,160,0.012) 3px, rgba(14,165,160,0.012) 4px)",
          }}
        />

        <div
          className="relative w-full max-w-sm"
          style={{ animation: "login-fadein 0.65s 0.2s cubic-bezier(.22,.68,0,1.2) both" }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <span className="font-syne text-sm font-bold tracking-[0.3em] uppercase" style={{ color: "#0EA5A0" }}>
              ROBO AI AGENCY
            </span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2
              className="font-syne text-2xl font-bold text-white"
              style={{ letterSpacing: "-0.01em" }}
            >
              System Access
            </h2>
            <p
              className="mt-1 text-xs"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(203,213,225,0.45)" }}
            >
              OPERATOR LOGIN · SECURE CHANNEL
            </p>
          </div>

          {/* Supabase unconfigured warning */}
          {!isSupabaseConfigured && (
            <div
              className="mb-5 rounded-lg px-4 py-3 text-xs"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.2)",
                color: "rgba(251,191,36,0.8)",
              }}
            >
              ⚠ NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Auth disabled.
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-xs font-semibold mb-2 tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(203,213,225,0.5)" }}
              >
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 rounded-lg px-4 text-sm text-white outline-none transition-all duration-200"
                placeholder="operator@roboai.agency"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(14,165,160,0.2)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.02em",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(14,165,160,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(14,165,160,0.08)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(14,165,160,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
                disabled={phase === "loading" || phase === "success"}
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(203,213,225,0.5)" }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="text-xs transition"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(14,165,160,0.6)" }}
                >
                  {showPw ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input
                id="password"
                type={showPw ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 rounded-lg px-4 text-sm text-white outline-none transition-all duration-200"
                placeholder="••••••••••••"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(14,165,160,0.2)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: showPw ? "0.02em" : "0.2em",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(14,165,160,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(14,165,160,0.08)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(14,165,160,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
                disabled={phase === "loading" || phase === "success"}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={phase === "loading" || phase === "success" || !isSupabaseConfigured}
              className="w-full h-12 rounded-lg font-bold text-sm tracking-widest uppercase transition-all duration-200 relative overflow-hidden"
              style={{
                background: phase === "success"
                  ? "rgba(14,165,160,0.3)"
                  : phase === "error"
                    ? "rgba(239,68,68,0.15)"
                    : "#0EA5A0",
                color: phase === "success" ? "#0EA5A0" : phase === "error" ? "#ef4444" : "#0D1B2A",
                border: phase === "error" ? "1px solid rgba(239,68,68,0.4)" : "none",
                fontFamily: "'JetBrains Mono', monospace",
                animation: phase === "idle" ? "glow-pulse 3s ease-in-out infinite" : "none",
                cursor: !isSupabaseConfigured ? "not-allowed" : "pointer",
                opacity: !isSupabaseConfigured ? 0.4 : 1,
              }}
            >
              {phase === "loading" && (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner />
                  AUTHENTICATING
                </span>
              )}
              {phase === "success" && "ACCESS GRANTED ✓"}
              {phase === "error" && "RETRY"}
              {phase === "idle" && "AUTHENTICATE"}
            </button>
          </form>

          {/* Terminal status line */}
          <div
            className="mt-5 flex items-center gap-2 text-xs"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: phase === "success" ? "#0EA5A0" : phase === "error" ? "#ef4444" : "rgba(14,165,160,0.5)",
                animation: phase === "loading" ? "glow-pulse 0.8s ease-in-out infinite" : "none",
              }}
            />
            <span
              style={{
                color: phase === "error" ? "rgba(239,68,68,0.8)" : phase === "success" ? "rgba(14,165,160,0.8)" : "rgba(203,213,225,0.35)",
              }}
            >
              {statusMsg}
              {phase === "loading" && <BlinkCursor />}
            </span>
          </div>

          {/* Divider */}
          <div
            className="mt-8 mb-6 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(14,165,160,0.15), transparent)" }}
          />

          {/* Footer links */}
          <div className="flex justify-between text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(203,213,225,0.3)" }}>
            <Link href="/" className="hover:text-teal-400 transition" style={{ color: "inherit" }}>
              ← HOME
            </Link>
            <span style={{ color: "rgba(203,213,225,0.2)" }}>ROBO AI · {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M7 2a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BlinkCursor() {
  return (
    <span
      aria-hidden="true"
      style={{ animation: "blink-cursor 1s step-end infinite", marginLeft: 2 }}
    >
      _
    </span>
  );
}
