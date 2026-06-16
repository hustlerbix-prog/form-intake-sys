export function stripeKey(): string {
  const key = process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY_TEST;
  if (!key) throw new Error("Stripe secret key not configured");
  return key;
}

export function stripePublishableKey(): string {
  const key = process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST;
  if (!key) throw new Error("Stripe publishable key not configured");
  return key;
}

export function mpToken(): string {
  const token = process.env.NODE_ENV === "production"
    ? process.env.MP_ACCESS_TOKEN
    : process.env.MP_ACCESS_TOKEN_TEST;
  if (!token) throw new Error("MercadoPago access token not configured");
  return token;
}

export function braintreeConfig() {
  const isTest = process.env.BRAINTREE_ENVIRONMENT !== "production";
  return {
    isTest,
    merchantId: isTest
      ? process.env.BRAINTREE_MERCHANT_ID_TEST!
      : process.env.BRAINTREE_MERCHANT_ID!,
    publicKey: isTest
      ? process.env.BRAINTREE_PUBLIC_KEY_TEST!
      : process.env.BRAINTREE_PUBLIC_KEY!,
    privateKey: isTest
      ? process.env.BRAINTREE_PRIVATE_KEY_TEST!
      : process.env.BRAINTREE_PRIVATE_KEY!,
  };
}

export function stripeWebhookSecret(): string {
  const secret = process.env.NODE_ENV === "production"
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET_TEST;
  if (!secret) throw new Error("Stripe webhook secret not configured");
  return secret;
}
