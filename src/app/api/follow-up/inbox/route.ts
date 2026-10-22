import { NextResponse } from "next/server";
import { readClinicSession, sameDoctor } from "@/lib/auth";
import { getClinicTicketsWithConversations, invalidateTicketsCache, replyToFreshdeskTicket } from "@/lib/followups";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view clinic communications." }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true") {
      invalidateTicketsCache();
    }
    const updates = await getClinicTicketsWithConversations(50);

    const docName = String(session.doctorName || "").toLowerCase().replace(/^dr\.?\s*/, "").trim();
    const docEmail = String(session.email || "").toLowerCase().trim();

    const filteredUpdates = session.role === "doctor"
      ? updates
          .filter(u => {
            // 1. Exclude outgoing copies sent to the doctor himself
            if (u.tags?.includes("doctor_notification") || u.email.toLowerCase() === docEmail) {
              return false;
            }

            // 2. Doctor relevance: must strictly pertain to this specific doctor
            if (u.attendingDoctor) {
              if (!sameDoctor(u.attendingDoctor, session.doctorName)) {
                return false;
              }
            } else {
              const text = `${u.subject} ${u.message} ${(u.tags || []).join(" ")}`.toLowerCase();
              const convMatch = (u.conversations || []).some((c: { from?: string; message?: string }) =>
                (c.from || "").toLowerCase().includes(docName) ||
                (c.message || "").toLowerCase().includes(docName) ||
                (c.from || "").toLowerCase().includes(docEmail)
              );
              const matchesDoctor = (docName && text.includes(docName)) || (docEmail && text.includes(docEmail)) || convMatch;
              if (!matchesDoctor) return false;
            }

            return true;
          })
          .map(u => {
            // Ensure patient message is highlighted when replies exist
            const patientReplies = (u.conversations || []).filter((c: { incoming?: boolean; from?: string; message?: string }) =>
              Boolean(c.incoming) ||
              (c.from &&
                !c.from.toLowerCase().includes("reception") &&
                !c.from.toLowerCase().includes("support@") &&
                !c.from.toLowerCase().includes(docEmail) &&
                !c.from.toLowerCase().includes(docName))
            );
            if (patientReplies.length > 0) {
              const latest = patientReplies[patientReplies.length - 1];
              return {
                ...u,
                message: latest.message || u.message,
                hasReplies: true,
              };
            }
            return u;
          })
      : updates.filter(u => !u.tags?.includes("doctor_notification") && u.email.toLowerCase() !== docEmail);
    return NextResponse.json({ ok: true, updates: filteredUpdates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load clinic communications.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to dispatch clinic messages." }, { status: 401 });
  if (session.role !== "doctor") {
    return NextResponse.json({ error: "Clinical care replies may only be dispatched by physicians. Reception desk has view-only access." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const ticketId = String(body.ticketId || "").trim();
    const message = String(body.message || "").trim();

    if (!ticketId || !message) {
      return NextResponse.json({ error: "Ticket ID and reply content are required." }, { status: 400 });
    }

    const doctorTitle = session.doctorName || "Attending Physician";
    const formattedMessage = `${message}\n\n— Sent by ${doctorTitle}`;

    const res = await replyToFreshdeskTicket(ticketId, formattedMessage);
    return NextResponse.json({ ok: true, id: res?.id, message: "Reply successfully delivered via Freshdesk." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispatch reply.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
