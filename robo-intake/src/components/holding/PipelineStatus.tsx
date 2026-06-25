"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ContactCard } from "@/components/form/ContactCard";

type Report = {
  catalogue_version: string;
  business_summary: string;
  operational_gaps: Array<{
    gap_id: string;
    description: string;
    severity_score: number;
    evidence_source: "form" | "scrape" | "both" | "inferred";
  }>;
  readiness_score: number;
  recommended_products: Array<{
    product_id: string;
    product_name: string;
    tier: "primary" | "upsell";
    monthly_price_usd: number | null;
    one_time_price_usd: number | null;
    rationale: string;
    value_driver: string;
    priority_rank: number;
  }>;
  estimated_monthly_value_usd: number;
  roi: {
    monthly_value_usd: number;
    monthly_cost_usd: number;
    one_time_cost_usd: number;
    net_monthly_value_usd: number;
    payback_months: number | null;
    roi_12mo_percent: number | null;
    assumptions: string[];
  };
  before_after: { before: string; after: string; revenue_support: string };
  demos: {
    chatbot: { title: string; script: string[] };
    voice_assistant: { title: string; script: string[] };
    automations: { title: string; script: string[] };
  };
};

type Status = {
  submitted: boolean;
  scraped: boolean;
  analyzed: boolean;
  analysis_running: boolean;
  pdf_ready: boolean;
  pdf_url: string | null;
  json_url: string | null;
  scrape_url: string | null;
  report: (Report & {
    data_source: "full" | "intake_only";
    llm_provider: string;
    llm_model: string;
    reasoning_trace: string;
  }) | null;
};

async function fetchPipelineStatus(profileId: string): Promise<Status> {
  const res = await fetch(`/api/pipeline-status?profile_id=${profileId}`);
  if (!res.ok) {
    throw new Error("Failed to load pipeline status");
  }
  return (await res.json()) as Status;
}

