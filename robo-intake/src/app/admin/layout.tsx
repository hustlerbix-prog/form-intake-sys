import type { ReactNode } from "react";
import Link from "next/link";

const NAV = [
  { href: "/admin/settings", label: "AI Settings" },
  { href: "/admin/payment", label: "Payment" },
];

export default function AdminLayout(props: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0D1B2A] text-lg">ROBO AI</span>
            <span className="text-slate-300 text-lg">|</span>
            <span className="text-sm font-semibold text-slate-500">Admin</span>
          </div>
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
        </div>
      </header>
      <div className="max-w-5xl mx-auto">{props.children}</div>
    </div>
  );
}
