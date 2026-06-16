"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RetellWebClient } from "retell-client-js-sdk";

type ProviderReadiness = { provider: string; status: string; summary: string; env_keys: string[] };
type DeploymentPlan = {
  product: { service_name: string; service_sku: string; call_mode: string };
  provisioning: { ready: boolean; next_step: string; missing_providers: string[] };
};
type TranscriptTurn = { speaker: "caller" | "assistant"; text: string };
type ChatMsg = { role: "user" | "assistant"; content: string };

type VoiceConfig = {
  service_sku: "none" | "vs-01" | "vs-02" | "vs-03";
  call_mode: "none" | "inbound" | "outbound" | "ivr";
  twilio_phone_number: string;
  retell_model: string;
  retell_voice: string;
  retell_agent_id: string;
  retell_llm_id: string;
  retell_last_synced_at: string;
  branded_caller_id: boolean;
  voicemail_detection: boolean;
  dtmf_capture: boolean;
  booking_enabled: boolean;
  booking_provider: "none" | "cal.com" | "google_calendar";
  booking_url: string;
  transfer_number: string;
  crm_provider: "none" | "hubspot" | "salesforce" | "csv";
  notion_sync: boolean;
  knowledge_sync_target: "none" | "retell+pgvector" | "pgvector";
};

type IntegrationConfig = {
  modal_enabled: boolean;
  stripe_provisioning: boolean;
  resend_digest: boolean;
  supabase_logging: boolean;
};

type AgentConfig = {
  name: string;
  language: "en" | "es" | "bilingual";
  tone: "professional" | "friendly" | "formal" | "casual" | "empathetic";
  fallback: "escalate" | "apologise" | "redirect";
  system_prompt: string;
  rag_active: boolean;
  lead_capture: boolean;
  human_escalation: boolean;
  conversation_memory: boolean;
  bilingual_detect: boolean;
  model: string;
  max_tokens: number;
  temperature: number;
  voice: VoiceConfig;
  integrations: IntegrationConfig;
};

type FlowNode = {
  id: string;
  type: "start" | "message" | "listen" | "intent_router" | "rag_lookup" | "condition" | "tool_call" | "escalate" | "end";
  label: string;
  order: number;
  properties: Record<string, unknown>;
};

type FlowGraph = {
  nodes: FlowNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
};

type Agent = {
  id: string;
  profile_id?: string;
  type: "chatbot" | "voice" | "agent";
  config: AgentConfig;
  flow_graph: FlowGraph;
};

type KbSource = {
  id: string;
  name: string;
  type: string;
  status: "queued" | "processing" | "indexed" | "failed" | "error";
  chunk_count: number;
  error_message: string | null;
};

type ChatRes = {
  content: string;
  rag_chunks: Array<{ content: string; source: string }>;
  latency_ms: number;
  provider: string;
  model: string;
  llm_provider?: string;
  llm_model?: string;
  backup_model?: string | null;
  backup_used?: boolean;
  transcript?: TranscriptTurn[];
  deployment_plan?: DeploymentPlan;
};

type TestResultMeta = {
  latency_ms: number;
  provider: string;
  model: string;
  llm_provider?: string;
  llm_model?: string;
  backup_model?: string | null;
  backup_used?: boolean;
};

type SavedVoiceTest = {
  id: string;
  agent_id: string;
  created_at: string;
  mode: "audio" | "llm";
  prompt: string;
  call_id: string | null;
  transcript: TranscriptTurn[];
  summary: string | null;
  recording_url: string | null;
  rag_chunks: Array<{ content: string; source: string }>;
  metadata: TestResultMeta;
};

type RetellWebCallResponse = {
  provider: string;
  call_id: string;
  access_token: string;
  call_status: string;
  retell_agent_id: string;
  retell_llm_id: string;
  model: string;
  voice_id: string;
  synced_at: string;
  error?: string;
};

type RetellCallDetails = {
  call_status?: string;
  transcript?: string;
  transcript_object?: Array<{ role: string; content: string }>;
  recording_url?: string;
  call_analysis?: { call_summary?: string };
  latency?: { e2e?: { p50?: number } };
};

type AudioCallState = {
  active: boolean;
  connecting: boolean;
  ready: boolean;
  muted: boolean;
  callId: string;
  retellAgentId: string;
  status: string;
  error: string | null;
  syncedAt: string;
  voiceId: string;
  agentTalking: boolean;
  audioLevel: number;
  summary: string | null;
  recordingUrl: string | null;
};

type VoiceFunctionDraft = {
  id: string;
  label: string;
  description: string;
  trigger: string;
  enabled: boolean;
};

function extractVoiceFunctions(flow: FlowGraph | undefined): VoiceFunctionDraft[] {
  return (flow?.nodes ?? [])
    .filter((node) => node.type === "tool_call")
    .sort((a, b) => a.order - b.order)
    .map((node) => ({
      id: node.id,
      label: node.label,
      description: String(node.properties.description ?? ""),
      trigger: String(node.properties.trigger ?? ""),
      enabled: node.properties.enabled !== false,
    }));
}

function withVoiceFunctions(flow: FlowGraph, functions: VoiceFunctionDraft[]): FlowGraph {
  const baseNodes = flow.nodes.filter((node) => node.type !== "tool_call");
  const maxOrder = baseNodes.reduce((acc, node) => Math.max(acc, node.order), 0);
  const toolNodes: FlowNode[] = functions.map((fn, index) => ({
    id: fn.id,
    type: "tool_call",
    label: fn.label.trim() || `Function ${index + 1}`,
    order: maxOrder + index + 1,
    properties: {
      description: fn.description.trim(),
      trigger: fn.trigger.trim(),
      enabled: fn.enabled,
    },
  }));
  return {
    ...flow,
    nodes: [...baseNodes, ...toolNodes].sort((a, b) => a.order - b.order),
  };
}

function createVoiceFunctionDraft(index: number): VoiceFunctionDraft {
  return {
    id: `tool-${Date.now()}-${index}`,
    label: `Function ${index + 1}`,
    description: "",
    trigger: "",
    enabled: true,
  };
}

function VoiceBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-teal">{children}</span>;
}

function transcriptFromString(transcript: string): TranscriptTurn[] {
  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^(agent|assistant):/i.test(line)) {
        return { speaker: "assistant" as const, text: line.replace(/^(agent|assistant):/i, "").trim() };
      }
      if (/^(user|caller|customer):/i.test(line)) {
        return { speaker: "caller" as const, text: line.replace(/^(user|caller|customer):/i, "").trim() };
      }
      return { speaker: "assistant" as const, text: line };
    });
}

function transcriptFromObject(transcript: RetellCallDetails["transcript_object"]): TranscriptTurn[] {
  return (transcript ?? []).map((turn) => ({
    speaker: turn.role === "agent" ? "assistant" : "caller",
    text: turn.content,
  }));
}

function transcriptAsText(transcript: TranscriptTurn[]): string {
  return transcript.map((turn) => `${turn.speaker === "assistant" ? "Assistant" : "Caller"}: ${turn.text}`).join("\n\n");
}

function fileSafeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function BuilderStep5() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const retellClientRef = useRef<RetellWebClient | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Test mode is active. Ask a question to see how the agent responds with your current draft config + KB." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saveResultState, setSaveResultState] = useState<string | null>(null);
  const [scenarioInput, setScenarioInput] = useState("Hello");
  const [testMode, setTestMode] = useState<"audio" | "llm">("audio");
  const [lastMeta, setLastMeta] = useState<TestResultMeta | null>(null);
  const [lastRag, setLastRag] = useState<Array<{ content: string; source: string }>>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [savedTests, setSavedTests] = useState<SavedVoiceTest[]>([]);
  const [providerReadiness, setProviderReadiness] = useState<ProviderReadiness[]>([]);
  const [deploymentPlan, setDeploymentPlan] = useState<DeploymentPlan | null>(null);
  const [voiceFunctions, setVoiceFunctions] = useState<VoiceFunctionDraft[]>([]);
  const [kbSources, setKbSources] = useState<KbSource[]>([]);
  const [kbBusy, setKbBusy] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const [audioCall, setAudioCall] = useState<AudioCallState>({
    active: false,
    connecting: false,
    ready: false,
    muted: false,
    callId: "",
    retellAgentId: "",
    status: "idle",
    error: null,
    syncedAt: "",
    voiceId: "",
    agentTalking: false,
    audioLevel: 0,
    summary: null,
    recordingUrl: null,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [agentRes, integrationsRes, kbRes, testsRes] = await Promise.all([
        fetch(`/api/agents/${agentId}`),
        fetch(`/api/agents/${agentId}/integrations`),
        fetch(`/api/agents/${agentId}/kb/sources`),
        fetch(`/api/agents/${agentId}/tests`),
      ]);
      const agentData = (await agentRes.json().catch(() => null)) as Agent | null;
      const integrationsData = (await integrationsRes.json().catch(() => null)) as
        | { provider_readiness?: ProviderReadiness[]; deployment_plan?: DeploymentPlan | null }
        | null;
      const kbData = (await kbRes.json().catch(() => null)) as { sources?: KbSource[] } | null;
      const testsData = (await testsRes.json().catch(() => null)) as { items?: SavedVoiceTest[] } | null;
      if (!mounted) return;
      if (agentRes.ok && agentData) {
        setAgent(agentData);
        setVoiceFunctions(extractVoiceFunctions(agentData.flow_graph));
      }
      if (integrationsRes.ok && integrationsData) {
        setProviderReadiness(integrationsData.provider_readiness ?? []);
        setDeploymentPlan(integrationsData.deployment_plan ?? null);
      }
      if (kbRes.ok && kbData) {
        setKbSources(kbData.sources ?? []);
      }
      if (testsRes.ok && testsData) {
        setSavedTests(testsData.items ?? []);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [agentId]);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);
  const canRunVoiceTest = useMemo(() => scenarioInput.trim().length > 0 && !busy, [scenarioInput, busy]);
  const missingProviders = useMemo(
    () => providerReadiness.filter((item) => item.status === "missing_env").map((item) => item.provider),
    [providerReadiness]
  );
  const hasTranscript = transcript.length > 0;
  const intakeAnalysisSource = useMemo(
    () => kbSources.find((source) => source.type === "text" && /submission json|intake|report|analysis/i.test(source.name)),
    [kbSources]
  );

  const refreshKbSources = async () => {
    const res = await fetch(`/api/agents/${agentId}/kb/sources`);
    const data = (await res.json().catch(() => null)) as { sources?: KbSource[] } | null;
    if (res.ok && data) setKbSources(data.sources ?? []);
  };

  const refreshSavedTests = async () => {
    setHistoryError(null);
    const res = await fetch(`/api/agents/${agentId}/tests`);
    const data = (await res.json().catch(() => null)) as { items?: SavedVoiceTest[]; error?: string } | null;
    if (!res.ok || !data) {
      setHistoryError(data?.error ?? "Failed to load test history.");
      return;
    }
    setSavedTests(data.items ?? []);
  };

  const currentTestResult = (override?: Partial<SavedVoiceTest>): Omit<SavedVoiceTest, "id" | "agent_id" | "created_at"> | null => {
    if (!agent || !lastMeta || !transcript.length) return null;
    return {
      mode: override?.mode ?? testMode,
      prompt: override?.prompt ?? scenarioInput.trim() ?? "",
      call_id: override?.call_id ?? (audioCall.callId || null),
      transcript: override?.transcript ?? transcript,
      summary: override?.summary ?? audioCall.summary ?? null,
      recording_url: override?.recording_url ?? audioCall.recordingUrl ?? null,
      rag_chunks: override?.rag_chunks ?? lastRag,
      metadata: override?.metadata ?? lastMeta,
    };
  };

  const triggerBrowserDownload = (fileName: string, body: string, type: string) => {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportTestResult = (format: "txt" | "json", result?: Partial<SavedVoiceTest>) => {
    const resolved = result ? currentTestResult(result) : currentTestResult();
    if (!resolved || !agent) return;
    const safeName = fileSafeName(agent.config.name || "voice-agent") || "voice-agent";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${safeName}-test-result-${timestamp}.${format}`;
    const payload = {
      agent_id: agent.id,
      agent_name: agent.config.name,
      generated_at: new Date().toISOString(),
      ...resolved,
    };
    const body =
      format === "json"
        ? JSON.stringify(payload, null, 2)
        : [
            `Agent: ${agent.config.name}`,
            `Mode: ${resolved.mode}`,
            `Prompt: ${resolved.prompt || "-"}`,
            `Call ID: ${resolved.call_id || "-"}`,
            `Provider: ${resolved.metadata.provider}`,
            `Model: ${resolved.metadata.model}`,
            `Latency: ${resolved.metadata.latency_ms}ms`,
            resolved.summary ? `Summary:\n${resolved.summary}` : "",
            "Transcript:",
            transcriptAsText(resolved.transcript),
          ]
            .filter(Boolean)
            .join("\n\n");
    triggerBrowserDownload(
      fileName,
      body,
      format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8"
    );
  };

  const downloadTranscript = (format: "txt" | "json") => {
    if (!transcript.length || !agent) return;
    const safeName = fileSafeName(agent.config.name || "voice-agent");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${safeName || "voice-agent"}-transcript-${timestamp}.${format}`;
    const body =
      format === "json"
        ? JSON.stringify(
            {
              agent_id: agent?.id ?? agentId,
              agent_name: agent?.config.name ?? "Voice agent",
              call_id: audioCall.callId || null,
              mode: testMode,
              generated_at: new Date().toISOString(),
              transcript,
            },
            null,
            2
          )
        : transcriptAsText(transcript);
    triggerBrowserDownload(
      filename,
      body,
      format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8"
    );
  };

  const saveTestResult = async (input: {
    mode: "audio" | "llm";
    prompt: string;
    transcript: TranscriptTurn[];
    summary?: string | null;
    call_id?: string | null;
    recording_url?: string | null;
    rag_chunks?: Array<{ content: string; source: string }>;
    metadata: TestResultMeta;
  }) => {
    if (!agent || !input.transcript.length) return;
    setHistoryBusy(true);
    setSaveResultState(null);
    const res = await fetch(`/api/agents/${agentId}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: input.mode,
        prompt: input.prompt,
        call_id: input.call_id ?? null,
        transcript: input.transcript,
        summary: input.summary ?? null,
        recording_url: input.recording_url ?? null,
        rag_chunks: input.rag_chunks ?? [],
        metadata: input.metadata,
      }),
    });
    const data = (await res.json().catch(() => null)) as SavedVoiceTest | { error?: string } | null;
    if (!res.ok || !data || "error" in data) {
      const errData = data as { error?: string } | null;
      setHistoryError(errData?.error || "Failed to save test result.");
      setHistoryBusy(false);
      return;
    }
    const saved = data as SavedVoiceTest;
    setSavedTests((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 20));
    setSaveResultState("Saved to agent history.");
    setHistoryBusy(false);
  };

  const refreshRetellCallDetails = async (callId: string) => {
    const res = await fetch(`/api/agents/${agentId}/voice/calls/${callId}`);
    const data = (await res.json().catch(() => null)) as RetellCallDetails | null;
    if (!res.ok || !data) return;
    const finalTranscript = data.transcript_object?.length
      ? transcriptFromObject(data.transcript_object)
      : data.transcript
        ? transcriptFromString(data.transcript)
        : [];
    if (finalTranscript.length) setTranscript(finalTranscript);
    setAudioCall((current) => ({
      ...current,
      status: data.call_status ?? current.status,
      summary: data.call_analysis?.call_summary ?? current.summary,
      recordingUrl: data.recording_url ?? current.recordingUrl,
    }));
    setLastMeta((current) =>
      current
        ? {
            ...current,
            latency_ms: data.latency?.e2e?.p50 ?? current.latency_ms,
          }
        : current
    );
    const resolvedMeta: TestResultMeta = {
      latency_ms: data.latency?.e2e?.p50 ?? lastMeta?.latency_ms ?? 0,
      provider: lastMeta?.provider ?? "retell",
      model: lastMeta?.model ?? agent?.config.voice.retell_model ?? "",
      llm_provider: lastMeta?.llm_provider,
      llm_model: lastMeta?.llm_model,
      backup_model: lastMeta?.backup_model ?? null,
      backup_used: lastMeta?.backup_used ?? false,
    };
    if (finalTranscript.length) {
      await saveTestResult({
        mode: "audio",
        prompt: scenarioInput.trim(),
        transcript: finalTranscript,
        summary: data.call_analysis?.call_summary ?? audioCall.summary ?? null,
        call_id: callId,
        recording_url: data.recording_url ?? audioCall.recordingUrl ?? null,
        rag_chunks: lastRag,
        metadata: resolvedMeta,
      });
    }
  };

  const stopAudioCall = async () => {
    retellClientRef.current?.stopCall();
    retellClientRef.current = null;
    setAudioCall((current) => ({
      ...current,
      active: false,
      connecting: false,
      ready: false,
      muted: false,
      agentTalking: false,
      audioLevel: 0,
      status: current.callId ? "ended" : "idle",
    }));
  };

  const patchAgent = async (payload: { config?: Partial<AgentConfig>; flow_graph?: FlowGraph }) => {
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as Agent | { error?: string };
    if (res.ok) {
      const next = data as Agent;
      setAgent(next);
      setVoiceFunctions(extractVoiceFunctions(next.flow_graph));
    } else {
      setSaveError(("error" in data && data.error) || "Failed to save configuration");
    }
    setSaving(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    const next = [...messages, { role: "user", content: text }] as ChatMsg[];
    setMessages(next);
    const endpoint = agent?.type === "voice" ? `/api/agents/${agentId}/voice/test-call` : `/api/agents/${agentId}/chat`;
    const payload = agent?.type === "voice" ? { prompt: text } : { messages: next };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<ChatRes> & { error?: string };
    const assistantText = res.ok ? String(data.content ?? "") : String(data.error ?? "Request failed");
    setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
    setLastRag((data.rag_chunks ?? []) as Array<{ content: string; source: string }>);
    setLastMeta({
      latency_ms: data.latency_ms ?? 0,
      provider: data.provider ?? "",
      model: data.model ?? "",
      llm_provider: data.llm_provider,
      llm_model: data.llm_model,
      backup_model: data.backup_model ?? null,
      backup_used: data.backup_used ?? false,
    });
    setTranscript(data.transcript ?? []);
    if (data.deployment_plan) setDeploymentPlan(data.deployment_plan);
    setBusy(false);
  };

  const runVoiceTest = async (overridePrompt?: string) => {
    if (!agent || agent.type !== "voice" || busy) return;
    const prompt = (overridePrompt ?? scenarioInput).trim();
    if (!prompt) return;
    setBusy(true);
    const res = await fetch(`/api/agents/${agentId}/voice/test-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<ChatRes> & { error?: string };
    const assistantText = res.ok ? String(data.content ?? "") : String(data.error ?? "Request failed");
    const transcriptResult = res.ok
      ? (data.transcript ?? [])
      : [
          { speaker: "caller" as const, text: prompt },
          { speaker: "assistant" as const, text: assistantText },
        ];
    const meta: TestResultMeta = {
      latency_ms: data.latency_ms ?? 0,
      provider: data.provider ?? "retell",
      model: data.model ?? "",
      llm_provider: data.llm_provider,
      llm_model: data.llm_model,
      backup_model: data.backup_model ?? null,
      backup_used: data.backup_used ?? false,
    };
    setTranscript(
      transcriptResult
    );
    setLastRag((data.rag_chunks ?? []) as Array<{ content: string; source: string }>);
    setLastMeta(meta);
    if (data.deployment_plan) setDeploymentPlan(data.deployment_plan);
    await saveTestResult({
      mode: "llm",
      prompt,
      transcript: transcriptResult,
      summary: null,
      call_id: null,
      recording_url: null,
      rag_chunks: (data.rag_chunks ?? []) as Array<{ content: string; source: string }>,
      metadata: meta,
    });
    setBusy(false);
  };

  const startAudioCall = async (overrideScenario?: string) => {
    if (!agent || agent.type !== "voice" || busy || audioCall.active || audioCall.connecting) return;
    setBusy(true);
    setAudioCall((current) => ({
      ...current,
      active: false,
      connecting: true,
      ready: false,
      muted: false,
      error: null,
      status: "provisioning",
      summary: null,
      recordingUrl: null,
      audioLevel: 0,
    }));

    const scenario = (overrideScenario ?? scenarioInput).trim();
    const res = await fetch(`/api/agents/${agentId}/voice/web-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: "Test caller",
        scenario,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<RetellWebCallResponse>;
    if (!res.ok || !data.access_token || !data.call_id) {
      setAudioCall((current) => ({
        ...current,
        active: false,
        connecting: false,
        ready: false,
        error: String(data.error ?? "Failed to initialize the Retell audio call."),
        status: "error",
      }));
      setBusy(false);
      return;
    }

    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
      retellClientRef.current = null;
    }

    const client = new RetellWebClient();
    retellClientRef.current = client;

    client.on("call_started", () => {
      setAudioCall((current) => ({
        ...current,
        active: true,
        connecting: true,
        status: "connecting",
      }));
    });
    client.on("call_ready", () => {
      setAudioCall((current) => ({
        ...current,
        ready: true,
        connecting: false,
        status: "connected",
      }));
    });
    client.on("agent_start_talking", () => {
      setAudioCall((current) => ({ ...current, agentTalking: true }));
    });
    client.on("agent_stop_talking", () => {
      setAudioCall((current) => ({ ...current, agentTalking: false, audioLevel: 0 }));
    });
    client.on("audio", (samples: Float32Array) => {
      let peak = 0;
      for (let index = 0; index < samples.length; index += 1) {
        peak = Math.max(peak, Math.abs(samples[index] ?? 0));
      }
      setAudioCall((current) => ({ ...current, audioLevel: Math.min(1, peak * 3) }));
    });
    client.on("update", (event: { transcript?: string }) => {
      if (!event.transcript) return;
      setTranscript(transcriptFromString(event.transcript));
    });
    client.on("metadata", (event: { call_id?: string }) => {
      if (!event.call_id) return;
      setAudioCall((current) => ({ ...current, callId: event.call_id ?? current.callId }));
    });
    client.on("call_ended", () => {
      const endedCallId = data.call_id;
      setAudioCall((current) => ({
        ...current,
        active: false,
        connecting: false,
        ready: false,
        muted: false,
        agentTalking: false,
        audioLevel: 0,
        status: "ended",
      }));
      if (endedCallId) {
        void refreshRetellCallDetails(endedCallId);
      }
      retellClientRef.current = null;
    });
    client.on("error", (message: string) => {
      setAudioCall((current) => ({
        ...current,
        active: false,
        connecting: false,
        ready: false,
        agentTalking: false,
        audioLevel: 0,
        error: message || "Retell audio call failed.",
        status: "error",
      }));
      retellClientRef.current = null;
    });

    try {
      await client.startCall({
        accessToken: data.access_token,
        sampleRate: 24000,
        emitRawAudioSamples: true,
      });
      await client.startAudioPlayback().catch(() => undefined);
      setAudioCall((current) => ({
        ...current,
        active: true,
        connecting: true,
        callId: data.call_id ?? "",
        retellAgentId: data.retell_agent_id ?? "",
        syncedAt: data.synced_at ?? "",
        voiceId: data.voice_id ?? "",
        status: data.call_status ?? "registered",
      }));
      setLastMeta({
        latency_ms: 0,
        provider: "retell",
        model: data.model ?? agent.config.voice.retell_model,
        backup_model: null,
        backup_used: false,
      });
    } catch (error) {
      setAudioCall((current) => ({
        ...current,
        active: false,
        connecting: false,
        ready: false,
        error: error instanceof Error ? error.message : "Unable to start Retell audio playback.",
        status: "error",
      }));
      retellClientRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const toggleMute = () => {
    if (!retellClientRef.current) return;
    if (audioCall.muted) {
      retellClientRef.current.unmute();
    } else {
      retellClientRef.current.mute();
    }
    setAudioCall((current) => ({ ...current, muted: !current.muted }));
  };

  const importBusinessAnalysis = async () => {
    if (!agent?.profile_id) return;
    setKbBusy(true);
    setKbError(null);
    try {
      const res = await fetch(`/api/download/json?profile_id=${encodeURIComponent(agent.profile_id)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setKbError(data.error ?? "Failed to load the previous business analysis.");
        setKbBusy(false);
        return;
      }
      const text = await res.text();
      const addRes = await fetch(`/api/agents/${agentId}/kb/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Imported Business Analysis", text }),
      });
      if (!addRes.ok) {
        const data = (await addRes.json().catch(() => ({}))) as { error?: { message?: string } | string };
        setKbError(typeof data.error === "string" ? data.error : data.error?.message ?? "Failed to import the analysis into the KB.");
      }
      await refreshKbSources();
    } finally {
      setKbBusy(false);
    }
  };

  const uploadKbDocument = async (file: File) => {
    setKbBusy(true);
    setKbError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/agents/${agentId}/kb/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
        setKbError(typeof data.error === "string" ? data.error : data.error?.message ?? "Document upload failed.");
      }
      await refreshKbSources();
    } finally {
      setKbBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      retellClientRef.current?.stopCall();
      retellClientRef.current = null;
    };
  }, []);

  if (agent?.type === "voice") {
    const quickTests =
      agent.config.voice.service_sku === "vs-02"
        ? [
            "Hi, this is ROBO AI calling to qualify your interest and offer a demo.",
            "I’m interested, but I need pricing details before booking.",
            "Please transfer me to a human sales rep.",
          ]
        : agent.config.voice.service_sku === "vs-03"
          ? [
              "Press 1 for bookings, 2 for support.",
              "I need help with my existing order.",
              "Please route me to the front desk.",
            ]
          : [
              "Hello, I’d like to book an appointment for next week.",
              "Can you tell me what documents I should bring?",
              "I need to reschedule and talk to a person.",
            ];

    return (
      <div className="min-h-screen bg-navy px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-white font-syne text-3xl font-bold mb-1">Voice Agent Studio</div>
              <div className="text-slateText">Step 5 — Prompt, functions, and live call simulation</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/builder/${agentId}/step4`)}
                className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
              >
                Back
              </button>
              {saving ? <div className="text-xs text-slateText">Saving changes...</div> : null}
              <button
                type="button"
                onClick={() => router.push(`/builder/${agentId}/checkout`)}
                className="h-11 px-5 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition"
              >
                Continue
              </button>
            </div>
          </div>

          {saveError ? <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200 mb-4">{saveError}</div> : null}

          <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="space-y-4">
              <div className="rounded-2xl border border-teal/30 bg-teal/5 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <VoiceBadge>Retell Runtime</VoiceBadge>
                  <VoiceBadge>{agent.config.voice.service_sku.toUpperCase()}</VoiceBadge>
                  <VoiceBadge>{agent.config.voice.call_mode}</VoiceBadge>
                </div>
                <div className="text-white text-xl font-semibold">{agent.config.name || "Voice agent"}</div>
                <div className="text-slateText text-sm mt-2">
                  {deploymentPlan?.provisioning.ready ? "Provisioning-ready." : deploymentPlan?.provisioning.next_step ?? "Configure the call flow and run simulations."}
                </div>
              </div>

              <details open className="rounded-2xl border border-navy-600 bg-navy-900/40">
                <summary className="cursor-pointer list-none px-5 py-4 text-white font-semibold">Identity & Prompt</summary>
                <div className="px-5 pb-5 space-y-4">
                  <div>
                    <div className="text-white/90 text-sm mb-2">Agent name</div>
                    <input
                      value={agent.config.name}
                      disabled={saving}
                      onChange={(e) => setAgent((a) => (a ? { ...a, config: { ...a.config, name: e.target.value } } : a))}
                      onBlur={async () => {
                        if (!agent) return;
                        await patchAgent({ config: { name: agent.config.name } });
                      }}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    />
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">System prompt</div>
                    <textarea
                      value={agent.config.system_prompt}
                      disabled={saving}
                      onChange={(e) => setAgent((a) => (a ? { ...a, config: { ...a.config, system_prompt: e.target.value } } : a))}
                      onBlur={async () => {
                        if (!agent) return;
                        await patchAgent({ config: { system_prompt: agent.config.system_prompt } });
                      }}
                      className="w-full min-h-[260px] rounded-xl bg-navy-800 border border-navy-600 px-4 py-3 text-sm text-white"
                    />
                  </div>
                </div>
              </details>

              <details open className="rounded-2xl border border-navy-600 bg-navy-900/40">
                <summary className="cursor-pointer list-none px-5 py-4 text-white font-semibold">Functions</summary>
                <div className="px-5 pb-5 space-y-4">
                  <div className="text-slateText text-sm">Expose callable voice actions such as transfers, bookings, CRM sync, or post-call automations.</div>
                  {voiceFunctions.length ? (
                    voiceFunctions.map((fn, index) => (
                      <div key={fn.id} className="rounded-xl border border-navy-600 bg-navy-800/60 p-4 space-y-3">
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-white/90 text-sm mb-2">Function label</div>
                            <input
                              value={fn.label}
                              onChange={(e) =>
                                setVoiceFunctions((items) => items.map((item) => (item.id === fn.id ? { ...item, label: e.target.value } : item)))
                              }
                              className="w-full h-10 rounded-lg bg-navy-900 border border-navy-600 px-3 text-white"
                            />
                          </div>
                          <div>
                            <div className="text-white/90 text-sm mb-2">Trigger</div>
                            <input
                              value={fn.trigger}
                              onChange={(e) =>
                                setVoiceFunctions((items) => items.map((item) => (item.id === fn.id ? { ...item, trigger: e.target.value } : item)))
                              }
                              placeholder="transfer, book_appointment, qualify_lead..."
                              className="w-full h-10 rounded-lg bg-navy-900 border border-navy-600 px-3 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-white/90 text-sm mb-2">Description</div>
                          <textarea
                            value={fn.description}
                            onChange={(e) =>
                              setVoiceFunctions((items) => items.map((item) => (item.id === fn.id ? { ...item, description: e.target.value } : item)))
                            }
                            className="w-full min-h-[88px] rounded-lg bg-navy-900 border border-navy-600 px-3 py-2 text-white"
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-sm text-white/80">
                            <input
                              type="checkbox"
                              checked={fn.enabled}
                              onChange={(e) =>
                                setVoiceFunctions((items) => items.map((item) => (item.id === fn.id ? { ...item, enabled: e.target.checked } : item)))
                              }
                            />
                            Enabled
                          </label>
                          <button
                            type="button"
                            onClick={() => setVoiceFunctions((items) => items.filter((item) => item.id !== fn.id))}
                            className="text-sm text-red-200 hover:text-red-100"
                          >
                            Remove
                          </button>
                        </div>
                        {index === voiceFunctions.length - 1 ? (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void patchAgent({ flow_graph: withVoiceFunctions(agent.flow_graph, voiceFunctions) })}
                              className="h-10 px-4 rounded-lg bg-white text-navy font-semibold hover:brightness-110 disabled:opacity-60"
                            >
                              Save functions
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-navy-500 p-4 text-sm text-slateText">
                      No voice functions yet. Add booking, transfer, CRM, or follow-up actions below.
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setVoiceFunctions((items) => [...items, createVoiceFunctionDraft(items.length)])}
                      className="h-10 px-4 rounded-lg border border-teal/40 bg-teal/10 text-teal font-semibold hover:bg-teal/20"
                    >
                      Add function
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void patchAgent({ flow_graph: withVoiceFunctions(agent.flow_graph, voiceFunctions) })}
                      className="h-10 px-4 rounded-lg bg-white text-navy font-semibold hover:brightness-110 disabled:opacity-60"
                    >
                      Save all
                    </button>
                  </div>
                </div>
              </details>

              <details className="rounded-2xl border border-navy-600 bg-navy-900/40">
                <summary className="cursor-pointer list-none px-5 py-4 text-white font-semibold">Knowledge Base</summary>
                <div className="px-5 pb-5 space-y-4">
                  <div className="rounded-xl border border-navy-600 bg-navy-800/60 p-4">
                    <div className="text-white font-medium">Business analysis from form intake</div>
                    <div className="text-slateText text-sm mt-1">
                      The voice agent uses the previous business analysis generated by the intake flow whenever it exists.
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <button
                        type="button"
                        disabled={kbBusy || !agent.profile_id}
                        onClick={() => void importBusinessAnalysis()}
                        className={
                          "h-10 px-4 rounded-lg font-semibold transition " +
                          (agent.profile_id ? "bg-white text-navy hover:brightness-110" : "bg-navy-700 text-slateText cursor-not-allowed")
                        }
                      >
                        {intakeAnalysisSource ? "Refresh intake analysis" : "Import intake analysis"}
                      </button>
                      <div className="text-xs text-slateText">
                        {intakeAnalysisSource
                          ? `Loaded as "${intakeAnalysisSource.name}" · ${intakeAnalysisSource.status} · ${intakeAnalysisSource.chunk_count} chunks`
                          : "No imported intake analysis yet."}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-dashed border-navy-500 bg-navy-800/40 p-4">
                      <div className="text-white font-medium">Document uploads</div>
                      <div className="text-slateText text-sm mt-1">
                        Customers can add FAQs, business history, policies, SOPs, pricing notes, and other reference docs.
                      </div>
                      <input
                        type="file"
                        accept=".txt,.md,.json"
                        disabled={kbBusy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await uploadKbDocument(file);
                          e.target.value = "";
                        }}
                        className="mt-4 block w-full text-sm text-slateText file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-navy file:font-semibold hover:file:brightness-110"
                      />
                      <div className="text-slateText text-xs mt-3">Placeholder upload area. Supported today: `.txt`, `.md`, `.json` up to 10MB.</div>
                    </div>

                    <div className="rounded-xl border border-navy-600 bg-navy-800/60 p-4">
                      <div className="text-white font-medium">Current KB sources</div>
                      <div className="space-y-2 mt-3 max-h-[220px] overflow-y-auto pr-1">
                        {kbSources.length ? (
                          kbSources.map((source) => (
                            <div key={source.id} className="rounded-lg border border-navy-600 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm text-white font-medium">{source.name}</div>
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slateText">{source.status}</div>
                              </div>
                              <div className="text-xs text-slateText mt-1">type: {source.type} · chunks: {source.chunk_count}</div>
                              {source.error_message ? <div className="text-xs text-red-300 mt-1">{source.error_message}</div> : null}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slateText">No KB sources loaded yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {kbError ? <div className="text-xs text-red-300">{kbError}</div> : null}

                  <div className="grid md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.rag_active}
                      onChange={(e) => void patchAgent({ config: { rag_active: e.target.checked } })}
                    />
                    RAG active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.voice.notion_sync}
                      onChange={(e) => void patchAgent({ config: { voice: { ...agent.config.voice, notion_sync: e.target.checked } } })}
                    />
                    Notion sync
                  </label>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Knowledge sync target</div>
                    <select
                      value={agent.config.voice.knowledge_sync_target}
                      onChange={(e) =>
                        void patchAgent({
                          config: {
                            voice: {
                              ...agent.config.voice,
                              knowledge_sync_target: e.target.value as VoiceConfig["knowledge_sync_target"],
                            },
                          },
                        })
                      }
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="retell+pgvector">Retell + pgvector</option>
                      <option value="pgvector">pgvector only</option>
                      <option value="none">Disabled</option>
                    </select>
                  </div>
                  <div className="rounded-xl border border-navy-600 bg-navy-800/60 p-4 text-sm text-slateText">
                    {lastRag.length ? `${lastRag.length} KB chunks were used in the latest voice test.` : "Run a voice test to inspect the retrieved KB context."}
                  </div>
                  </div>
                </div>
              </details>

              <details className="rounded-2xl border border-navy-600 bg-navy-900/40">
                <summary className="cursor-pointer list-none px-5 py-4 text-white font-semibold">Speech Settings</summary>
                <div className="px-5 pb-5 grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-white/90 text-sm mb-2">Retell model</div>
                    <input
                      value={agent.config.voice.retell_model}
                      onChange={(e) =>
                        setAgent((a) => (a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, retell_model: e.target.value } } } : a))
                      }
                      onBlur={async () => {
                        if (!agent) return;
                        await patchAgent({ config: { voice: agent.config.voice } });
                      }}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    />
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Retell voice</div>
                    <input
                      value={agent.config.voice.retell_voice}
                      onChange={(e) =>
                        setAgent((a) => (a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, retell_voice: e.target.value } } } : a))
                      }
                      onBlur={async () => {
                        if (!agent) return;
                        await patchAgent({ config: { voice: agent.config.voice } });
                      }}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    />
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Language</div>
                    <select
                      value={agent.config.language}
                      onChange={(e) => void patchAgent({ config: { language: e.target.value as AgentConfig["language"] } })}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="bilingual">Bilingual</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Tone</div>
                    <select
                      value={agent.config.tone}
                      onChange={(e) => void patchAgent({ config: { tone: e.target.value as AgentConfig["tone"] } })}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="formal">Formal</option>
                      <option value="casual">Casual</option>
                      <option value="empathetic">Empathetic</option>
                    </select>
                  </div>
                </div>
              </details>

              <details className="rounded-2xl border border-navy-600 bg-navy-900/40">
                <summary className="cursor-pointer list-none px-5 py-4 text-white font-semibold">Call Settings</summary>
                <div className="px-5 pb-5 grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-white/90 text-sm mb-2">Service</div>
                    <select
                      value={agent.config.voice.service_sku}
                      onChange={(e) =>
                        void patchAgent({ config: { voice: { ...agent.config.voice, service_sku: e.target.value as VoiceConfig["service_sku"] } } })
                      }
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="vs-01">VS-01 Voice Secretary</option>
                      <option value="vs-02">VS-02 Leads Hunter</option>
                      <option value="vs-03">VS-03 IVR Routing</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Call mode</div>
                    <select
                      value={agent.config.voice.call_mode}
                      onChange={(e) =>
                        void patchAgent({ config: { voice: { ...agent.config.voice, call_mode: e.target.value as VoiceConfig["call_mode"] } } })
                      }
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                      <option value="ivr">IVR</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Booking provider</div>
                    <select
                      value={agent.config.voice.booking_provider}
                      onChange={(e) =>
                        void patchAgent({
                          config: {
                            voice: { ...agent.config.voice, booking_provider: e.target.value as VoiceConfig["booking_provider"] },
                          },
                        })
                      }
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="none">None</option>
                      <option value="cal.com">Cal.com</option>
                      <option value="google_calendar">Google Calendar</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Twilio number</div>
                    <input
                      value={agent.config.voice.twilio_phone_number}
                      onChange={(e) =>
                        setAgent((a) => (a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, twilio_phone_number: e.target.value } } } : a))
                      }
                      onBlur={async () => {
                        if (!agent) return;
                        await patchAgent({ config: { voice: agent.config.voice } });
                      }}
                      placeholder="+1... or leave blank for env default"
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    />
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">Transfer number</div>
                    <input
                      value={agent.config.voice.transfer_number}
                      onChange={(e) =>
                        setAgent((a) => (a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, transfer_number: e.target.value } } } : a))
                      }
                      onBlur={async () => {
                        if (!agent) return;
                        await patchAgent({ config: { voice: agent.config.voice } });
                      }}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-white/90 text-sm mb-2">Booking URL</div>
                    <input
                      value={agent.config.voice.booking_url}
                      onChange={(e) =>
                        setAgent((a) => (a ? { ...a, config: { ...a.config, voice: { ...a.config.voice, booking_url: e.target.value } } } : a))
                      }
                      onBlur={async () => {
                        if (!agent) return;
                        await patchAgent({ config: { voice: agent.config.voice } });
                      }}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    />
                  </div>
                  <div className="md:col-span-2 text-xs text-slateText">
                    Caller number defaults to `TWILIO_PHONE_NUMBER` from `.env`, but you can override it here per voice agent.
                  </div>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.voice.booking_enabled}
                      onChange={(e) => void patchAgent({ config: { voice: { ...agent.config.voice, booking_enabled: e.target.checked } } })}
                    />
                    Booking enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.voice.voicemail_detection}
                      onChange={(e) => void patchAgent({ config: { voice: { ...agent.config.voice, voicemail_detection: e.target.checked } } })}
                    />
                    Voicemail detection
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.voice.dtmf_capture}
                      onChange={(e) => void patchAgent({ config: { voice: { ...agent.config.voice, dtmf_capture: e.target.checked } } })}
                    />
                    DTMF capture
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.voice.branded_caller_id}
                      onChange={(e) => void patchAgent({ config: { voice: { ...agent.config.voice, branded_caller_id: e.target.checked } } })}
                    />
                    Branded caller ID
                  </label>
                </div>
              </details>

              <details className="rounded-2xl border border-navy-600 bg-navy-900/40">
                <summary className="cursor-pointer list-none px-5 py-4 text-white font-semibold">Security & Fallback</summary>
                <div className="px-5 pb-5 grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-white/90 text-sm mb-2">Fallback behavior</div>
                    <select
                      value={agent.config.fallback}
                      onChange={(e) => void patchAgent({ config: { fallback: e.target.value as AgentConfig["fallback"] } })}
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="escalate">Escalate</option>
                      <option value="apologise">Apologise</option>
                      <option value="redirect">Redirect</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-white/90 text-sm mb-2">CRM target</div>
                    <select
                      value={agent.config.voice.crm_provider}
                      onChange={(e) =>
                        void patchAgent({ config: { voice: { ...agent.config.voice, crm_provider: e.target.value as VoiceConfig["crm_provider"] } } })
                      }
                      className="w-full h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
                    >
                      <option value="none">None</option>
                      <option value="hubspot">HubSpot</option>
                      <option value="salesforce">Salesforce</option>
                      <option value="csv">CSV</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.human_escalation}
                      onChange={(e) => void patchAgent({ config: { human_escalation: e.target.checked } })}
                    />
                    Human escalation
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.integrations.modal_enabled}
                      onChange={(e) =>
                        void patchAgent({ config: { integrations: { ...agent.config.integrations, modal_enabled: e.target.checked } } })
                      }
                    />
                    Modal enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.integrations.resend_digest}
                      onChange={(e) =>
                        void patchAgent({ config: { integrations: { ...agent.config.integrations, resend_digest: e.target.checked } } })
                      }
                    />
                    Resend digests
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={agent.config.integrations.supabase_logging}
                      onChange={(e) =>
                        void patchAgent({ config: { integrations: { ...agent.config.integrations, supabase_logging: e.target.checked } } })
                      }
                    />
                    Supabase logging
                  </label>
                </div>
              </details>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-navy-600 bg-navy-900/40 p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTestMode("audio")}
                      className={
                        "h-9 px-4 rounded-lg text-sm font-semibold transition " +
                        (testMode === "audio" ? "bg-white text-navy" : "bg-navy-800 text-slateText border border-navy-600")
                      }
                    >
                      Test Audio
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestMode("llm")}
                      className={
                        "h-9 px-4 rounded-lg text-sm font-semibold transition " +
                        (testMode === "llm" ? "bg-white text-navy" : "bg-navy-800 text-slateText border border-navy-600")
                      }
                    >
                      Test LLM
                    </button>
                  </div>
                  <div className="text-xs text-slateText">Retell voice sandbox</div>
                </div>

                <div className="rounded-2xl border border-navy-600 bg-gradient-to-b from-navy-900 to-navy-950 min-h-[280px] flex flex-col items-center justify-center text-center px-6 py-8">
                  <div
                    className={
                      "h-24 w-24 rounded-full flex items-center justify-center border text-4xl transition " +
                      (testMode === "audio" && (audioCall.active || audioCall.connecting)
                        ? "border-teal bg-teal/20 text-teal animate-pulse"
                        : busy
                          ? "border-teal bg-teal/20 text-teal animate-pulse"
                          : "border-navy-500 bg-navy-800 text-white/80")
                    }
                  >
                    {testMode === "audio" ? (audioCall.agentTalking ? "◉" : "•") : busy ? "..." : "•"}
                  </div>
                  <div className="text-white text-lg font-semibold mt-5">
                    {testMode === "audio"
                      ? audioCall.connecting
                        ? "Connecting to Retell..."
                        : audioCall.active
                          ? "Live Retell audio call"
                          : "Ready for a live voice test"
                      : busy
                        ? "Simulating call..."
                        : "Ready for a voice test"}
                  </div>
                  <div className="text-slateText text-sm mt-2 max-w-sm">
                    {testMode === "audio"
                      ? "This opens a real Retell browser call using your microphone and speaker so the customer and AI voice can talk live."
                      : "Run the same prompt through the voice agent logic while focusing on prompt and function behavior."}
                  </div>
                  {testMode === "audio" ? (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        disabled={!canRunVoiceTest || busy || audioCall.connecting}
                        onClick={() => void startAudioCall()}
                        className={
                          "h-11 px-5 rounded-lg font-bold transition " +
                          (!canRunVoiceTest || busy || audioCall.connecting || audioCall.active
                            ? "bg-navy-800 text-slateText cursor-not-allowed"
                            : "bg-teal text-navy hover:brightness-110")
                        }
                      >
                        Start Audio Test
                      </button>
                      <button
                        type="button"
                        disabled={!audioCall.active && !audioCall.connecting}
                        onClick={() => void stopAudioCall()}
                        className={
                          "h-11 px-5 rounded-lg font-bold transition " +
                          (audioCall.active || audioCall.connecting
                            ? "bg-white text-navy hover:brightness-110"
                            : "bg-navy-800 text-slateText cursor-not-allowed")
                        }
                      >
                        End Call
                      </button>
                      <button
                        type="button"
                        disabled={!audioCall.active}
                        onClick={toggleMute}
                        className={
                          "h-11 px-5 rounded-lg font-bold transition " +
                          (audioCall.active ? "border border-navy-500 text-white hover:border-teal/40" : "bg-navy-800 text-slateText cursor-not-allowed")
                        }
                      >
                        {audioCall.muted ? "Unmute Mic" : "Mute Mic"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canRunVoiceTest}
                      onClick={() => void runVoiceTest()}
                      className={
                        "mt-6 h-11 px-5 rounded-lg font-bold transition " +
                        (canRunVoiceTest ? "bg-teal text-navy hover:brightness-110" : "bg-navy-800 text-slateText cursor-not-allowed")
                      }
                    >
                      Run Test
                    </button>
                  )}
                  {testMode === "audio" ? (
                    <div className="mt-4 w-full max-w-sm">
                      <div className="flex items-center justify-between text-xs text-slateText mb-2">
                        <span>Agent audio level</span>
                        <span>{audioCall.agentTalking ? "speaking" : audioCall.active ? "listening" : "idle"}</span>
                      </div>
                      <div className="h-2 rounded-full bg-navy-800 overflow-hidden">
                        <div className="h-full bg-teal transition-all" style={{ width: `${Math.max(6, audioCall.audioLevel * 100)}%` }} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="text-white font-semibold">{testMode === "audio" ? "Pre-call scenario" : "Caller scenario"}</div>
                  <div className="flex flex-wrap gap-2">
                    {quickTests.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setScenarioInput(prompt);
                          if (testMode === "audio") {
                            void startAudioCall(prompt);
                          } else {
                            void runVoiceTest(prompt);
                          }
                        }}
                        className="rounded-full border border-navy-600 bg-navy-800 px-3 py-2 text-xs text-white/90 hover:border-teal/40 hover:text-teal"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={scenarioInput}
                    onChange={(e) => setScenarioInput(e.target.value)}
                    placeholder={testMode === "audio" ? "Describe the test context before starting the live call..." : "Describe what the caller says..."}
                    className="w-full min-h-[110px] rounded-xl bg-navy-800 border border-navy-600 px-4 py-3 text-white"
                  />
                </div>

                {lastMeta ? (
                  <div className="mt-4 rounded-xl border border-navy-600 bg-navy-800/50 p-3 text-xs text-slateText">
                    latency: {lastMeta.latency_ms}ms · voice runtime: {lastMeta.provider || "retell"} · model: {lastMeta.model}
                    {lastMeta.llm_provider && lastMeta.llm_model ? ` · LLM bridge: ${lastMeta.llm_provider}/${lastMeta.llm_model}` : ""}
                    {lastMeta.backup_used && lastMeta.backup_model ? ` · backup from /admin/settings: ${lastMeta.backup_model}` : ""}
                  </div>
                ) : null}
                {saveResultState || historyError ? (
                  <div className={`mt-3 text-xs ${historyError ? "text-red-300" : "text-slateText"}`}>
                    {historyError ?? saveResultState}
                  </div>
                ) : null}
                {testMode === "audio" ? (
                  <div className="mt-3 rounded-xl border border-navy-600 bg-navy-800/50 p-3 text-xs text-slateText">
                    status: {audioCall.status}
                    {audioCall.callId ? ` · call id: ${audioCall.callId}` : ""}
                    {audioCall.retellAgentId ? ` · retell agent: ${audioCall.retellAgentId}` : ""}
                    {audioCall.voiceId ? ` · voice: ${audioCall.voiceId}` : ""}
                    {audioCall.syncedAt ? ` · synced: ${audioCall.syncedAt}` : ""}
                    {audioCall.error ? ` · error: ${audioCall.error}` : ""}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-navy-600 bg-navy-900/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-white font-semibold">Voice transcript</div>
                    <div className="text-xs text-slateText mt-1">
                      {hasTranscript
                        ? `${transcript.length} transcript turns captured from the current test.`
                        : "Run an audio or LLM test to generate the caller and assistant transcript here."}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!hasTranscript}
                      onClick={() => downloadTranscript("txt")}
                      className={
                        "h-9 px-3 rounded-lg text-sm font-semibold transition " +
                        (hasTranscript ? "bg-white text-navy hover:brightness-110" : "bg-navy-800 text-slateText cursor-not-allowed")
                      }
                    >
                      Download TXT
                    </button>
                    <button
                      type="button"
                      disabled={!hasTranscript}
                      onClick={() => downloadTranscript("json")}
                      className={
                        "h-9 px-3 rounded-lg text-sm font-semibold transition " +
                        (hasTranscript
                          ? "border border-navy-500 text-white hover:border-teal/40 hover:text-teal"
                          : "bg-navy-800 text-slateText cursor-not-allowed")
                      }
                    >
                      Download JSON
                    </button>
                    <button
                      type="button"
                      disabled={!hasTranscript}
                      onClick={() => exportTestResult("json")}
                      className={
                        "h-9 px-3 rounded-lg text-sm font-semibold transition " +
                        (hasTranscript
                          ? "border border-teal/40 text-teal hover:bg-teal/10"
                          : "bg-navy-800 text-slateText cursor-not-allowed")
                      }
                    >
                      Export test result
                    </button>
                  </div>
                </div>
                {hasTranscript ? (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {transcript.map((turn, idx) => (
                      <div
                        key={`${turn.speaker}-${idx}`}
                        className={
                          "rounded-xl border p-4 " +
                          (turn.speaker === "caller"
                            ? "ml-8 border-white/10 bg-white/5"
                            : "mr-8 border-teal/20 bg-teal/10")
                        }
                      >
                        <div className="text-[11px] uppercase tracking-[0.12em] text-slateText mb-2">{turn.speaker}</div>
                        <div className="text-sm text-white whitespace-pre-line">{turn.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-navy-500 p-4 text-sm text-slateText">
                    Start `Test Audio` or `Test LLM` to render the caller and assistant transcript here, then download it as `TXT` or `JSON`.
                  </div>
                )}
              </div>

              {audioCall.summary ? (
                <div className="rounded-2xl border border-navy-600 bg-navy-900/40 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="text-white font-semibold">Call summary</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!hasTranscript}
                        onClick={() => downloadTranscript("txt")}
                        className={
                          "h-9 px-3 rounded-lg text-sm font-semibold transition " +
                          (hasTranscript ? "bg-white text-navy hover:brightness-110" : "bg-navy-800 text-slateText cursor-not-allowed")
                        }
                      >
                        Download transcript
                      </button>
                      <button
                        type="button"
                        disabled={!hasTranscript}
                        onClick={() => exportTestResult("json")}
                        className={
                          "h-9 px-3 rounded-lg text-sm font-semibold transition " +
                          (hasTranscript
                            ? "border border-teal/40 text-teal hover:bg-teal/10"
                            : "bg-navy-800 text-slateText cursor-not-allowed")
                        }
                      >
                        Export test result
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-slateText whitespace-pre-line">{audioCall.summary}</div>
                  {audioCall.recordingUrl ? (
                    <a href={audioCall.recordingUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm text-teal hover:underline">
                      Open recording
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-2xl border border-navy-600 bg-navy-900/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-white font-semibold">Agent history</div>
                    <div className="text-xs text-slateText mt-1">Recent Step 5 tests saved for this voice agent.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!hasTranscript || historyBusy}
                      onClick={() => {
                        const current = currentTestResult();
                        if (!current || !lastMeta) return;
                        void saveTestResult({
                          mode: current.mode,
                          prompt: current.prompt,
                          transcript: current.transcript,
                          summary: current.summary,
                          call_id: current.call_id,
                          recording_url: current.recording_url,
                          rag_chunks: current.rag_chunks,
                          metadata: current.metadata,
                        });
                      }}
                      className={
                        "h-9 px-3 rounded-lg text-sm font-semibold transition " +
                        (hasTranscript && !historyBusy ? "bg-white text-navy hover:brightness-110" : "bg-navy-800 text-slateText cursor-not-allowed")
                      }
                    >
                      Save current result
                    </button>
                    <button
                      type="button"
                      disabled={historyBusy}
                      onClick={() => void refreshSavedTests()}
                      className="h-9 px-3 rounded-lg border border-navy-500 text-white text-sm font-semibold hover:border-teal/40 hover:text-teal transition"
                    >
                      Refresh history
                    </button>
                  </div>
                </div>
                {savedTests.length ? (
                  <div className="space-y-3">
                    {savedTests.map((item) => (
                      <div key={item.id} className="rounded-xl border border-navy-600 bg-navy-800/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-white text-sm font-semibold">
                              {item.mode === "audio" ? "Audio test" : "LLM test"} · {new Date(item.created_at).toLocaleString()}
                            </div>
                            <div className="text-xs text-slateText mt-1">
                              {item.transcript.length} turns
                              {item.call_id ? ` · call id: ${item.call_id}` : ""}
                              {item.summary ? " · summary saved" : ""}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setTranscript(item.transcript);
                                setLastMeta(item.metadata);
                                setLastRag(item.rag_chunks);
                                setScenarioInput(item.prompt);
                                setTestMode(item.mode);
                                setAudioCall((current) => ({
                                  ...current,
                                  callId: item.call_id ?? "",
                                  summary: item.summary,
                                  recordingUrl: item.recording_url,
                                }));
                              }}
                              className="h-9 px-3 rounded-lg bg-white text-navy text-sm font-semibold hover:brightness-110 transition"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                triggerBrowserDownload(
                                  `${fileSafeName(agent?.config.name || "voice-agent") || "voice-agent"}-history-transcript-${item.id}.txt`,
                                  transcriptAsText(item.transcript),
                                  "text/plain;charset=utf-8"
                                )
                              }
                              className="h-9 px-3 rounded-lg border border-navy-500 text-white text-sm font-semibold hover:border-teal/40 hover:text-teal transition"
                            >
                              TXT
                            </button>
                            <button
                              type="button"
                              onClick={() => exportTestResult("json", item)}
                              className="h-9 px-3 rounded-lg border border-teal/40 text-teal text-sm font-semibold hover:bg-teal/10 transition"
                            >
                              JSON
                            </button>
                          </div>
                        </div>
                        <div className="text-slateText text-sm mt-3 line-clamp-2">{item.prompt || "No prompt saved."}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-navy-500 p-4 text-sm text-slateText">
                    Completed voice tests will be saved here so you can reopen or export them later.
                  </div>
                )}
              </div>

              {lastRag.length ? (
                <div className="rounded-2xl border border-navy-600 bg-navy-900/40 p-5">
                  <div className="text-white font-semibold mb-3">Knowledge used in the call</div>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {lastRag.map((chunk, idx) => (
                      <div key={`${chunk.source}-${idx}`} className="rounded-xl border border-navy-600 bg-navy-800/60 p-3">
                        <div className="text-xs text-teal mb-1">{chunk.source}</div>
                        <div className="text-sm text-slateText whitespace-pre-line">{chunk.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-navy-600 bg-navy-900/40 p-5">
                <div className="text-white font-semibold mb-3">Provider readiness</div>
                <div className="space-y-2">
                  {providerReadiness.map((item) => (
                    <div key={item.provider} className="rounded-xl border border-navy-600 bg-navy-800/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-white text-sm font-medium">{item.provider}</div>
                        <div className="text-[11px] uppercase tracking-[0.12em] text-slateText">{item.status.replace(/_/g, " ")}</div>
                      </div>
                      <div className="text-slateText text-sm mt-1">{item.summary}</div>
                    </div>
                  ))}
                </div>
                {missingProviders.length ? (
                  <div className="text-xs text-slateText mt-3">Missing credentials for: {missingProviders.join(", ")}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-white font-syne text-3xl font-bold mb-1">AI Builder</div>
            <div className="text-slateText">Step 5 — Test harness</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/step4`)}
              className="h-11 px-5 rounded-lg border border-navy-500 text-white font-bold hover:border-teal/40 hover:text-teal transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => router.push(`/builder/${agentId}/checkout`)}
              className="h-11 px-5 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition"
            >
              Continue
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5 mb-4">
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={
                  "rounded-lg px-4 py-3 text-sm whitespace-pre-line " +
                  (m.role === "user" ? "bg-teal/15 text-white ml-10 border border-teal/30" : "bg-navy-800 text-white/90 mr-10 border border-navy-600")
                }
              >
                {m.content}
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              disabled={busy}
              placeholder="Type a test message..."
              className="flex-1 h-11 rounded-lg bg-navy-800 border border-navy-600 px-3 text-white"
            />
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void send()}
              className={
                "h-11 px-5 rounded-lg font-bold transition " +
                (canSend ? "bg-white text-navy hover:brightness-110" : "bg-navy-800 text-slateText cursor-not-allowed")
              }
            >
              Send
            </button>
          </div>

          {lastMeta ? (
            <div className="mt-3 text-xs text-slateText">latency: {lastMeta.latency_ms}ms · model: {lastMeta.provider}/{lastMeta.model}</div>
          ) : null}
        </div>

        {lastRag.length ? (
          <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-5">
            <div className="text-white font-semibold mb-2">RAG context used</div>
            <div className="space-y-2">
              {lastRag.map((c, i) => (
                <div key={i} className="rounded-lg border border-navy-600 p-3">
                  <div className="text-xs text-teal mb-2">{c.source}</div>
                  <div className="text-slateText text-sm whitespace-pre-line">{c.content}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
