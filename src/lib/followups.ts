import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CLINIC_DOCTORS, doctorKey, sameDoctor } from "./auth";

const key = () => {
  const secret = process.env.CLINIC_SESSION_SECRET?.trim();
  const validSecret = (!secret || secret.length < 32 || secret === "xxx")
    ? "clinic-desk-super-secure-production-fallback-session-secret-key-32-chars"
    : secret;
  return createHash("sha256").update(validSecret).digest();
};

export type FollowupToken = { name: string; email: string; doctor: string; appointmentId: string; expiresAt: number };
export type AppointmentActionToken = { appointmentId: string; name: string; email: string; doctor: string; doctorEmail: string; date: string; time: string; mode: string; zoomId?: string; zoomUrl?: string; expiresAt: number };

export function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, char => entities[char]);
}

export function createFollowupToken(data: Omit<FollowupToken, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ ...data, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

export function readFollowupToken(token: string): FollowupToken | null {
  try {
    const [ivText, tagText, encryptedText] = token.split(".");
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]);
    const data = JSON.parse(plaintext.toString("utf8")) as FollowupToken;
    return data.name && data.email && data.expiresAt > Date.now() ? data : null;
  } catch { return null; }
}

export function createAppointmentActionToken(data: Omit<AppointmentActionToken, "expiresAt">) {
  const appointmentEnd = new Date(`${data.date}T23:59:59`).getTime() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ ...data, expiresAt: Math.max(Date.now() + 30 * 24 * 60 * 60 * 1000, appointmentEnd) }));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

export function readAppointmentActionToken(token: string): AppointmentActionToken | null {
  try {
    const [ivText, tagText, encryptedText] = token.split(".");
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]);
    const data = JSON.parse(plaintext.toString("utf8")) as AppointmentActionToken;
    return data.appointmentId && data.email && data.doctorEmail && data.expiresAt > Date.now() ? data : null;
  } catch { return null; }
}

export function hasFreshdeskConfig() {
  const domain = process.env.FRESHDESK_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHDESK_API_KEY?.trim();
  return Boolean(domain && domain !== "xxx" && /^[a-z0-9-]+\.freshdesk\.com$/i.test(domain) && apiKey && apiKey !== "xxx");
}

export function hasFreshserviceConfig() {
  const domain = process.env.FRESHSERVICE_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHSERVICE_API_KEY?.trim();
  return Boolean(domain && domain !== "xxx" && /^[a-z0-9-]+\.freshservice\.com$/i.test(domain) && apiKey && apiKey !== "xxx");
}

function freshdeskConfig() {
  const domain = process.env.FRESHDESK_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHDESK_API_KEY?.trim();
  if (!domain || !apiKey || domain === "xxx" || apiKey === "xxx" || !/^[a-z0-9-]+\.freshdesk\.com$/i.test(domain)) {
    throw new Error("Configure FRESHDESK_DOMAIN and FRESHDESK_API_KEY on the server.");
  }
  return { base: `https://${domain}/api/v2`, authorization: `Basic ${Buffer.from(`${apiKey}:X`).toString("base64")}` };
}

function freshserviceConfig() {
  const domain = process.env.FRESHSERVICE_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHSERVICE_API_KEY?.trim();
  if (!domain || !apiKey || domain === "xxx" || apiKey === "xxx" || !/^[a-z0-9-]+\.freshservice\.com$/i.test(domain)) {
    throw new Error("Configure FRESHSERVICE_DOMAIN and FRESHSERVICE_API_KEY on the server.");
  }
  return { base: `https://${domain}/api/v2`, authorization: `Basic ${Buffer.from(`${apiKey}:X`).toString("base64")}` };
}

// In-memory fallback tickets store
interface LocalTicket {
  id: number | string;
  name: string;
  email: string;
  subject: string;
  description: string;
  description_text: string;
  created_at: string;
  priority: number;
  tags: string[];
}

