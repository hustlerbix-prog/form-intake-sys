interface ReceiptPayload {
  orderId: string;
  accountId: string;
  amountUsd: number;
  email?: string;
}

export async function sendReceiptEmail(payload: ReceiptPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "receipts@roboai.agency";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured — skipping receipt email");
    return;
  }

  // Lazy-load Resend so missing package doesn't crash other routes
  let Resend: { new (key: string): { emails: { send: (opts: unknown) => Promise<unknown> } } };
  try {
    const mod = await import("resend");
    Resend = mod.Resend as typeof Resend;
  } catch {
    console.warn("[email] resend package not installed — skipping receipt email");
    return;
  }

  const resend = new Resend(apiKey);
  const recipientEmail = payload.email ?? "noreply@roboai.agency";

  try {
    await resend.emails.send({
      from,
      to: recipientEmail,
      subject: `Payment Confirmed — Order ${payload.orderId.slice(0, 8).toUpperCase()}`,
      html: buildReceiptHtml(payload),
    });
  } catch (err) {
    console.error("[email] sendReceiptEmail failed:", err);
  }
}

function buildReceiptHtml(payload: ReceiptPayload): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0D1B2A">Payment Confirmed</h2>
      <p>Thank you! Your payment of <strong>$${payload.amountUsd.toFixed(2)} USD</strong> has been received.</p>
      <p style="color:#666">Order ID: <code>${payload.orderId}</code></p>
      <hr/>
      <p style="font-size:12px;color:#999">ROBO AI Agency</p>
    </div>
  `.trim();
}
