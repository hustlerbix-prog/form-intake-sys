"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type KbSource = {
  id: string;
  name: string;
  type: string;
  status: "queued" | "processing" | "indexed" | "failed" | "error";
  chunk_count: number;
  failure_type?: string | null;
  error_message: string | null;
  created_at: string;
};

type Agent = { id: string; profile_id: string };

export default function BuilderStep2() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const [sources, setSources] = useState<KbSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [devSeedStatus, setDevSeedStatus] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [noteName, setNoteName] = useState("Notes");
  const [noteText, setNoteText] = useState("");

  const toErrorMessage = (err: unknown): string => {
    if (!err) return "Request failed";
    if (typeof err === "string") return err;
    if (typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    return "Request failed";
  };

  const refresh = async () => {
    const res = await fetch(`/api/agents/${agentId}/kb/sources`);
    const data = (await res.json()) as { sources: KbSource[] };
    if (res.ok) setSources(data.sources ?? []);
  };

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (!agent) {
        const aRes = await fetch(`/api/agents/${agentId}`).catch(() => null);
        if (aRes && aRes.ok) {
          const a = (await aRes.json()) as Agent;
          if (mounted) setAgent(a);
        }
      }
      await refresh();
      if (!mounted) return;
      setTimeout(poll, 5000);
    };
    poll();
    return () => {
      mounted = false;
    };
  }, [agentId, agent]);

  const hasIndexed = useMemo(() => sources.some((s) => s.status === "indexed"), [sources]);
  const isDev = Boolean(agent?.profile_id?.startsWith("dev_"));

  return (
    <div className="min-h-screen bg-navy px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-white font-syne text-3xl font-bold mb-1">AI Builder</div>
            <div className="text-slateText">Step 2 — Knowledge base</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/step1`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!hasIndexed}
              onClick={() => router.push(`/builder/${agentId}/step3`)}
              className={
                "h-11 px-5 rounded-lg font-bold transition " +
                (hasIndexed ? "bg-teal text-navy hover:brightness-110" : "bg-navy-800 text-slateText cursor-not-allowed")
              }
            >
              Continue
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-6">
          <div className="text-white font-semibold mb-3">Sources</div>
          <div className="space-y-2">
            {sources.length ? (
              sources.map((s) => (
                <div key={s.id} className="rounded-lg border border-navy-600 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-white font-semibold text-sm">{s.name}</div>
                    <div
                      className={
                        "text-xs px-2 py-0.5 rounded-full " +
                        (s.status === "indexed"
                          ? "bg-teal/20 text-teal"
                          : s.status === "error"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-white/10 text-white/60")
                      }
                    >
                      {s.status}
                    </div>
                  </div>
                  <div className="text-slateText text-xs mt-1">type: {s.type} · chunks: {s.chunk_count}</div>
                  {s.status === "failed" && s.failure_type ? <div className="text-red-300 text-xs mt-2">failure: {s.failure_type}</div> : null}
                  {s.error_message ? <div className="text-red-300 text-xs mt-2">{s.error_message}</div> : null}
                </div>
              ))
            ) : (
              <div className="text-slateText text-sm">No sources yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-6">
          <div className="text-white font-semibold mb-3">Import from intake</div>
          <div className="text-slateText text-sm mb-4">Loads the generated JSON (intake + scrape + report) and re-indexes it into this agent’s knowledge base.</div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={busy || !agent?.profile_id}
              onClick={async () => {
                if (!agent?.profile_id) return;
                setBusy(true);
                setImportError(null);
                try {
                  const res = await fetch(`/api/download/json?profile_id=${encodeURIComponent(agent.profile_id)}`);
                  if (!res.ok) {
                    const d = (await res.json().catch(() => ({}))) as { error?: string };
                    setImportError(d.error ?? "Failed to download JSON");
                    setBusy(false);
                    return;
                  }
                  const text = await res.text();
                  const addRes = await fetch(`/api/agents/${agentId}/kb/text`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Imported Submission JSON", text }),
                  }).catch(() => null);
                  if (!addRes) setImportError("Failed to import into KB");
                  else if (!addRes.ok) {
                    const d = (await addRes.json().catch(() => ({}))) as { error?: unknown };
                    setImportError(toErrorMessage(d.error));
                  }
                  await refresh();
                } catch (e: unknown) {
                  setImportError(e instanceof Error ? e.message : "Import failed");
                } finally {
                  setBusy(false);
                }
              }}
              className="h-11 px-5 rounded-lg bg-white text-navy font-bold hover:brightness-110 transition disabled:opacity-50"
            >
              Import submission JSON
            </button>
            {isDev ? (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setDevSeedStatus(null);
                  const res = await fetch(`/api/agents/${agentId}/kb/dev-seed`, { method: "POST" }).catch(() => null);
                  const data = (res ? ((await res.json().catch(() => ({}))) as { loaded?: string[]; skipped?: string[]; error?: string }) : null) ?? null;
                  if (!res || !res.ok) setDevSeedStatus(data?.error ?? "Failed to load docs");
                  else setDevSeedStatus(`Loaded: ${(data?.loaded ?? []).join(", ") || "none"} · Skipped: ${(data?.skipped ?? []).join(", ") || "none"}`);
                  await refresh();
                  setBusy(false);
                }}
                className="h-11 px-5 rounded-lg bg-white text-navy font-bold hover:brightness-110 transition disabled:opacity-50"
              >
                Load docs (dev)
              </button>
            ) : null}
          </div>
          {importError ? <div className="text-red-300 text-xs mt-2">{importError}</div> : null}
          {devSeedStatus ? <div className="text-slateText text-xs mt-2">{devSeedStatus}</div> : null}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5">
            <div className="text-white font-semibold mb-3">Upload file</div>
            <input
              type="file"
              accept=".txt,.md,.json"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setUploadError(null);
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch(`/api/agents/${agentId}/kb/upload`, { method: "POST", body: formData }).catch(() => null);
                if (!res || !res.ok) {
                  const data = (res ? ((await res.json().catch(() => ({}))) as { error?: unknown }) : null) ?? null;
                  setUploadError(toErrorMessage(data?.error) ?? "Upload failed");
                }
                await refresh();
                setBusy(false);
                e.target.value = "";
              }}
              className="block w-full text-sm text-slateText file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-navy file:font-semibold hover:file:brightness-110"
            />
            <div className="text-slateText text-xs mt-3">Max size 10MB. Supported: .txt, .md, .json</div>
            {uploadError ? <div className="text-red-300 text-xs mt-2">{uploadError}</div> : null}
          </div>

          <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5">
            <div className="text-white font-semibold mb-3">Add notes</div>
            <input
              value={noteName}
              onChange={(e) => setNoteName(e.target.value)}
              disabled={busy}
              className="w-full h-10 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white mb-3"
              placeholder="Source name"
            />
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              disabled={busy}
              className="w-full min-h-[120px] rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 text-white"
              placeholder="Paste business details, policies, FAQs, pricing notes…"
            />
            <button
              type="button"
              disabled={busy || !noteText.trim()}
              onClick={async () => {
                setBusy(true);
                const res = await fetch(`/api/agents/${agentId}/kb/text`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: noteName.trim() || "Notes", text: noteText }),
                }).catch(() => {});
                if (!res) setUploadError("Failed to add note to KB");
                else if (!res.ok) {
                  const d = (await res.json().catch(() => ({}))) as { error?: unknown };
                  setUploadError(toErrorMessage(d.error));
                }
                setNoteText("");
                await refresh();
                setBusy(false);
              }}
              className={
                "mt-3 h-10 px-4 rounded-lg font-semibold transition " +
                (noteText.trim() ? "bg-teal text-navy hover:brightness-110" : "bg-navy-800 text-slateText cursor-not-allowed")
              }
            >
              Add to KB
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
