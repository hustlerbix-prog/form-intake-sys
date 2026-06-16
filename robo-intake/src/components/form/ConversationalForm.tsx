"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/form/MessageBubble";
import { TypingIndicator } from "@/components/form/TypingIndicator";
import { ProgressBar } from "@/components/form/ProgressBar";
import { ChipSelect } from "@/components/form/ChipSelect";
import { MultiChipSelect } from "@/components/form/MultiChipSelect";
import { FreeTextInput } from "@/components/form/FreeTextInput";
import { QUESTION_BANK } from "@/lib/questions";

type InputType = "chip-single" | "chip-multi" | "free-text";

type QuestionResponse = {
  question_id: string;
  question_text: string;
  helper_text: string | null;
  layer_badge: string;
  step_current: number;
  step_total: number;
  field: string;
  input_type: InputType;
  options: { value: string; label: string }[] | null;
  offer_early_completion: boolean;
};

type Msg = {
  id: string;
  side: "agent" | "user";
  content: string;
  kind?: "typing";
  badge?: string;
  helper?: string | null;
};

export function ConversationalForm(props: {
  profileId: string;
  language: "en" | "es";
  onLanguageChange: (lang: "en" | "es") => void;
  onSubmitted: () => void;
}) {
  const showUrlOnlyToggle = true;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [questionsShown, setQuestionsShown] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const storageKey = useMemo(() => `robo_form_state_${props.profileId}`, [props.profileId]);
  const answersRef = useRef<Record<string, unknown>>({});
  const questionsShownRef = useRef<string[]>([]);
  const inFlightRef = useRef(false);
  const progressTotal = useMemo(() => currentQuestion?.step_total ?? 15, [currentQuestion]);

  const [devUrlOnly, setDevUrlOnly] = useState(false);
  const websiteTimingNoteRef = useRef(false);

  const fetchNextQuestion = useCallback(
    async (input?: { answers?: Record<string, unknown>; questionsShown?: string[] }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(true);

      const typingId = `typing-${Date.now()}`;
      setMessages((m) => [...m, { id: typingId, side: "agent", content: "", kind: "typing" }]);
      await delay(900 + Math.floor(Math.random() * 400));

      const res = await fetch("/api/next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: props.profileId,
          answers_so_far: input?.answers ?? answersRef.current,
          questions_shown: input?.questionsShown ?? questionsShownRef.current,
          language: props.language,
        }),
      });

      const data = (await res.json()) as QuestionResponse | { done: true };
      setMessages((m) => m.filter((x) => x.id !== typingId));
      if ("done" in data) {
        setCurrentQuestion(null);
        inFlightRef.current = false;
        setBusy(true);
        await fetch("/api/submit-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile_id: props.profileId, language: props.language }),
        }).catch(() => {});
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          void 0;
        }
        setBusy(false);
        props.onSubmitted();
        return;
      }

      setCurrentQuestion(data);
      setMessages((m) => {
        const msgId = `q-${data.question_id}`;
        if (m.some((x) => x.id === msgId)) return m;
        return [
          ...m,
          {
            id: msgId,
            side: "agent",
            content: data.question_text,
            badge: data.layer_badge,
            helper: data.helper_text,
          },
        ];
      });
      setBusy(false);
      inFlightRef.current = false;
    },
    [props.language, props.profileId]
  );

  const jumpToWebsiteUrl = useCallback(async () => {
    const websiteQuestionId = "Q-15";
    const skipIds = QUESTION_BANK.filter((q) => q.id !== websiteQuestionId).map((q) => q.id);

    const nextAnswers: Record<string, unknown> = {};
    const nextShown = [...skipIds];

    websiteTimingNoteRef.current = false;
    setCurrentQuestion(null);
    setAnswers(nextAnswers);
    setQuestionsShown(nextShown);
    setMessages([
      {
        id: `dev-jump-${Date.now()}-${Math.random()}`,
        side: "agent",
        content: props.language === "es" ? "Modo URL: saltando a la URL del sitio." : "URL-only mode: jumping to website URL.",
      },
    ]);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ answers: nextAnswers, questionsShown: nextShown }));
    } catch {
      void 0;
    }
    await fetchNextQuestion({ answers: nextAnswers, questionsShown: nextShown });
  }, [fetchNextQuestion, props.language, storageKey]);

  useEffect(() => {
    if (!showUrlOnlyToggle) return;
    if (!devUrlOnly) return;
    void jumpToWebsiteUrl();
  }, [devUrlOnly, jumpToWebsiteUrl, showUrlOnlyToggle]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, currentQuestion]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionsShownRef.current = questionsShown;
  }, [questionsShown]);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    const parsed = raw ? (JSON.parse(raw) as { answers: Record<string, unknown>; questionsShown: string[] }) : null;
    if (parsed && parsed.questionsShown.length > 0) {
      setAnswers(parsed.answers ?? {});
      setQuestionsShown(parsed.questionsShown ?? []);
      setMessages((m) => [
        ...m,
        {
          id: `resume-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`,
          side: "agent",
          content:
            props.language === "es"
              ? `Reanudando en la pregunta ${parsed.questionsShown.length + 1}.`
              : `Resuming at question ${parsed.questionsShown.length + 1}.`,
        },
      ]);
      void fetchNextQuestion({ answers: parsed.answers ?? {}, questionsShown: parsed.questionsShown ?? [] });
      return;
    }
    void fetchNextQuestion();
  }, [fetchNextQuestion, props.language, storageKey]);

  async function persistAnswer(input: { field: string; value: unknown; question_id: string }) {
    await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: props.profileId,
        field: input.field,
        value: input.value,
        question_id: input.question_id,
      }),
    });
  }

  async function onAnswered(input: { value: unknown; display: string }) {
    if (!currentQuestion) return;
    const q = currentQuestion;
    setMessages((m) => [...m, { id: `a-${q.question_id}-${Date.now()}`, side: "user", content: input.display }]);

    const nextAnswers = { ...answers, [q.field]: input.value };
    const nextShown = [...questionsShown, q.question_id];
    setAnswers(nextAnswers);
    setQuestionsShown(nextShown);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ answers: nextAnswers, questionsShown: nextShown }));
    } catch {
      void 0;
    }

    await persistAnswer({ field: q.field, value: input.value, question_id: q.question_id });

    if (q.field === "website_url" && typeof input.value === "string" && input.value.trim() && !websiteTimingNoteRef.current) {
      websiteTimingNoteRef.current = true;
      setMessages((m) => [
        ...m,
        {
          id: `scrape-note-${Date.now()}-${Math.random()}`,
          side: "agent",
          content:
            props.language === "es"
              ? "Hemos iniciado el web scraping y la generación del informe. Suele tardar 2–5 minutos para sitios pequeños y hasta 10–15 minutos para sitios grandes o cuando hay límites de velocidad."
              : "We’ve started web scraping and report generation. Typical completion time is 2–5 minutes for small sites, up to 10–15 minutes for larger sites or when rate limits apply.",
        },
      ]);
    }
    await fetchNextQuestion({ answers: nextAnswers, questionsShown: nextShown });
  }

  const input = currentQuestion;

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-syne text-sm font-bold">
              <span className="text-white">ROBO </span>
              <span className="text-teal">AI</span>
              <span className="text-white"> Agency</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-slateText text-sm font-semibold">
              {Math.min(questionsShown.length, progressTotal)} of {progressTotal}
            </div>
            {showUrlOnlyToggle ? (
              <label className="inline-flex items-center gap-2 ml-2">
                <span className="text-xs font-semibold text-slateText">URL-only</span>
                <button
                  type="button"
                  onClick={() => setDevUrlOnly((v) => !v)}
                  className={
                    "relative w-10 h-6 rounded-full transition " +
                    (devUrlOnly ? "bg-teal" : "bg-navy-600")
                  }
                  aria-label="Toggle URL-only"
                >
                  <span
                    className={
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " +
                      (devUrlOnly ? "left-5" : "left-0.5")
                    }
                  />
                </button>
              </label>
            ) : null}
            <button
              type="button"
              className="h-9 w-9 rounded-lg border border-navy-600 text-white hover:bg-navy-800 transition"
              aria-label="Menu"
            >
              …
            </button>
            <button
              type="button"
              onClick={() => props.onLanguageChange("en")}
              className={
                "h-9 px-3 rounded-lg border text-sm font-semibold transition " +
                (props.language === "en" ? "bg-teal text-navy border-teal" : "border-navy-600 text-white hover:bg-navy-800")
              }
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => props.onLanguageChange("es")}
              className={
                "h-9 px-3 rounded-lg border text-sm font-semibold transition " +
                (props.language === "es" ? "bg-teal text-navy border-teal" : "border-navy-600 text-white hover:bg-navy-800")
              }
            >
              ES
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="w-full">
            <ProgressBar value={Math.min(questionsShown.length, progressTotal)} max={progressTotal} />
          </div>
        </div>

        <div className="mt-6 bg-navy-800/40 border border-navy-600 rounded-2xl overflow-hidden">
          <div ref={scrollRef} className="h-[520px] overflow-y-auto p-6 space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} side={m.side}>
                {m.kind === "typing" ? (
                  <TypingIndicator />
                ) : m.side === "agent" && (m.badge || m.helper) ? (
                  <div>
                    {m.badge ? (
                      <div className="inline-flex h-6 px-3 rounded-md items-center bg-[#2F5B84] text-white text-xs font-bold tracking-wide">
                        {m.badge}
                      </div>
                    ) : null}
                    <div className="mt-3 whitespace-pre-line leading-7">{m.content}</div>
                    {m.helper ? <div className="mt-2 text-slateText text-sm italic">{m.helper}</div> : null}
                  </div>
                ) : (
                  <span className="whitespace-pre-line leading-7">{m.content}</span>
                )}
              </MessageBubble>
            ))}
          </div>

          <div className="border-t border-navy-600 p-4 bg-navy">
            {input ? (
              input.input_type === "chip-single" && input.options ? (
                <ChipSelect
                  options={input.options}
                  onSelect={(value, label) => void onAnswered({ value, display: label })}
                />
              ) : input.input_type === "chip-multi" && input.options ? (
                <MultiChipSelect
                  options={input.options}
                  onSubmit={(values, labels) => void onAnswered({ value: values, display: labels.join(", ") })}
                />
              ) : (
                <FreeTextInput onSubmit={(text) => void onAnswered({ value: text, display: text })} />
              )
            ) : (
              <div className="text-slateText">{busy ? "" : ""}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
