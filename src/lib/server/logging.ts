import { mkdir, appendFile } from "fs/promises";

export async function appendJsonlLog(input: {
  file: string;
  event: string;
  fields?: Record<string, unknown>;
}): Promise<void> {
  try {
    await mkdir(`${process.cwd()}/.data`, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), event: input.event, ...(input.fields ?? {}) });
    await appendFile(`${process.cwd()}/.data/${input.file}`, `${line}\n`, "utf8");
  } catch {
    void 0;
  }
}

