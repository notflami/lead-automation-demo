import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get sessionSecret() {
    const s = required("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long.");
    return s;
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  webhookUrl: () => process.env.N8N_WEBHOOK_URL || "",
  webhookSecret: () => process.env.N8N_WEBHOOK_SECRET || "",
  cronSecret: () => process.env.CRON_SECRET || "",
  siteUrl: () => siteUrl(),
  defaultCountryCode: () => (process.env.DEFAULT_PHONE_COUNTRY_CODE || "49").replace(/\D/g, ""),
  timeZone: () => process.env.EVENT_TIMEZONE || "Europe/Berlin",
};

/** Public URL: PUBLIC_SITE_URL, else the Vercel production domain (set automatically by Vercel), else localhost. */
export function siteUrl(): string {
  const explicit = process.env.PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = explicit || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}
