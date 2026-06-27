"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type FlowGraph = { nodes: Array<{ id: string; type: string; label: string; order: number; properties: Record<string, unknown> }>; edges: Array<Record<string, unknown>> };
type Agent = { id: string; flow_graph: FlowGraph };

export default function BuilderStep3() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/agents/${agentId}`);
    const a = (await res.json()) as Agent;
    if (res.ok) {
      setAgent(a);
      setJsonText(JSON.stringify(a.flow_graph, null, 2));
    }
  };

  useEffect(() => {
    void load();
  }, [agentId]);

  return (
    <div className="min-h-screen bg-navy px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-white font-syne text-3xl font-bold mb-1">AI Builder</div>
            <div className="text-slateText">Step 3 — Flow builder (text MVP)</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/analysis`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              View analysis
            </button>
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/step2`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/step4`)}
              className="h-11 px-5 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition"
            >
              Continue
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-6">
          <div className="text-white font-semibold mb-3">Nodes</div>
          <div className="space-y-2">
            {(agent?.flow_graph.nodes ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((n) => (
                <div key={n.id} className="rounded-lg border border-navy-600 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-white font-semibold text-sm">{n.label}</div>
                    <div className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">{n.type}</div>
                  </div>
                  <div className="text-slateText text-xs mt-2 whitespace-pre-line">{JSON.stringify(n.properties, null, 2)}</div>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5">
          <div className="text-white font-semibold mb-3">Edit flow_graph JSON</div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full min-h-[260px] rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 text-white font-mono text-xs"
          />
          <div className="flex items-center justify-end gap-3 mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const flow = JSON.parse(jsonText) as unknown;
                  await fetch(`/api/agents/${agentId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ flow_graph: flow }),
                  });
                  await load();
                } catch {
                  void 0;
                } finally {
                  setBusy(false);
                }
              }}
              className="h-10 px-4 rounded-lg bg-white text-navy font-semibold hover:brightness-110 transition"
            >
              Save flow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