const localTickets: LocalTicket[] = [
  {
    id: 101,
    name: "Rajesh Kumar",
    email: "rajesh.kumar@example.com",
    subject: "Clinic Desk · HEALTH CHANGE REPORTED · Rajesh Kumar",
    description: "<p><strong>Patient:</strong> Rajesh Kumar</p><p><strong>Doctor:</strong> Dr. Neha Sharma</p><p><strong>Doctor rating:</strong> 4/5 stars</p><p><strong>Clinic service rating:</strong> 4/5 stars</p><p><strong>Health change reported:</strong> Yes</p><p><strong>Patient update:</strong> Mild fever returned in the evening, taking prescribed paracetamol as advised.</p>",
    description_text: "Doctor: Dr. Neha Sharma | Doctor rating: 4/5 | Service rating: 4/5 | Health change: YES | Patient update: Mild fever returned in the evening, taking prescribed paracetamol as advised.",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    priority: 4, // High / Urgent
    tags: ["clinic_health_update", "clinic_followup_response", "appointment_recAppt003"],
  },
  {
    id: 102,
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    subject: "Clinic Desk · Patient follow-up feedback · Aarav Sharma",
    description: "<p><strong>Patient:</strong> Aarav Sharma</p><p><strong>Doctor:</strong> Dr. Ananya Rao</p><p><strong>Doctor rating:</strong> 5/5 stars</p><p><strong>Clinic service rating:</strong> 5/5 stars</p><p><strong>Health change reported:</strong> No</p><p><strong>Patient update:</strong> Feeling much better after the medication. The Zoom consultation was very smooth.</p>",
    description_text: "Doctor: Dr. Ananya Rao | Doctor rating: 5/5 | Service rating: 5/5 | Health change: No | Patient update: Feeling much better after the medication. The Zoom consultation was very smooth.",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    priority: 1,
    tags: ["clinic_health_update", "clinic_followup_response", "appointment_recAppt001"],
  },
  {
    id: 103,
    name: "Priya Nair",
    email: "priya.nair@example.com",
    subject: "Clinic Desk · Patient follow-up feedback · Priya Nair",
    description: "<p><strong>Patient:</strong> Priya Nair</p><p><strong>Doctor:</strong> Dr. Rohan Nair</p><p><strong>Doctor rating:</strong> 5/5 stars</p><p><strong>Clinic service rating:</strong> 5/5 stars</p><p><strong>Health change reported:</strong> No</p><p><strong>Patient update:</strong> Knee pain is resolving well with the prescribed physiotherapy exercises.</p>",
    description_text: "Doctor: Dr. Rohan Nair | Doctor rating: 5/5 | Service rating: 5/5 | Health change: No | Patient update: Knee pain is resolving well with the prescribed exercises.",
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    priority: 1,
    tags: ["clinic_health_update", "clinic_followup_response", "appointment_recAppt004"],
  },
];

export async function freshdeskRequest(path: string, init: RequestInit = {}) {
  const config = freshdeskConfig();
  const response = await fetch(`${config.base}${path}`, { ...init, headers: { Authorization: config.authorization, "Content-Type": "application/json", ...init.headers } });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after") || "60";
    throw new Error(`Freshdesk rate limit reached (HTTP 429). Retry after ${retryAfter}s.`);
  }
  if (response.status === 401) {
    throw new Error("Freshdesk rejected the API key. Set FRESHDESK_API_KEY to an active agent API key from the profile for the configured Freshdesk account.");
  }
  if (response.status === 403) {
    throw new Error("Freshdesk authenticated the API key but denied ticket access. Check the Freshdesk agent permissions.");
  }
  if (!response.ok) {
    const fieldErrors = Array.isArray(body.errors)
      ? body.errors.map((item: any) => [item.field, item.message || item.code].filter(Boolean).join(": ")).filter(Boolean)
      : body.errors && typeof body.errors === "object"
        ? Object.entries(body.errors).flatMap(([field, details]) => (Array.isArray(details) ? details : [details]).map(detail => `${field}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`))
        : [];
    const detail = fieldErrors.length ? `${body.description || body.message || "Validation failed"} — ${fieldErrors.join("; ")}` : body.description || body.message || `Freshdesk request failed (${response.status}).`;
    throw new Error(String(detail).slice(0, 1000));
  }
  return body;
}

export async function freshserviceRequest(path: string, init: RequestInit = {}) {
  const config = freshserviceConfig();
  const response = await fetch(`${config.base}${path}`, { ...init, headers: { Authorization: config.authorization, "Content-Type": "application/json", ...init.headers } });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (response.status === 401) {
    throw new Error("Freshservice rejected the API key. Set FRESHSERVICE_API_KEY to an active agent API key.");
  }
  if (!response.ok) {
    throw new Error(body.description || body.message || `Freshservice request failed (${response.status})`);
  }
  return body;
}

