import "server-only";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  return readEnv(name);
}

export function getSupabasePublicEnv() {
  return {
    url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getSupabaseServerEnv() {
  return {
    url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getStripeEnv() {
  return {
    secretKey: getOptionalEnv("STRIPE_SECRET_KEY"),
    webhookSecret: getOptionalEnv("STRIPE_WEBHOOK_SECRET"),
    premiumPriceId: getOptionalEnv("STRIPE_PREMIUM_PRICE_ID"),
  };
}

export function getRequiredStripeSecretKey() {
  return getRequiredEnv("STRIPE_SECRET_KEY");
}

export function getAppUrlEnv() {
  return {
    baseUrl: getOptionalEnv("NEXT_PUBLIC_BASE_URL"),
    appUrl: getOptionalEnv("NEXT_PUBLIC_APP_URL"),
    siteUrl: getOptionalEnv("NEXT_PUBLIC_SITE_URL"),
  };
}

export function getYahooAppId() {
  return (
    getOptionalEnv("NEXT_PUBLIC_YAHOO_APPID") ||
    getOptionalEnv("YAHOO_API_KEY") ||
    getOptionalEnv("NEXT_PUBLIC_YAHOO_APP_ID") ||
    getOptionalEnv("YAHOO_APP_ID")
  );
}
