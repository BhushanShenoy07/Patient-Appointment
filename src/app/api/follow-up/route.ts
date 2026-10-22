import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { createFollowupTicket, createFollowupToken, escapeHtml } from "@/lib/followups";
import { airtableRequest, saveAirtableRecord } from "@/lib/airtable";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to send a follow-up." }, { status: 401 });
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const doctor = typeof body.doctor === "string" ? body.doctor.trim() : "";
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !doctor || !appointmentId || body.status !== "Completed") {
      return NextResponse.json({ error: "A completed appointment with patient email and doctor is required." }, { status: 400 });
    }
    if (session.role === "doctor" && doctor.toLowerCase() !== session.doctorName?.toLowerCase()) {
      return NextResponse.json({ error: "You can only follow up with patients from your own appointments." }, { status: 403 });
    }
    let priorRecord: any = null;
    try {
      priorRecord = await airtableRequest(`/${encodeURIComponent(appointmentId)}`);
    } catch {
      priorRecord = null;
    }
    const existingDay = Number(priorRecord?.fields?.["Follow-up Day"] || 0);
    if (existingDay >= 7) return NextResponse.json({ error: "The seven daily follow-up emails have already been sent." }, { status: 409 });
    const nextDay = existingDay + 1;
    const token = createFollowupToken({ name, email, doctor, appointmentId });
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const feedbackUrl = new URL("/patient-feedback", origin);
    feedbackUrl.searchParams.set("token", token);
    const ticket = await createFollowupTicket({
      email,
      name,
      subject: `Clinic Desk · Day ${nextDay} health check for ${name}`,
      tags: ["clinic_followup", `appointment_${appointmentId}`, `appointment_${appointmentId}_day_${nextDay}`],
      description: `<p>Hello ${escapeHtml(name)},</p><p>This is your day ${nextDay} check-in after your visit with ${escapeHtml(doctor)}. We hope you are recovering well. Please share how you are feeling and rate your care. You can reply to this email or use the secure link below.</p><p><a href="${feedbackUrl.toString()}">Share your health update and rate your care</a></p><p>If your health has suddenly worsened or you need urgent help, contact your doctor or local emergency services now.</p><p>Warm regards,<br>Clinic Desk care team</p>`,
    });
    const updatePayload: Record<string, any> = {};
    if (!priorRecord?.fields?.["Ticket ID"] && ticket?.id) {
      updatePayload["Ticket ID"] = String(ticket.id);
    }
    if (Object.keys(updatePayload).length > 0) {
      await saveAirtableRecord(appointmentId, updatePayload);
    }
    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the patient follow-up.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
