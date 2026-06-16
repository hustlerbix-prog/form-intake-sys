import { describe, expect, it, vi } from "vitest";
import {
  createOrResumeSession,
  getPdfBytes,
  getPipelineStatus,
  getSubmissionJson,
  redoAnalysis,
  saveAnswer,
  submitProfile,
} from "./store";

describe("store", () => {
  it("submits and generates JSON/PDF", async () => {
    vi.useRealTimers();
    const { profile_id } = createOrResumeSession({ language: "en" });

    saveAnswer({ profile_id, field: "industry", value: "logistics", question_id: "Q-01" });
    saveAnswer({ profile_id, field: "team_size", value: "2-5", question_id: "Q-02" });
    saveAnswer({ profile_id, field: "bottleneck", value: "Dispatch", question_id: "Q-06" });

    const submission = submitProfile({
      profile_id,
      language: "en",
      contact: { email: "test@example.com", first_name: "Test", consent_marketing: false },
    });

    expect(submission?.profile_id).toBe(profile_id);
    expect(getSubmissionJson({ profile_id })?.contact?.email).toBe("test@example.com");

    const status0 = getPipelineStatus({ profile_id });
    expect(status0?.submitted).toBe(true);

    let ready = false;
    for (let i = 0; i < 80; i++) {
      const status = getPipelineStatus({ profile_id });
      if (status?.pdf_ready) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }

    const status1 = getPipelineStatus({ profile_id });
    expect(ready).toBe(true);
    expect(status1?.pdf_ready).toBe(true);
    expect(getPdfBytes({ profile_id })?.byteLength ?? 0).toBeGreaterThan(1000);
  });

  it("can redo analysis for an existing submitted profile", async () => {
    vi.useRealTimers();
    const { profile_id } = createOrResumeSession({ language: "en" });

    saveAnswer({ profile_id, field: "industry", value: "healthcare", question_id: "Q-01" });
    saveAnswer({ profile_id, field: "team_size", value: "6-20", question_id: "Q-02" });
    saveAnswer({ profile_id, field: "bottleneck", value: "Manual scheduling", question_id: "Q-06" });

    submitProfile({ profile_id, language: "en" });

    for (let i = 0; i < 80; i++) {
      if (getPipelineStatus({ profile_id })?.pdf_ready) break;
      await new Promise((r) => setTimeout(r, 25));
    }

    const ok = await redoAnalysis({ profile_id });
    expect(ok).toBe(true);
    expect(getPipelineStatus({ profile_id })?.analysis_running).toBe(false);
    expect(getPipelineStatus({ profile_id })?.pdf_ready).toBe(true);
    expect(getSubmissionJson({ profile_id })?.full_report).toBeTruthy();
  });
});
