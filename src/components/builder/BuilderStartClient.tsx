"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function BuilderStartClient(props: { profileId: string; dev?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.profileId && !props.dev) {
      setError("Missing profile_id");
      return;
    }
    let mounted = true;
    (async () => {
      const res = await fetch("/api/builder/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props.profileId ? { profile_id: props.profileId } : { dev: true }),
      });
      const data = (await res.json()) as { agent_id?: string; error?: string };
      if (!mounted) return;
      if (!res.ok || !data.agent_id) {
        setError(data.error ?? "Failed to start builder");
        return;
      }
      router.replace(`/builder/${data.agent_id}/step1`);
    })().catch((e: unknown) => {
      if (!mounted) return;
      setError(e instanceof Error ? e.message : "Failed to start builder");
    });
    return () => {
      mounted = false;
    };
  }, [props.profileId, props.dev, router]);

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-white font-syne text-2xl font-bold mb-3">AI Builder</div>
        {error ? <div className="text-red-300 text-sm">{error}</div> : <div className="text-slateText text-sm">Preparing your workspace…</div>}
      </div>
    </div>
  );
}
