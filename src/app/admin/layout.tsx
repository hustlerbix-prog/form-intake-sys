"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const NAV = [
  { href: "/", label: "Main Site" },
  { href: "/admin/settings", label: "AI Settings" },
  { href: "/admin/payment", label: "Payment" },
];

export default function AdminLayout(props: { children: ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      router.replace("/login");
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }

      setUserEmail(data.session.user.email ?? null);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        setReady(false);
        setUserEmail(null);
        router.replace("/login");
        return;
      }

      setUserEmail(session.user.email ?? null);
      setReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function handleSignOut() {
    if (!supabase) {
      router.replace("/login");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060d14] px-6 text-center text-slate-200">
        <div>
          <p className="font-syne text-2xl font-bold text-white">ROBO AI Admin</p>
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-teal">Validating session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0D1B2A] text-lg">ROBO AI</span>
            <span className="text-slate-300 text-lg">|</span>
            <div>
              <p className="text-sm font-semibold text-slate-500">Admin</p>
              <p className="text-xs text-slate-400">{userEmail ?? "Authenticated user"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              >
                {item.label}
              </Link>
            ))}
            </nav>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto">{props.children}</div>
    </div>
  );
}
