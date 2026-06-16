"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Agent = {
  id: string;
  profile_id: string;
  template_id: string;
  type: "chatbot" | "voice" | "agent";
  config: { name: string };
};

type Report = {
  recommended_products: Array<{ product_id: string; product_name: string; tier: "primary" | "upsell"; priority_rank: number }>;
};

const TEMPLATES = [
  { id: "TPL-01", name: "AI Chatbot", product: "CB-01", icon: "💬", description: "Web chat · FAQs, lead capture, escalation" },
  { id: "TPL-02", name: "VS-01 Voice Secretary", product: "AVA-01", icon: "📞", description: "Inbound calls · FAQ · booking · escalation" },
  { id: "TPL-05", name: "VS-02 Leads Hunter", product: "AVA-01", icon: "📣", description: "Outbound campaigns · lead scoring · follow-up" },
  { id: "TPL-07", name: "VS-03 IVR Routing", product: "AVA-01", icon: "☎️", description: "Intent routing · DTMF · call forwarding" },
  { id: "TPL-03", name: "AI Agent", product: "CA-01", icon: "🤖", description: "Internal ops · reporting · decision support" },
  { id: "TPL-06", name: "Custom Agent", product: "Blank", icon: "⚡", description: "Full control · no defaults" },
] as const;

export default function BuilderStep1() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch(`/api/agents/${agentId}`);
      const a = (await res.json()) as Agent;
      if (!mounted) return;
      if (!res.ok) return;
      setAgent(a);
      const ps = await fetch(`/api/pipeline-status?profile_id=${a.profile_id}`);
      const pd = (await ps.json()) as { report: Report | null };
      if (!mounted) return;
      setReport(pd.report ?? null);
    })().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [agentId]);

  const recommended = useMemo(() => new Set((report?.recommended_products ?? []).map((p) => p.product_id)), [report]);

  return (
    <div className="min-h-screen bg-navy px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-white font-syne text-3xl font-bold mb-2">AI Builder</div>
            <div className="text-slateText">Step 1 — Choose a template</div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              router.push(
                agent?.profile_id ? `/builder/start?profile_id=${encodeURIComponent(agent.profile_id)}` : "/builder/start"
              )
            }
            className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition disabled:opacity-50"
          >
            Back
          </button>
        </div>

        {report?.recommended_products?.length ? (
          <div className="mb-8 rounded-xl border border-navy-600 bg-navy-900/40 p-5">
            <div className="text-white font-semibold mb-2">Recommended from your diagnosis</div>
            <div className="text-slateText text-sm whitespace-pre-line">
              {(report.recommended_products ?? [])
                .slice()
                .sort((a, b) => a.priority_rank - b.priority_rank)
                .map((p) => `• ${p.product_name} (${p.product_id}) — ${p.tier}`)
                .join("\n")}
            </div>
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-4">
          {TEMPLATES.map((t) => {
            const isRecommended = recommended.has(t.product);
            return (
              <button
                key={t.id}
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!agent) return;
                  setBusy(true);
                  await fetch(`/api/agents/${agentId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ template_id: t.id, config: { name: t.name } }),
                  }).catch(() => {});
                  router.push(`/builder/${agentId}/step2`);
                }}
                className={
                  "text-left rounded-xl border p-5 transition " +
                  (isRecommended ? "border-teal bg-teal/10" : "border-navy-600 bg-navy-900/40 hover:bg-navy-900/60")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span>{t.name}</span>
                  </div>
                  {isRecommended ? <span className="text-xs text-teal border border-teal/50 px-2 py-0.5 rounded-full">Recommended</span> : null}
                </div>
                <div className="text-slateText text-sm mt-2">{t.description}</div>
                <div className="text-slateText text-xs mt-3">Product: {t.product}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
