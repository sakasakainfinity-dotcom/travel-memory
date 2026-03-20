import "server-only";

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function getSupabaseServerEnv() {
  return {
    url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getStripeEnv() {
  return {
    secretKey: getRequiredEnv("STRIPE_SECRET_KEY"),
    webhookSecret: getOptionalEnv("STRIPE_WEBHOOK_SECRET"),
    premiumPriceId: getOptionalEnv("STRIPE_PREMIUM_PRICE_ID"),
  };
}

export function getAppUrlEnv() {
  return {
    baseUrl: getOptionalEnv("NEXT_PUBLIC_BASE_URL"),
    appUrl: getOptionalEnv("NEXT_PUBLIC_APP_URL"),
    siteUrl: getOptionalEnv("NEXT_PUBLIC_SITE_URL"),
  };
}
