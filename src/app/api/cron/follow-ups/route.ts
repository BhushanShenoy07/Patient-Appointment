import { NextResponse } from "next/server";
import { listAirtableRecords, saveAirtableRecord } from "@/lib/airtable";
import { createFollowupTicket, createFollowupToken, escapeHtml, searchFollowupTickets } from "@/lib/followups";

export const runtime = "nodejs";

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized scheduler request." }, { status: 401 });
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const records = await listAirtableRecords();
    const now = Date.now();
    let sent = 0;
    for (const record of records) {
      const f = record.fields || {};
      if (!f["Appointment Date"] || !f["Appointment Time"] || !f["Patient Email"] || !f["Patient Name"] || !f.Doctor || ["cancelled"].includes(String(f.Status || "").toLowerCase())) continue;
      const match = String(f["Appointment Time"]).match(/^(\d{1,2}):(\d{2})/);
      if (!match) continue;
      const end = new Date(`${f["Appointment Date"]}T${String(match[1]).padStart(2, "0")}:${match[2]}:00+05:30`).getTime() + 30 * 60_000;
      if (now < end) continue;
      const startDay = String(f["Follow-up Start"] || new Date(end).toISOString().slice(0, 10));
      const day = Number(f["Follow-up Day"] || 0);
      const dueDay = Math.floor((now - end) / (24 * 60 * 60_000)) + 1;
      const nextDay = Math.max(day + 1, 1);
      if (nextDay > 7 || nextDay > dueDay) continue;
      const appointmentId = String(record.id);
      const tag = `appointment_${appointmentId}_day_${nextDay}`;
      const prior = await searchFollowupTickets(tag);
      if (!(prior.results || []).some((ticket: any) => (ticket.tags || []).includes(tag))) {
        const name = String(f["Patient Name"]), email = String(f["Patient Email"]), doctor = String(f.Doctor);
        const feedbackToken = createFollowupToken({ name, email, doctor, appointmentId });
        const feedbackUrl = new URL("/patient-feedback", origin); feedbackUrl.searchParams.set("token", feedbackToken);
        await createFollowupTicket({ email, name, subject: `Clinic Desk · Day ${nextDay} health check for ${name}`, tags: ["clinic_followup", `appointment_${appointmentId}`, tag], description: `<p>Hello ${escapeHtml(name)},</p><p>This is your day ${nextDay} check-in after your visit with ${escapeHtml(doctor)}. We hope you are recovering well. Please share how you are feeling and rate your care. You can reply to this email or use the secure link below.</p><p><a href="${feedbackUrl.toString()}">Share your health update and rate your care</a></p><p>If your health has suddenly worsened or you need urgent help, contact your doctor or local emergency services now.</p><p>Warm regards,<br>Clinic Desk care team</p>` });
        // Follow-up ticket sent successfully
        sent++;
      }
    }
    return NextResponse.json({ ok: true, processed: records.length, sent });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send scheduled follow-ups." }, { status: 502 }); }
}
