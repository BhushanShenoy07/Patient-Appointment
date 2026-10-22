import type { ClinicProfile } from "@/lib/auth";

/** All ART server settings, read in one place. Secrets never leave the server. */
export function artConfig() {
  const values = {
    clientId: process.env.ART_CLIENT_ID?.trim(),
    clientSecret: process.env.ART_CLIENT_SECRET?.trim(),
    org: process.env.ART_ORG_TITLE?.trim(),
    environment: process.env.ART_ENVIRONMENT?.trim(),
    projectKey: process.env.ART_PROJECT_KEY?.trim(),
    channel: process.env.NEXT_PUBLIC_ART_CHANNEL_NAME?.trim(),
  };
  const names: Record<keyof typeof values, string> = {
    clientId: "ART_CLIENT_ID",
    clientSecret: "ART_CLIENT_SECRET",
    org: "ART_ORG_TITLE",
    environment: "ART_ENVIRONMENT",
    projectKey: "ART_PROJECT_KEY",
    channel: "NEXT_PUBLIC_ART_CHANNEL_NAME",
  };
  const missing = (Object.keys(values) as (keyof typeof values)[])
    .filter(key => !values[key] || values[key] === "xxx")
    .map(key => names[key]);

  if (missing.length) {
    throw new Error(
      `Missing ART server configuration: ${missing.join(", ")}. Add these values to .env.local on the backend and restart Next.js.`
    );
  }

  return {
    clientId: values.clientId!,
    clientSecret: values.clientSecret!,
    org: values.org!,
    environment: values.environment!,
    projectKey: values.projectKey!,
    channel: values.channel!,
    apiBase: (process.env.ART_API_BASE || "https://demo.arealtimetech.com/ws").replace(/\/$/, ""),
    uri: (process.env.ART_WS_URI || "demo.arealtimetech.com/ws").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    event: process.env.ART_APPOINTMENT_EVENT || "send_sms",
    agentId: process.env.ART_AGENT_ID || "6ab4e96b92bd477cd1a31fd3",
  };
}

/** What a signed-in browser needs to open its own ART connection. Contains no secrets. */
export function artBrowserConfig(profile: ClinicProfile) {
  const config = artConfig();
  return {
    uri: config.uri,
    org: config.org,
    environment: config.environment,
    projectKey: config.projectKey,
    channel: config.channel,
    event: config.event,
    username: profile.artUsername,
    agentId: config.agentId,
  };
}

function serverHeaders() {
  const config = artConfig();
  return {
    Accept: "application/json",
    "User-Agent": "Clinic-Desk/1.0",
    ProjectKey: config.projectKey,
    Environment: config.environment,
    "Client-Secret": config.clientSecret,
    "Client-ID": config.clientId,
    "X-Org": config.org,
  };
}

/** Requests a one-time passcode for the profile's ART identity. */
export async function requestPasscode(profile: ClinicProfile) {
  const config = artConfig();
  const response = await fetch(`${config.apiBase}/v1/connect/passcode`, {
    method: "POST",
    headers: { ...serverHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      username: profile.artUsername,
      first_name: profile.firstName,
      last_name: profile.lastName,
    }),
  });
  const result = await response.json().catch(() => ({}));
  const passcode = result.data?.passcode ?? result.passcode;
  if (!response.ok || !passcode) {
    throw new Error(result.message || `ART passcode request failed (${response.status}).`);
  }
  return passcode as string;
}

/**
 * Does the ADK's token step on the server. ART only accepts a passcode together
 * with the client secret, so the browser cannot do this itself without being
 * handed the secret. The identity is always the signed-in user's own profile.
 */
export async function issueAccessToken(profile: ClinicProfile) {
  const config = artConfig();
  const passcode = await requestPasscode(profile);
  const response = await fetch(`https://${config.uri}/auth/token`, {
    method: "POST",
    headers: { ...serverHeaders(), "X-pass": passcode },
  });
  const result = await response.json().catch(() => ({}));
  const accessToken = result.data?.access_token;
  if (!response.ok || !accessToken) {
    throw new Error(result.message || `ART token request failed (${response.status}).`);
  }
  return accessToken as string;
}
