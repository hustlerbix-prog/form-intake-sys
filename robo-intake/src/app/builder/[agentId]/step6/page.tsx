"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PublishRes = { config_hash: string };
type PublishFailure = { code: string; module: string; message: string };
type ExportFormat = "widget" | "api" | "mcp" | "rawcode";

export default function BuilderStep6() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const [agentType, setAgentType] = useState<"chatbot" | "voice" | "agent" | null>(null);
  const [busy, setBusy] = useState(false);
  const [configHash, setConfigHash] = useState<string | null>(null);
  const [exportOut, setExportOut] = useState<Record<string, unknown> | null>(null);
  const [publishFailures, setPublishFailures] = useState<PublishFailure[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/agents/${agentId}`);
      const data = (await res.json().catch(() => null)) as { type?: "chatbot" | "voice" | "agent" } | null;
      if (res.ok && data?.type) setAgentType(data.type);
    };
    void load();
  }, [agentId]);

  const publish = async () => {
    setBusy(true);
    const res = await fetch(`/api/agents/${agentId}/publish`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as PublishRes & { failures?: PublishFailure[] };
    if (res.ok) {
      setConfigHash(data.config_hash);
      setPublishFailures(null);
    } else if (res.status === 422) {
      setPublishFailures(data.failures ?? [{ code: "publish/failed", module: "publish", message: "Publish validation failed." }]);
    }
    setBusy(false);
  };

  const doExport = async (format: ExportFormat) => {
    setBusy(true);
    const body: Record<string, unknown> =
      format === "widget"
        ? { primaryColor: "#0EA5A0", position: "bottom-right" }
        : {};
    const res = await fetch(`/api/agents/${agentId}/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { version?: number; artefact?: Record<string, unknown>; error?: string };
    if (res.ok) setExportOut({ format, version: data.version, ...data.artefact });
    else setExportOut({ format, error: data.error ?? "export failed" });
    setBusy(false);
  };

  const getProvisioningPlan = async () => {
    setBusy(true);
    const res = await fetch(`/api/agents/${agentId}/voice/provision`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    setExportOut(res.ok ? data : { error: "provisioning plan failed" });
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-navy px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-white font-syne text-3xl font-bold mb-1">AI Builder</div>
            <div className="text-slateText">Step 6 — Export</div>
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
              onClick={() => router.push(`/builder/${agentId}/step5`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              Back
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-white font-semibold">Publish snapshot</div>
              <div className="text-slateText text-sm">
                Test harness uses draft. Exports use the last published snapshot.
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void publish()}
              className="h-11 px-5 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition"
            >
              Publish
            </button>
          </div>
          {configHash ? <div className="mt-3 text-xs text-slateText">Published hash: {configHash}</div> : null}
          {publishFailures?.length ? (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <div className="text-red-200 text-sm font-semibold mb-2">Publish blocked</div>
              <div className="text-red-200/90 text-xs whitespace-pre-line">
                {publishFailures.map((f) => `• [${f.module}] ${f.message} (${f.code})`).join("\n")}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-6">
          <div className="text-white font-semibold mb-3">Export formats</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              { key: "widget", label: "Widget embed" },
              { key: "api", label: "REST API" },
              { key: "mcp", label: "MCP" },
              { key: "rawcode", label: "Raw code (JSON)" },
            ] as const).map((b) => (
              <button
                key={b.key}
                type="button"
                disabled={busy}
                onClick={() => void doExport(b.key)}
                className="h-11 rounded-lg bg-white text-navy font-bold hover:brightness-110 transition"
              >
                {b.label}
              </button>
            ))}
            {agentType === "voice" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void getProvisioningPlan()}
                className="h-11 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition"
              >
                Voice provisioning plan
              </button>
            ) : null}
          </div>
          <div className="text-slateText text-xs mt-3">Exports require Publish first.</div>
        </div>

        {exportOut ? (
          <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5">
            <div className="text-white font-semibold mb-3">Export output</div>
            <pre className="text-xs text-slateText whitespace-pre-wrap">{JSON.stringify(exportOut, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
