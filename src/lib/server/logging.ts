import { mkdir, appendFile } from "fs/promises";

// On Vercel only /tmp is writable; fall back to /tmp when process.cwd() is read-only.
function dataDir(): string {
  return process.env.VERCEL ? "/tmp/robo-data" : `${process.cwd()}/.data`;
}

export async function appendJsonlLog(input: {
  file: string;
  event: string;
  fields?: Record<string, unknown>;
}): Promise<void> {
  try {
    const dir = dataDir();
    await mkdir(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), event: input.event, ...(input.fields ?? {}) });
    await appendFile(`${dir}/${input.file}`, `${line}\n`, "utf8");
  } catch {
    void 0;
  }
}