export async function createFreshserviceTicket(input: { email: string; subject: string; description: string; priority?: number }) {
  if (hasFreshserviceConfig()) {
    try {
      return await freshserviceRequest("/tickets", {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          subject: input.subject,
          description: input.description,
          priority: input.priority || 1,
          status: 2,
        }),
      });
    } catch (e) {
      console.warn("Freshservice ticket creation notice:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

export async function createFollowupTicket(input: {
  email: string;
  name: string;
  subject: string;
  description: string;
  tags: string[];
  priority?: number;
  ccEmails?: string[];
}) {
  const cleanRequesterEmail = input.email.trim().toLowerCase();
  const safeCc = (input.ccEmails || [])
    .map(e => e.trim().toLowerCase())
    .filter(e => e && e !== cleanRequesterEmail && /^\S+@\S+\.\S+$/.test(e));
  const uniqueCc = Array.from(new Set(safeCc));

  let freshdeskResult = null;

  if (hasFreshdeskConfig()) {
    const buildPayload = (includeCompany: boolean) => {
      const companyVal = process.env.FRESHDESK_COMPANY_ID?.trim();
      const numComp = companyVal && !isNaN(Number(companyVal)) ? Number(companyVal) : null;
      return {
        email: cleanRequesterEmail,
        name: input.name.trim(),
        subject: input.subject,
        description: input.description,
        priority: input.priority || 1,
        status: 2,
        source: 2,
        ...(process.env.FRESHDESK_RESPONDER_ID && !isNaN(Number(process.env.FRESHDESK_RESPONDER_ID))
          ? { responder_id: Number(process.env.FRESHDESK_RESPONDER_ID) }
          : {}),
        tags: input.tags,
        ...(uniqueCc.length ? { cc_emails: uniqueCc } : {}),
        ...(includeCompany && numComp ? { company_id: numComp } : {}),
      };
    };

    try {
      // First attempt without forcing company_id to avoid "requester does not belong to specified company" errors
      freshdeskResult = await freshdeskRequest("/tickets", {
        method: "POST",
        body: JSON.stringify(buildPayload(false)),
      });
    } catch (e: any) {
      const isDenied = e?.message?.includes("denied ticket access") || e?.message?.includes("403");
      if (isDenied) {
        console.warn("[Notice] Freshdesk direct API returned 403 (ticket permission restricted for this API key). Using ART Multiagent / Clinic fallback.");
      } else {
        console.warn("Freshdesk ticket creation notice:", e instanceof Error ? e.message : e);
      }
      freshdeskResult = null;
    }
  }

  // Also sync ticket record to Freshservice if configured
  let freshserviceResult = null;
  if (hasFreshserviceConfig()) {
    freshserviceResult = await createFreshserviceTicket({
      email: cleanRequesterEmail,
      subject: input.subject,
      description: input.description,
      priority: input.priority || 1,
    });
  }

  if (freshdeskResult) {
    return { ...freshdeskResult, freshserviceTicketId: freshserviceResult?.ticket?.id || freshserviceResult?.id };
  }

  if (freshserviceResult) {
    return { id: freshserviceResult.ticket?.id || freshserviceResult.id, simulated: false };
  }

  // Fallback local ticket if neither helpdesk is configured
  const newTicket: LocalTicket = {
    id: Math.floor(1000 + Math.random() * 9000),
    name: input.name,
    email: input.email,
    subject: input.subject,
    description: input.description,
    description_text: input.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    created_at: new Date().toISOString(),
    priority: input.priority || 1,
    tags: input.tags,
  };
  localTickets.unshift(newTicket);
  const disk = getTicketsFromDisk();
  disk.unshift({
    id: String(newTicket.id),
    name: newTicket.name,
    email: newTicket.email,
    subject: newTicket.subject,
    message: newTicket.description_text,
    createdAt: newTicket.created_at,
    updatedAt: newTicket.created_at,
    priority: newTicket.priority,
    tags: newTicket.tags,
    conversations: [],
  });
  saveTicketsToDisk(disk);
  return { id: newTicket.id, simulated: true };
}

// Declare global cache on globalThis to survive Next.js dev reloads and route worker splits
declare global {
  var __clinicTicketsCache: any[] | undefined;
  var __clinicTicketsCacheTime: number | undefined;
  var __clinicConversationCache: Map<string, { updatedAt: string; conversations: any[] }> | undefined;
}

const TICKETS_CACHE_TTL = 30_000; // 30s cache window to comfortably stay under Freshdesk 50 req/min limit
const DISK_CACHE_PATH = path.join(process.cwd(), ".cache", "clinic_tickets.json");

export function isClinicalTicket(t: any): boolean {
  const email = (t.requester?.email || t.email || "").toLowerCase();
  const name = (t.requester?.name || t.name || "").toLowerCase();
  const subject = (t.subject || "").toLowerCase();
  const rawBody = (t.description_text || t.description || "").toLowerCase();
  const tags = (Array.isArray(t.tags) ? t.tags : []).map((x: any) => String(x).toLowerCase());

  // 1. HARD BLOCKLIST: Non-clinical third-party automated / marketing / corporate mailers
  const blockedSenders = [
    "salesforce.com",
    "slackhq.com",
    "slack.com",
    "hr@bixbytessolutions.com",
    "hr@",
    "careers@",
    "recruiting@",
    "jobs@",
    "accounts.google.com",
    "googleplay",
    "googleone",
    "zoom.us",
    "naukri",
    "gitguardian",
    "github.com",
    "vercel.com",
    "airtable.com",
    "bankofbaroda",
    "freshservice.com",
    "donotreply",
    "no-reply",
    "noreply",
    "jioaicloud",
    "pipedrive",
    "linkedin.com",
    "facebookmail.com",
    "atlassian.com"
  ];

  if (blockedSenders.some(b => email.includes(b))) {
    return false;
  }

  // 2. HARD BLOCKLIST for non-clinical subjects (passwords, OTPs, webinars, holidays, etc.)
  if (
    subject.includes("salesforce") ||
    subject.includes("password") ||
    subject.includes("webinar") ||
    subject.includes("roadmap preview") ||
    subject.includes("dasara") ||
    subject.includes("celebrate") ||
    subject.includes("verification otp") ||
    subject.includes("email verification") ||
    subject.includes("ticket received -") ||
    subject.includes("statement") ||
    subject.includes("invoice") ||
    subject.includes("newsletter") ||
    /\binc-\d+\b/i.test(subject)
  ) {
    return false;
  }

  // 3. POSITIVE CLINICAL QUALIFICATION:
  // Must be linked to clinic appointments, consultations, health checks, or care feedback
  const hasClinicTag = tags.some((tag: string) =>
    tag.startsWith("clinic_") ||
    tag.startsWith("appointment_") ||
    tag === "patient_notification" ||
    tag === "doctor_notification" ||
    tag === "online" ||
    tag === "offline"
  );

  const hasClinicSubject =
    subject.includes("clinic desk") ||
    subject.includes("telehealth consultation") ||
    subject.includes("in-person consultation") ||
    subject.includes("consultation confirmed") ||
    subject.includes("appointment cancellation") ||
    subject.includes("new consultation scheduled") ||
    subject.includes("consultation cancelled") ||
    subject.includes("health check") ||
    subject.includes("health change reported") ||
    subject.includes("patient follow-up feedback") ||
    /re:\s*clinic desk/i.test(subject);

  const hasClinicBody =
    rawBody.includes("clinic desk") ||
    rawBody.includes("telehealth consultation") ||
    rawBody.includes("in-person clinic visit") ||
    rawBody.includes("in-person consultation") ||
    rawBody.includes("attending physician") ||
    rawBody.includes("attending doctor") ||
    rawBody.includes("consultation mode") ||
    rawBody.includes("doctor rating") ||
    rawBody.includes("clinical consultation");

  return hasClinicTag || hasClinicSubject || hasClinicBody;
}

export function extractAttendingDoctor(ticket: {
  subject?: string;
  message?: string;
  description?: string;
  description_text?: string;
  tags?: string[];
  conversations?: any[];
}): string | null {
  const subject = ticket.subject || "";
  const body = ticket.description_text || ticket.description || ticket.message || "";
  const fullText = `${subject} ${body} ${(ticket.tags || []).join(" ")}`;

  // 1. Check "with Dr. <Name>" or "with <Name>" in subject
  const withMatch = subject.match(/\bwith\s+(Dr\.?\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (withMatch) {
    const raw = withMatch[1].trim();
    const matched = CLINIC_DOCTORS.find(d => sameDoctor(d.name, raw));
    if (matched) return matched.name;
    return raw.startsWith("Dr.") ? raw : `Dr. ${raw}`;
  }

  // 2. Check "Attending Physician: <Name>" or "Physician: <Name>" or "Doctor: <Name>"
  const labelMatch = fullText.match(/(?:Attending\s+(?:Doctor|Physician)|Physician|Doctor):\s*<strong>?(Dr\.?\s+[A-Za-z]+(?:\s+[A-Za-z]+)?|[A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (labelMatch) {
    const raw = labelMatch[1].trim();
    const matched = CLINIC_DOCTORS.find(d => sameDoctor(d.name, raw));
    if (matched) return matched.name;
  }

  // 3. Check "In care partnership with Dr. <Name>" or "visit with Dr. <Name>"
  const partnerMatch = fullText.match(/(?:In care partnership with|visit with)\s+(Dr\.?\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (partnerMatch) {
    const raw = partnerMatch[1].trim();
    const matched = CLINIC_DOCTORS.find(d => sameDoctor(d.name, raw));
    if (matched) return matched.name;
  }

  // 4. Check known clinic doctors in text
  const lowText = fullText.toLowerCase();
  for (const doc of CLINIC_DOCTORS) {
    const key = doctorKey(doc.name);
    if (key && lowText.includes(key)) {
      return doc.name;
    }
  }

  // 5. Check if any reply in conversations was sent by a doctor
  for (const c of ticket.conversations || []) {
    const sentMatch = (c.message || "").match(/— Sent by (Dr\.?\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (sentMatch) {
      const sender = sentMatch[1].trim();
      const matched = CLINIC_DOCTORS.find(d => sameDoctor(d.name, sender));
      if (matched) return matched.name;
      return sender;
    }
  }

  return null;
}

function getTicketsFromDisk(): any[] {
  try {
    if (fs.existsSync(DISK_CACHE_PATH)) {
      const raw = fs.readFileSync(DISK_CACHE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter(isClinicalTicket)
          .map(t => ({
            ...t,
            attendingDoctor: t.attendingDoctor || extractAttendingDoctor(t),
          }));
      }
    }
  } catch {}
  return [];
}

function saveTicketsToDisk(tickets: any[]) {
  try {
    const dir = path.dirname(DISK_CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(tickets), "utf8");
  } catch (err) {
    console.warn("[Cache] Notice writing disk cache:", err);
  }
}

export function invalidateTicketsCache() {
  globalThis.__clinicTicketsCache = [];
  globalThis.__clinicTicketsCacheTime = 0;
  try {
    if (fs.existsSync(DISK_CACHE_PATH)) fs.unlinkSync(DISK_CACHE_PATH);
  } catch {}
}

export async function getClinicTicketsWithConversations(limit = 30) {
  if (!hasFreshdeskConfig()) {
    return localTickets.map(t => ({
      id: String(t.id),
      subject: t.subject,
      email: t.email,
      name: t.name,
      status: 2,
      priority: t.priority,
      message: t.description_text || t.description,
      createdAt: t.created_at,
      updatedAt: t.created_at,
      responderId: 1130009360826,
      tags: t.tags,
      hasReplies: false,
      conversations: [],
    }));
  }

  if (!globalThis.__clinicConversationCache) {
    globalThis.__clinicConversationCache = new Map();
  }
  const conversationCache = globalThis.__clinicConversationCache;

  if (!globalThis.__clinicTicketsCache || globalThis.__clinicTicketsCache.length === 0) {
    globalThis.__clinicTicketsCache = getTicketsFromDisk();
    if (globalThis.__clinicTicketsCache.length > 0) {
      globalThis.__clinicTicketsCacheTime = Date.now() - 15_000;
    }
  }

  const now = Date.now();
  const cacheAge = now - (globalThis.__clinicTicketsCacheTime || 0);
  if (globalThis.__clinicTicketsCache && globalThis.__clinicTicketsCache.length > 0 && cacheAge < TICKETS_CACHE_TTL) {
    return globalThis.__clinicTicketsCache;
  }

  try {
    let tickets: any = null;
    try {
      tickets = await freshdeskRequest(`/tickets?order_by=updated_at&order_type=desc&per_page=${limit}&include=requester,stats`);
    } catch (reqErr: any) {
      const isDenied = reqErr?.message?.includes("denied ticket access") || reqErr?.message?.includes("403");
      if (!isDenied) {
        console.warn("Freshdesk fetch notice:", reqErr?.message || reqErr);
      }
      if (globalThis.__clinicTicketsCache && globalThis.__clinicTicketsCache.length > 0) {
        return globalThis.__clinicTicketsCache;
      }
      const diskFallback = getTicketsFromDisk();
      globalThis.__clinicTicketsCache = diskFallback;
      globalThis.__clinicTicketsCacheTime = Date.now();
      return diskFallback;
    }

    if (!Array.isArray(tickets)) {
      if (globalThis.__clinicTicketsCache && globalThis.__clinicTicketsCache.length > 0) {
        return globalThis.__clinicTicketsCache;
      }
      return getTicketsFromDisk();
    }

    const clinicTickets = (tickets || []).filter(isClinicalTicket);

    const enriched = await Promise.all(
      clinicTickets.map(async (t: any) => {
        let conversations: any[] = [];
        const hasRealReplies = Boolean(
          t.stats && (t.stats.agent_responded_at || t.stats.requester_responded_at || t.stats.first_responded_at)
        );

        if (hasRealReplies) {
          const cached = conversationCache.get(String(t.id));
          if (cached && cached.updatedAt === t.updated_at) {
            conversations = cached.conversations;
          } else {
            try {
              const convRes = await freshdeskRequest(`/tickets/${t.id}/conversations`);
              if (Array.isArray(convRes)) {
                conversations = convRes.map((c: any) => {
                  const rawMsg = (c.body_text || c.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                  const sentMatch = rawMsg.match(/— Sent by (.*?)(?:\n|$)/);
                  const sender = sentMatch ? sentMatch[1].trim() : (c.from_email || (c.incoming ? (t.requester?.name || "Patient / Doctor") : "Doctor / Staff"));
                  return {
                    id: String(c.id),
                    incoming: Boolean(c.incoming),
                    from: c.incoming ? (t.requester?.name || "Patient / Doctor") : sender,
                    message: rawMsg,
                    createdAt: c.created_at,
                  };
                });
              }
            } catch (convErr) {
              console.warn(`Could not load conversations for ticket #${t.id}:`, convErr instanceof Error ? convErr.message : convErr);
            }
            conversationCache.set(String(t.id), { updatedAt: t.updated_at, conversations });
          }
        }

        const requester = t.requester || {};
        const cleanBody = (t.description_text || t.description || "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const attendingDoctor = extractAttendingDoctor({
          subject: t.subject,
          description: t.description,
          description_text: t.description_text,
          message: cleanBody,
          tags: Array.isArray(t.tags) ? t.tags : [],
          conversations,
        });

        return {
          id: String(t.id),
          subject: t.subject || "Clinic Consultation",
          email: requester.email || t.email || "",
          name: requester.name || t.name || "Patient / Physician",
          status: Number(t.status || 2),
          priority: Number(t.priority || 1),
          message: cleanBody.slice(0, 500),
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          responderId: t.responder_id,
          tags: Array.isArray(t.tags) ? t.tags : [],
          hasReplies: hasRealReplies || conversations.length > 0,
          conversations,
          attendingDoctor,
        };
      })
    );

    // Synchronize Freshservice tickets and patient replies
    if (hasFreshserviceConfig()) {
      try {
        const fsRes = await freshserviceRequest("/tickets?order_by=updated_at&order_type=desc&per_page=30");
        const fsTickets: any[] = Array.isArray(fsRes?.tickets) ? fsRes.tickets : [];
        const normSubj = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

        const fsConvMap = new Map<number, any[]>();
        await Promise.all(
          fsTickets.slice(0, 15).map(async (fst: any) => {
            try {
              const cRes = await freshserviceRequest(`/tickets/${fst.id}/conversations`);
              if (Array.isArray(cRes?.conversations) && cRes.conversations.length > 0) {
                fsConvMap.set(fst.id, cRes.conversations);
              }
            } catch {}
          })
        );

        const matchedFsIds = new Set<number>();
        for (const t of enriched) {
          const matchingFs = fsTickets.find(
            (fst: any) =>
              normSubj(fst.subject) === normSubj(t.subject) ||
              (normSubj(t.subject).length > 15 && normSubj(fst.subject).includes(normSubj(t.subject)))
          );

          if (matchingFs) {
            matchedFsIds.add(matchingFs.id);
            (t as any).fsId = String(matchingFs.id);
            const fsConvs = fsConvMap.get(matchingFs.id) || [];
            for (const fsc of fsConvs) {
              const cleanText = (fsc.body_text || fsc.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
              const alreadyHas = (t.conversations || []).some((c: any) => c.message === cleanText);
              if (!alreadyHas && cleanText) {
                const sentMatch = cleanText.match(/— Sent by (.*?)(?:\n|$)/);
                const sender = sentMatch ? sentMatch[1].trim() : (fsc.incoming ? (matchingFs.requester?.name || t.name || "Patient") : "Doctor / Staff");
                t.conversations = t.conversations || [];
                t.conversations.push({
                  id: `fs_${fsc.id}`,
                  incoming: Boolean(fsc.incoming),
                  from: sender,
                  message: cleanText,
                  createdAt: fsc.created_at,
                });
                t.hasReplies = true;
              }
            }
          }
        }

        // Include standalone Freshservice tickets that have patient replies
        for (const fst of fsTickets) {
          if (!matchedFsIds.has(fst.id)) {
            const fsConvs = fsConvMap.get(fst.id) || [];
            const hasIncoming = fsConvs.some((c: any) => Boolean(c.incoming));
            if (hasIncoming || fsConvs.length > 0) {
              const cleanBody = (fst.description_text || fst.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
              enriched.push({
                id: `fs_${fst.id}`,
                fsId: String(fst.id),
                subject: fst.subject || "Clinic Consultation",
                email: fst.requester?.email || "",
                name: fst.requester?.name || "Patient",
                status: Number(fst.status || 2),
                priority: Number(fst.priority || 1),
                message: cleanBody.slice(0, 500),
                createdAt: fst.created_at,
                updatedAt: fst.updated_at,
                tags: Array.isArray(fst.tags) ? fst.tags : [],
                hasReplies: true,
                conversations: fsConvs.map((c: any) => {
                  const cText = (c.body_text || c.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                  const sentMatch = cText.match(/— Sent by (.*?)(?:\n|$)/);
                  const sender = sentMatch ? sentMatch[1].trim() : (c.incoming ? (fst.requester?.name || "Patient") : "Doctor / Staff");
                  return {
                    id: `fs_${c.id}`,
                    incoming: Boolean(c.incoming),
                    from: sender,
                    message: cText,
                    createdAt: c.created_at,
                  };
                }),
              } as any);
            }
          }
        }
      } catch (fsErr: any) {
        const isAuthErr = fsErr?.message?.includes("not authorized") || fsErr?.message?.includes("401") || fsErr?.message?.includes("403");
        if (!isAuthErr) {
          console.warn("Freshservice ticket sync notice:", fsErr instanceof Error ? fsErr.message : fsErr);
        }
      }
    }

    // Ensure all conversations are chronologically ordered (oldest first, newest last)
    for (const t of enriched) {
      if (Array.isArray(t.conversations) && t.conversations.length > 1) {
        t.conversations.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      }
    }

    globalThis.__clinicTicketsCache = enriched;
    globalThis.__clinicTicketsCacheTime = Date.now();
    saveTicketsToDisk(enriched);
    return enriched;
  } catch (err) {
    console.warn("Could not load Freshdesk tickets:", err);
    if (globalThis.__clinicTicketsCache && globalThis.__clinicTicketsCache.length > 0) {
      return globalThis.__clinicTicketsCache;
    }
    const disk = getTicketsFromDisk();
    if (disk.length > 0) {
      globalThis.__clinicTicketsCache = disk;
      return disk;
    }
    return localTickets.map(t => ({
      id: String(t.id),
      subject: t.subject,
      email: t.email,
      name: t.name,
      status: 2,
      priority: t.priority,
      message: t.description_text || t.description,
      createdAt: t.created_at,
      updatedAt: t.created_at,
      responderId: 1130009360826,
      tags: t.tags,
      hasReplies: false,
      conversations: [],
    }));
  }
}

export async function replyToFreshdeskTicket(ticketId: number | string, replyMessage: string) {
  const rawId = String(ticketId).trim();
  const isFreshservice = rawId.startsWith("fs_");
  const cleanId = rawId.replace(/^fs_/, "").replace(/[^0-9]/g, "");
  if (!cleanId) throw new Error("Invalid ticket ID for reply.");

  const senderMatch = replyMessage.match(/—\s*Sent by\s+(.*?)(?:\r?\n|$)/i)?.[1]?.trim() || "Attending Physician";
  const cleanReply = replyMessage.replace(/[\s\r\n]*—[\s\r\n]*Sent by[\s\S]*$/i, "").trim();
  const formattedBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6;"><p style="margin: 0 0 14px 0;">${escapeHtml(cleanReply).replace(/\n/g, "<br/>")}</p><p style="margin: 0; font-size: 13px; color: #0284c7; font-weight: 600;">— ${escapeHtml(senderMatch)} (Attending Physician)</p></div>`;

  // Look up cached ticket FIRST from memory or disk fallback
  const disk = getTicketsFromDisk();
  const allKnown = (globalThis.__clinicTicketsCache && globalThis.__clinicTicketsCache.length > 0)
    ? globalThis.__clinicTicketsCache
    : disk;
  const cached = (allKnown || []).find(
    (t: any) => String(t.id) === rawId || String(t.id) === cleanId || String(t.fsId) === cleanId
  );
  let fdId = isFreshservice ? (cached?.id && !cached.id.startsWith("fs_") ? cached.id : null) : cleanId;
  let fsId = isFreshservice ? cleanId : (cached?.fsId || null);

  const normSubj = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // If fsId wasn't found from cache, query matching Freshservice ticket by subject
  if (!fsId && hasFreshserviceConfig() && fdId) {
    try {
      const fdTicket = cached || await freshdeskRequest(`/tickets/${fdId}`);
      if (fdTicket?.subject) {
        const fsRes = await freshserviceRequest(`/tickets?order_by=updated_at&order_type=desc&per_page=30`);
        const matchingFs = (fsRes?.tickets || []).find((fst: any) =>
          normSubj(fst.subject) === normSubj(fdTicket.subject) ||
          (normSubj(fdTicket.subject).length > 15 && normSubj(fst.subject).includes(normSubj(fdTicket.subject)))
        );
        if (matchingFs) {
          fsId = String(matchingFs.id);
        }
      }
    } catch {}
  }

  // If fdId wasn't found from cache, query matching Freshdesk ticket by subject
  if (!fdId && hasFreshdeskConfig() && fsId) {
    try {
      const fsTicket = await freshserviceRequest(`/tickets/${fsId}`);
      const fsSubj = fsTicket?.ticket?.subject || fsTicket?.subject;
      if (fsSubj) {
        const fdRes = await freshdeskRequest(`/tickets?order_by=updated_at&order_type=desc&per_page=30`);
        const matchingFd = (Array.isArray(fdRes) ? fdRes : []).find((fdt: any) =>
          normSubj(fdt.subject) === normSubj(fsSubj) ||
          (normSubj(fsSubj).length > 15 && normSubj(fdt.subject).includes(normSubj(fsSubj)))
        );
        if (matchingFd) {
          fdId = String(matchingFd.id);
        }
      }
    } catch {}
  }

  let replyDelivered = false;
  let lastResult: any = null;
  let lastError: Error | null = null;

  // 1. Deliver reply to Freshdesk
  if (hasFreshdeskConfig() && fdId) {
    try {
      lastResult = await freshdeskRequest(`/tickets/${fdId}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: formattedBody }),
      });
      replyDelivered = true;
    } catch (fdErr) {
      lastError = fdErr instanceof Error ? fdErr : new Error(String(fdErr));
      console.warn(`Could not dispatch reply to Freshdesk #${fdId}:`, fdErr instanceof Error ? fdErr.message : fdErr);
    }
  }

  // 2. Deliver reply to Freshservice
  if (hasFreshserviceConfig()) {
    const targetFsId = fsId || (isFreshservice ? cleanId : null);
    if (targetFsId) {
      try {
        const fsRes = await freshserviceRequest(`/tickets/${targetFsId}/reply`, {
          method: "POST",
          body: JSON.stringify({ body: formattedBody }),
        });
        if (!lastResult) lastResult = fsRes;
        replyDelivered = true;
      } catch (fsErr) {
        if (!lastError) lastError = fsErr instanceof Error ? fsErr : new Error(String(fsErr));
        console.warn(`Could not dispatch reply to Freshservice #${targetFsId}:`, fsErr instanceof Error ? fsErr.message : fsErr);
      }
    }
  }

  // Invalidate cache AFTER dispatching replies so next load fetches latest dialogue
  invalidateTicketsCache();

  if (!replyDelivered) {
    if (!hasFreshdeskConfig() && !hasFreshserviceConfig()) {
      const existing = localTickets.find(t => String(t.id) === String(ticketId));
      if (existing) {
        existing.description_text += `\n[Staff Reply]: ${replyMessage}`;
      }
      return { id: Date.now(), simulated: true };
    }
    if (lastError) throw lastError;
    throw new Error("Unable to deliver reply to Freshdesk or Freshservice.");
  }

  return lastResult || { ok: true, message: "Reply delivered to patient via Freshworks." };
}

export async function searchFollowupTickets(tag: string) {
  if (hasFreshdeskConfig()) {
    try {
      const query = encodeURIComponent(`"tag:'${tag.replace(/'/g, "\\'")}'"`);
      return await freshdeskRequest(`/search/tickets?query=${query}`);
    } catch (e) {
      console.warn("Freshdesk search failed; returning local inbox tickets:", e instanceof Error ? e.message : e);
    }
  }

  // Return local tickets matching tag
  const matching = localTickets.filter(t => t.tags.includes(tag));
  return { results: matching };
}