export function PipelineStatus(props: { profileId: string; language: "en" | "es" }) {
  const [status, setStatus] = useState<Status | null>(null);
  const isEs = props.language === "es";
  const [showContact, setShowContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [redoBusy, setRedoBusy] = useState(false);
  const [redoError, setRedoError] = useState<string | null>(null);

  const stages = useMemo(
    () =>
      isEs
        ? ["Solicitud recibida", "Analizando tu sitio web", "Ejecutando diagnóstico IA", "Preparando tu reporte"]
        : ["Submission received", "Analysing your website", "Running AI diagnosis", "Preparing your report"],
    [isEs]
  );

  useEffect(() => {
    let mounted = true;
    let timeoutId: number | undefined;
    const poll = async () => {
      try {
        const data = await fetchPipelineStatus(props.profileId);
        if (!mounted) return;
        setStatus(data);
        if (data.analysis_running || !data.pdf_ready) {
          timeoutId = window.setTimeout(poll, 8000);
        }
      } catch {
        if (!mounted) return;
        timeoutId = window.setTimeout(poll, 8000);
      }
    };
    poll();
    return () => {
      mounted = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [props.profileId]);

  const reportUsedFallback = status?.report?.reasoning_trace === "fallback_mode";
  const reportNeedsAiConfig = status?.report?.llm_provider === "disabled" || status?.report?.llm_model === "disabled";

  const canRedoAnalysis =
    Boolean(status?.submitted && status.scraped && status.analyzed) &&
    !status?.analysis_running &&
    (!status?.report || reportUsedFallback);

  const activeStage = !status
    ? 0
    : status.pdf_ready
      ? 4
      : status.analyzed
        ? 3
        : status.scraped
          ? 2
          : status.submitted
            ? 1
            : 0;

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-white font-syne text-2xl font-bold mb-8">
          {isEs ? "Tu análisis está en proceso" : "Your analysis is underway"}
        </h1>

        <div className="space-y-4 mb-8">
          {stages.map((label, i) => (
            <div key={i} className="flex items-center gap-4">
              <div
                className={
                  "w-6 h-6 rounded-full flex-shrink-0 " +
                  (i < activeStage
                    ? "bg-teal"
                    : i === activeStage
                      ? "bg-teal animate-pulse"
                      : "bg-navy-800")
                }
              />
              <span className={`text-left ${i <= activeStage ? "text-white" : "text-slateText"}`}>{label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {canRedoAnalysis ? (
            <button
              type="button"
              disabled={redoBusy}
              onClick={async () => {
                setRedoBusy(true);
                setRedoError(null);
                try {
                  const res = await fetch("/api/redo-analysis", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profile_id: props.profileId }),
                  });
                  if (!res.ok) {
                    const data = (await res.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(data?.error ?? "Redo failed");
                  }
                  const next = await fetchPipelineStatus(props.profileId);
                  setStatus(next);
                } catch (err) {
                  setRedoError(err instanceof Error ? err.message : isEs ? "No se pudo rehacer el análisis." : "Could not redo the analysis.");
                } finally {
                  setRedoBusy(false);
                }
              }}
              className="inline-flex items-center justify-center h-11 rounded-lg border border-teal text-teal font-semibold hover:bg-teal/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {redoBusy ? (isEs ? "Rehaciendo análisis…" : "Redoing analysis…") : isEs ? "Rehacer análisis" : "Redo analysis"}
            </button>
          ) : null}
          {status?.scrape_url ? (
            <a
              href={status.scrape_url}
              download
              className="inline-flex items-center justify-center h-11 rounded-lg border border-slate-500 text-slate-200 font-semibold hover:bg-slate-800/60 transition gap-2"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
              </svg>
              {isEs ? "Descargar datos web (JSON)" : "Download website data (JSON)"}
            </a>
          ) : null}
          {status?.json_url ? (
            <a
              href={status.json_url}
              download
              className="inline-flex items-center justify-center h-11 rounded-lg border border-navy-600 text-white font-semibold hover:bg-navy-800 transition gap-2"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
              </svg>
              {isEs ? "Descargar análisis completo (JSON)" : "Download full analysis (JSON)"}
            </a>
          ) : null}
          {status?.pdf_ready && status.pdf_url ? (
            <a
              href={status.pdf_url}
              className="inline-flex items-center justify-center h-11 rounded-lg bg-teal text-navy font-bold hover:brightness-110 transition"
            >
              {isEs ? "Descargar PDF" : "Download PDF"}
            </a>
          ) : (
            <div className="text-slateText text-sm">{isEs ? "Generando PDF…" : "Generating PDF…"}</div>
          )}
          {status?.report ? (
            <Link
              href={`/builder/start?profile_id=${encodeURIComponent(props.profileId)}`}
              className="inline-flex items-center justify-center h-11 rounded-lg bg-white text-navy font-bold hover:brightness-110 transition"
            >
              {isEs ? "Continuar a construir" : "Continue to build"}
            </Link>
          ) : null}
        </div>

        {redoError ? <div className="mt-3 text-sm text-rose-300">{redoError}</div> : null}

        {status?.report ? (
          <div className="mt-10 text-left rounded-xl border border-navy-600 bg-navy-900/40 p-5">
            <div className="text-white font-syne font-bold text-lg mb-2">{isEs ? "Resumen del reporte" : "Report preview"}</div>
            {status.analysis_running ? (
              <div className="mb-3 rounded-lg border border-teal/40 bg-teal/10 px-3 py-2 text-sm text-teal">
                {isEs
                  ? "Estamos regenerando el diagnóstico y el PDF con la configuración actual del modelo."
                  : "We are regenerating the diagnosis and PDF with the current model configuration."}
              </div>
            ) : null}
            {reportUsedFallback && reportNeedsAiConfig ? (
              <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {isEs
                  ? "Este reporte se generó sin un modelo IA configurado. Ahora puedes rehacer el análisis después de configurar `/admin/settings`."
                  : "This report was generated without a configured AI model. You can now redo the analysis after configuring `/admin/settings`."}
              </div>
            ) : null}
            {reportUsedFallback && !reportNeedsAiConfig ? (
              <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {isEs
                  ? "El modelo está configurado, pero el diagnóstico IA falló en este intento. Puedes rehacer el análisis o cambiar el modelo."
                  : "The model is configured, but the AI diagnosis failed on this attempt. You can redo the analysis or change the model."}
              </div>
            ) : null}
            <div className="text-slateText text-sm whitespace-pre-line">
              {status.report.business_summary}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-navy-600 p-3">
                <div className="text-white font-semibold">{isEs ? "Readiness" : "Readiness"}</div>
                <div className="text-slateText">{status.report.readiness_score}/100</div>
              </div>
              <div className="rounded-lg border border-navy-600 p-3">
                <div className="text-white font-semibold">{isEs ? "Valor mensual" : "Monthly value"}</div>
                <div className="text-slateText">${status.report.estimated_monthly_value_usd}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-white font-semibold mb-1">{isEs ? "Top gaps" : "Top gaps"}</div>
              <div className="text-slateText text-sm whitespace-pre-line">
                {status.report.operational_gaps
                  .slice(0, 3)
                  .map((g) => `• ${g.gap_id} (sev ${g.severity_score}/10): ${g.description}`)
                  .join("\n")}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-white font-semibold mb-1">{isEs ? "Oportunidades (catálogo)" : "Opportunities (catalog)"}</div>
              <div className="text-slateText text-sm whitespace-pre-line">
                {status.report.recommended_products
                  .slice()
                  .sort((a, b) => a.priority_rank - b.priority_rank)
                  .map((p) => {
                    const price =
                      p.monthly_price_usd != null ? `$${p.monthly_price_usd}/mo` : p.one_time_price_usd != null ? `$${p.one_time_price_usd} one-time` : "";
                    return `• ${p.product_name} (${p.product_id}) — ${p.tier}${price ? ` — ${price}` : ""}\n  ${p.rationale}`;
                  })
                  .join("\n")}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-white font-semibold mb-1">{isEs ? "Antes / Después" : "Before / After"}</div>
              <div className="text-slateText text-sm whitespace-pre-line">
                {status.report.before_after.before}
                {"\n\n"}
                {status.report.before_after.after}
                {"\n\n"}
                {status.report.before_after.revenue_support}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-white font-semibold mb-1">{isEs ? "ROI" : "ROI"}</div>
              <div className="text-slateText text-sm whitespace-pre-line">
                {[
                  `${isEs ? "Valor mensual" : "Monthly value"}: $${status.report.roi.monthly_value_usd}`,
                  `${isEs ? "Costo mensual" : "Monthly cost"}: $${status.report.roi.monthly_cost_usd}`,
                  `${isEs ? "Costo one-time" : "One-time cost"}: $${status.report.roi.one_time_cost_usd}`,
                  `${isEs ? "Net mensual" : "Net monthly"}: $${status.report.roi.net_monthly_value_usd}`,
                  status.report.roi.payback_months != null ? `${isEs ? "Payback" : "Payback"}: ${status.report.roi.payback_months} mo` : null,
                  status.report.roi.roi_12mo_percent != null ? `${isEs ? "ROI 12 meses" : "12-mo ROI"}: ${status.report.roi.roi_12mo_percent}%` : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-white font-semibold mb-2">{isEs ? "Mini demos (productos default)" : "Mini demos (default products)"}</div>
              <div className="space-y-3">
                {[status.report.demos.chatbot, status.report.demos.voice_assistant, status.report.demos.automations].map((d) => (
                  <div key={d.title} className="rounded-lg border border-navy-600 p-3">
                    <div className="text-white font-semibold">{d.title}</div>
                    <div className="text-slateText text-sm whitespace-pre-line mt-1">{d.script.join("\n")}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              {!contactSaved ? (
                showContact ? (
                  <ContactCard
                    language={props.language}
                    variant="optional"
                    onSubmit={async (contact) => {
                      await fetch("/api/submit-profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ profile_id: props.profileId, contact, language: props.language }),
                      }).catch(() => {});
                      setContactSaved(true);
                    }}
                    onBack={() => setShowContact(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowContact(true)}
                    className="inline-flex items-center justify-center h-11 w-full rounded-lg border border-navy-600 text-white font-semibold hover:bg-navy-800 transition"
                  >
                    {isEs ? "Enviar reporte por email (opcional)" : "Email the report (optional)"}
                  </button>
                )
              ) : (
                <div className="text-teal font-semibold">{isEs ? "Listo — guardamos tu email." : "Done — we saved your email."}</div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-8 text-slateText text-sm">
          Ref: {props.profileId.split("-")[0]}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <a
            href={process.env.NEXT_PUBLIC_CALENDAR_BOOKING_URL ?? "#"}
            className={
              "font-semibold transition " +
              (process.env.NEXT_PUBLIC_CALENDAR_BOOKING_URL ? "text-teal hover:underline" : "text-slateText")
            }
          >
            {isEs ? "Reserva tu sesión" : "Book a walkthrough"}
          </a>
          <button
            type="button"
            onClick={async () => {
              const ok = window.confirm(
                isEs
                  ? "¿Seguro que quieres eliminar tus datos?"
                  : "Are you sure you want to delete your data?"
              );
              if (!ok) return;
              await fetch("/api/gdpr-erase", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile_id: props.profileId }),
              });
              try {
                window.localStorage.removeItem("robo_session");
              } catch {
                void 0;
              }
              window.location.href = "/";
            }}
            className="text-slateText hover:text-white transition"
          >
            {isEs ? "Eliminar mis datos" : "Delete my data"}
          </button>
        </div>
      </div>
    </div>
  );
}
