"use client";

import { useEffect, useState } from "react";
import { ConversationalForm } from "@/components/form/ConversationalForm";
import { PipelineStatus } from "@/components/holding/PipelineStatus";

type Lang = "en" | "es";

export default function AnalysePage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [language, setLanguage] = useState<Lang>("en");

  useEffect(() => {
    const detected = navigator.language.startsWith("es") ? "es" : "en";
    setLanguage(detected);

    const storedRaw = localStorage.getItem("robo_session");
    const stored = storedRaw ? (JSON.parse(storedRaw) as { profileId: string; expiresAt: string }) : null;
    const storedValid = stored && new Date(stored.expiresAt).getTime() > Date.now();

    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: detected,
        source_product_id: new URLSearchParams(window.location.search).get("product") ?? undefined,
        profile_id: storedValid ? stored?.profileId : undefined,
      }),
    })
      .then((r) => r.json())
      .then((data: { profile_id: string; expires_at: string }) => {
        setProfileId(data.profile_id);
        setExpiresAt(data.expires_at);
        localStorage.setItem(
          "robo_session",
          JSON.stringify({ profileId: data.profile_id, expiresAt: data.expires_at })
        );
      })
      .catch(() => {});
  }, []);

  if (!profileId) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-teal font-semibold">Loading…</div>
      </div>
    );
  }

  if (submitted) {
    return <PipelineStatus profileId={profileId} language={language} />;
  }

  return (
    <div>
      <div className="sr-only">Business intake form</div>
      <ConversationalForm
        profileId={profileId}
        language={language}
        onLanguageChange={setLanguage}
        onSubmitted={() => setSubmitted(true)}
      />
      {expiresAt ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-xs text-slateText">
          Session expires: {new Date(expiresAt).toLocaleString()}
        </div>
      ) : null}
    </div>
  );
}

