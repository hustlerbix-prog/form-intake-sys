import { getPaymentSettings } from "@/lib/server/paymentSettings";

export type Processor = "stripe" | "mercadopago" | "paypal" | "bypass";

const DEFAULT_LATAM = new Set([
  "AR", "BR", "CL", "CO", "MX", "PE", "VE",
]);

export async function selectProcessor(billingCountry: string): Promise<{
  primary: Processor;
  fallback: Processor;
}> {
  const { payment } = await getPaymentSettings();
  const latam = payment.latamCountries.length > 0
    ? new Set(payment.latamCountries)
    : DEFAULT_LATAM;

  if (latam.has(billingCountry.toUpperCase())) {
    const primary = payment.enabledProcessors.includes("mercadopago")
      ? "mercadopago"
      : "stripe";
    return { primary, fallback: "stripe" };
  }
  return { primary: "stripe", fallback: "paypal" };
}

// Sync version for cases where async isn't available — uses defaults
export function selectProcessorSync(billingCountry: string): {
  primary: Processor;
  fallback: Processor;
} {
  if (DEFAULT_LATAM.has(billingCountry.toUpperCase())) {
    return { primary: "mercadopago", fallback: "stripe" };
  }
  return { primary: "stripe", fallback: "paypal" };
}
