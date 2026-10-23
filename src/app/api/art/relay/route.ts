import { NextResponse } from "next/server";
import { recordHeartbeat, removeHeartbeat, getActiveUsernames } from "@/lib/presence";

export const runtime = "nodejs";

type RelayMessage = {
  id: string;
  event: string;
  from: string;
  to?: string;
  content: Record<string, unknown>;
  timestamp: number;
};

// In-memory message bus persisted across hot-reloads
declare global {
  var __clinicMessageQueue: RelayMessage[] | undefined;
}

globalThis.__clinicMessageQueue = (globalThis.__clinicMessageQueue ?? []).filter(
  m => m.event !== "appointment" && m.event !== "clinic_appointment"
);
const messageQueue: RelayMessage[] = (globalThis.__clinicMessageQueue ??= []);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const from = String(body.from || "").trim().toLowerCase();
    const to = body.to ? String(body.to).trim().toLowerCase() : undefined;
    const event = String(body.event || "clinic_chat");
    const content = body.content || {};
    const id = String(content.id || body.id || crypto.randomUUID());

    if (from) {
      if (body.type === "offline") {
        removeHeartbeat(from);
      } else {
        recordHeartbeat(from);
      }
    }

    // Do NOT store appointment alert notices in persistent broadcast relay
    if (event !== "clinic_presence" && event !== "appointment" && event !== "clinic_appointment") {
      const msg: RelayMessage = {
        id,
        event,
        from,
        to,
        content: { ...content, from, to, id },
        timestamp: Date.now(),
      };
      messageQueue.push(msg);
      if (messageQueue.length > 500) {
        messageQueue.splice(0, messageQueue.length - 300);
      }
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: "Relay failed" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username")?.trim().toLowerCase();
  const since = Number(url.searchParams.get("since") || "0");
  const now = Date.now();

  if (username) {
    recordHeartbeat(username);
  }

  // Filter messages for this user; never replay appointment alerts on connection
  const messages = messageQueue.filter(m => {
    if (m.timestamp <= since) return false;
    if (m.event === "appointment" || m.event === "clinic_appointment") return false;
    if (!m.to) return true; // broadcast
    return m.to === username || m.from === username;
  });

  return NextResponse.json({
    messages,
    activeUsers: getActiveUsernames(),
    timestamp: now,
  });
}
