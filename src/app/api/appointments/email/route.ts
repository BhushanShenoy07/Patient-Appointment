import { NextResponse } from "next/server";
import { listClinicDoctors, loadClinicAccounts, readClinicSession } from "@/lib/auth";
import { createAppointmentActionToken, createFollowupTicket, escapeHtml } from "@/lib/followups";
import { airtableRequest, COL, saveAirtableRecord } from "@/lib/airtable";
import { runClinicAgentTask } from "@/lib/adk-service";

export const runtime = "nodejs";

const normalizeDoc = (name?: string) =>
  (name || "")
    .trim()
    .toLowerCase()
    .replace(/^dr\.?\s*/, "")
    .replace(/[^a-z0-9]/g, "");

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in before sending appointment notifications." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
    const notifyDoctor = Boolean(body.notifyDoctor);

    // 1. Fetch fresh record details from Airtable
    let airtableFields: Record<string, any> = {};
    if (appointmentId && appointmentId.startsWith("rec")) {
      try {
        const airtableRecord = await airtableRequest(`/${appointmentId}`);
        if (airtableRecord?.fields) {
          airtableFields = airtableRecord.fields;
        }
      } catch (err) {
        console.warn("Could not query Airtable directly for email details; falling back to request payload:", err);
      }
    }

    // 2. Extract and merge fields with Airtable taking precedence
    const name = String(airtableFields[COL.name] || body.name || "").trim();
    const email = String(airtableFields[COL.email] || body.email || "").trim().toLowerCase();
    const phone = String(airtableFields[COL.phone] || body.phone || "").trim();
    const doctor = String(airtableFields[COL.doctor] || body.doctor || "").trim();
    const date = String(airtableFields[COL.date] || body.date || "").trim();
    const time = String(airtableFields[COL.time] || body.time || "").trim();
    const rawMode = String(airtableFields[COL.mode] || body.mode || "Online").trim();
    const mode = rawMode.toLowerCase() === "online" ? "Online" : "Offline";
    const status = String(airtableFields[COL.status] || body.status || "Scheduled").trim();
    const zoomId = String(airtableFields[COL.zoomId] || body.zoomId || "").trim();
    const zoomUrl = String(airtableFields[COL.zoomUrl] || body.zoomUrl || "").trim();
    const notes = String(airtableFields[COL.notes] || body.notes || "").trim();
    const bloodGroup = String(airtableFields[COL.bloodGroup] || body.bloodGroup || "").trim();

    // 3. Resolve Doctor account & email
    const clinicDoctors = listClinicDoctors();
    const allAccounts = loadClinicAccounts();
    const doctorAccount =
      clinicDoctors.find(d => normalizeDoc(d.name) === normalizeDoc(doctor)) ||
      allAccounts.find(a => normalizeDoc(a.doctorName || a.name) === normalizeDoc(doctor));

    const doctorEmail = (doctorAccount?.email || `${normalizeDoc(doctor)}@clinic.com`).trim().toLowerCase();

    // 4. Validate essential fields
    if (!appointmentId || !name || !/^\S+@\S+\.\S+$/.test(email) || !doctor || !date || !time) {
      return NextResponse.json(
        { error: "Appointment requires a patient name, valid email address, assigned physician, date, and time." },
        { status: 400 }
      );
    }

    if (session.role === "doctor" && session.doctorName && normalizeDoc(doctor) !== normalizeDoc(session.doctorName)) {
      return NextResponse.json({ error: "Physicians can only dispatch notifications for their own consultations." }, { status: 403 });
    }

    // 5. Generate secure patient action token
    const isCancelled = status.toLowerCase() === "cancelled";
    const token = !isCancelled
      ? createAppointmentActionToken({
          appointmentId,
          name,
          email,
          doctor,
          doctorEmail,
          date,
          time,
          mode,
          zoomId,
          zoomUrl,
        })
      : "";

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const actionUrl = (action: string) => {
      const url = new URL("/appointment-response", origin);
      url.searchParams.set("token", token);
      url.searchParams.set("action", action);
      return url.toString();
    };

    const safeName = escapeHtml(name);
    const safeDoctor = escapeHtml(doctor);
    const safeDate = escapeHtml(formatDisplayDate(date));
    const safeTime = escapeHtml(time);
    const isOnline = mode === "Online";
    const clinicAddress = process.env.CLINIC_ADDRESS || "Clinic Desk Healthcare Centre, Bejai, Mangaluru, Karnataka, India";

    // 6. Frame Kindful, Healthcare-Grade HTML Email Body
    let emailHtml = "";
    let emailSubject = "";

    if (isCancelled) {
      emailSubject = `Clinic Desk · Appointment Cancellation Notice · ${name} with ${doctor} · ${date}`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #475569 0%, #334155 100%); padding: 24px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Clinic Desk Healthcare</h1>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Appointment Cancellation Notice</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px; margin: 0 0 16px 0;">Dear <strong>${safeName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
              This is a gentle notification that your scheduled consultation with <strong>${safeDoctor}</strong> on <strong>${safeDate} at ${safeTime}</strong> has been cancelled in our clinic records.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 14px;">
              <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Reference ID:</strong> ${escapeHtml(appointmentId)}</p>
              <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Physician:</strong> ${safeDoctor}</p>
              <p style="margin: 0; color: #64748b;"><strong>Original Time:</strong> ${safeDate} at ${safeTime}</p>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
              We understand that plans can change. Whenever you are ready to reschedule or need medical assistance, our clinic desk is here to welcome you.
            </p>
            <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0;">
              Wishing you good health and well-being,<br/>
              <strong>Clinic Desk Healthcare Team</strong>
            </p>
          </div>
        </div>
      `;
    } else {
      emailSubject = `Clinic Desk · ${isOnline ? "Telehealth Consultation" : "In-Person Consultation"} Confirmed · ${name} with ${doctor} · ${date}`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #0f172a; border-radius: 16px; padding: 20px; color: #f8fafc;">
          <!-- Chat Header -->
          <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 16px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%); display: inline-flex; align-items: center; justify-content: center; font-size: 20px; color: #ffffff; text-align: center; line-height: 40px;">
              🩺
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 2px;">
                ${safeDoctor}
              </div>
              <div style="font-size: 12px; color: #94a3b8;">
                Consultant Physician · Clinic Desk Live Connect
              </div>
            </div>
          </div>

          <!-- Chat Message Bubble -->
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 14px; border-top-left-radius: 4px; padding: 16px; color: #f1f5f9; font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
            <p style="margin: 0 0 10px 0; font-size: 14.5px;">
              Hello <strong>${safeName}</strong>! Your consultation is confirmed. Here is your appointment card:
            </p>

            <!-- Appointment Card Block (Styled like Live Connect chat card) -->
            <div style="background: #0f172a; border: 1px solid #38bdf8; border-radius: 10px; padding: 14px; margin: 12px 0;">
              <div style="font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px; margin-bottom: 4px;">
                ● APPOINTMENT CONFIRMED
              </div>
              <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">
                ${safeName} · ${isOnline ? "Online Telehealth Consultation" : "In-Person Clinic Visit"}
              </div>
              <div style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6;">
                📅 <strong>Date:</strong> ${safeDate}<br/>
                ⏰ <strong>Time:</strong> ${safeTime}<br/>
                🩺 <strong>Physician:</strong> ${safeDoctor}<br/>
                ${phone ? `📞 <strong>Phone:</strong> ${escapeHtml(phone)}<br/>` : ""}
                ${notes ? `📝 <strong>Clinical Reason:</strong> ${escapeHtml(notes)}<br/>` : ""}
              </div>

              ${isOnline ? `
                <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #334155; text-align: center;">
                  <a href="${escapeHtml(zoomUrl || `https://zoom.us/j/${zoomId}?pwd=CLINIC`)}" style="background: #0284c7; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block;" target="_blank">
                    🎥 Join Telehealth Video Consultation
                  </a>
                  <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
                    Meeting ID: ${escapeHtml(zoomId || "Live Link")} · Passcode: CLINIC
                  </div>
                </div>
              ` : `
                <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 12.5px; color: #cbd5e1;">
                  📍 <strong>Clinic Location:</strong> ${escapeHtml(clinicAddress)}
                </div>
              `}
            </div>

            <!-- Quick Action Chips -->
            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 8px; flex-wrap: wrap;">
              <a href="${actionUrl("confirm")}" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-decoration: none;">
                ✓ Confirm Attendance
              </a>
              <a href="${actionUrl("reschedule")}" style="background: rgba(14, 165, 233, 0.2); border: 1px solid #0ea5e9; color: #38bdf8; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-decoration: none;">
                ↻ Request Reschedule
              </a>
              <a href="${actionUrl("cancel")}" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-decoration: none;">
                ✕ Cancel Visit
              </a>
            </div>

            <div style="margin-top: 10px; font-size: 11px; color: #64748b; text-align: right;">
              ${safeTime} · Delivered via Clinic Desk
            </div>
          </div>

          <!-- Chat Reply Prompt -->
          <div style="text-align: center; padding-top: 8px; font-size: 12px; color: #94a3b8;">
            💬 <em>Reply directly to this email to chat with Dr. ${safeDoctor} & clinic care team</em>
          </div>
        </div>
      `;
    }

    // 7. Dispatch Patient Notification Ticket (Freshdesk emails Patient as Requester)
    const patientTicket = await createFollowupTicket({
      email,
      name,
      ccEmails: [],
      subject: emailSubject,
      description: emailHtml,
      priority: 2,
      tags: [
        isCancelled ? "clinic_appointment_cancelled" : "clinic_appointment",
        mode.toLowerCase(),
        `appointment_${appointmentId}`,
        "patient_notification",
      ],
    });

    // 7b. Dispatch to ART Multiagent ("Patient Appointment Automation Agent multiagent")
    let agentExecution: any = null;
    try {
      agentExecution = await runClinicAgentTask({
        action: isCancelled ? "cancel_appointment" : "create_appointment",
        patientName: name,
        patientEmail: email,
        doctor,
        date,
        time,
        mode,
        zoomUrl,
        zoomId,
        notes,
        appointmentId,
      });
    } catch (agentErr) {
      console.warn("ART Multiagent task execution notice:", agentErr);
    }

    // Auto-fill Ticket ID in Airtable as soon as email is sent
    if (appointmentId && patientTicket?.id) {
      try {
        await saveAirtableRecord(appointmentId, {
          [COL.ticketId]: String(patientTicket.id),
        });
      } catch (ticketSaveErr) {
        console.warn("Could not auto-fill Ticket ID in Airtable appointment:", ticketSaveErr);
      }
    }

    // 8. Dispatch Doctor Notification Ticket ONLY when requested (e.g. receptionist clicked "Notify Doctor")
    let doctorTicket: any = null;
    if (notifyDoctor && doctorEmail && doctorEmail.toLowerCase() !== email.toLowerCase()) {
      try {
        const doctorSubject = isCancelled
          ? `Clinic Desk · Consultation Cancelled · Patient: ${name} · ${date}`
          : `Clinic Desk · New Consultation Scheduled · Patient: ${name} (${mode}) · ${date} at ${time}`;

        const doctorEmailHtml = isCancelled
          ? `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #475569 0%, #334155 100%); padding: 24px; color: #ffffff; text-align: center;">
                <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Clinic Desk Healthcare</h1>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Physician Notice: Consultation Cancelled</p>
              </div>
              <div style="padding: 24px;">
                <p style="font-size: 16px; margin: 0 0 16px 0;">Dear <strong>${safeDoctor}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                  This is to notify you that the consultation with patient <strong>${safeName}</strong> scheduled for <strong>${safeDate} at ${safeTime}</strong> has been cancelled. Your schedule slot has been updated and released.
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 14px;">
                  <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Patient:</strong> ${safeName}</p>
                  <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Patient Email:</strong> ${email}</p>
                  ${phone ? `<p style="margin: 0 0 6px 0; color: #64748b;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
                  <p style="margin: 0; color: #64748b;"><strong>Cancelled Slot:</strong> ${safeDate} at ${safeTime}</p>
                </div>
                <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0;">
                  Best regards,<br/>
                  <strong>Clinic Desk Scheduling System</strong>
                </p>
              </div>
            </div>
          `
          : `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #0f172a; border-radius: 16px; padding: 20px; color: #f8fafc;">
              <!-- Chat Header -->
              <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 16px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); display: inline-flex; align-items: center; justify-content: center; font-size: 20px; color: #ffffff; text-align: center; line-height: 40px;">
                  📋
                </div>
                <div>
                  <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 2px;">
                    Clinic Reception Desk
                  </div>
                  <div style="font-size: 12px; color: #94a3b8;">
                    Live Connect Schedule Alert · ${safeDoctor}
                  </div>
                </div>
              </div>

              <!-- Chat Message Bubble -->
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 14px; border-top-left-radius: 4px; padding: 16px; color: #f1f5f9; font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
                <p style="margin: 0 0 10px 0; font-size: 14.5px;">
                  Hello <strong>${safeDoctor}</strong>, a new consultation has been booked on your calendar:
                </p>

                <!-- Appointment Card Block (Styled like Live Connect chat card) -->
                <div style="background: #0f172a; border: 1px solid #10b981; border-radius: 10px; padding: 14px; margin: 12px 0;">
                  <div style="font-size: 11px; font-weight: 800; color: #10b981; letter-spacing: 0.5px; margin-bottom: 4px;">
                    ● NEW CONSULTATION SCHEDULED
                  </div>
                  <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">
                    ${safeName} · ${isOnline ? "Online Telehealth Consultation" : "In-Person Clinic Visit"}
                  </div>
                  <div style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6;">
                    📅 <strong>Date:</strong> ${safeDate}<br/>
                    ⏰ <strong>Time:</strong> ${safeTime}<br/>
                    👤 <strong>Patient:</strong> ${safeName} (${email})<br/>
                    ${phone ? `📞 <strong>Phone:</strong> ${escapeHtml(phone)}<br/>` : ""}
                    ${bloodGroup ? `🩸 <strong>Blood Group:</strong> ${escapeHtml(bloodGroup)}<br/>` : ""}
                    ${notes ? `📝 <strong>Clinical Reason:</strong> ${escapeHtml(notes)}<br/>` : ""}
                  </div>

                  ${isOnline ? `
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #334155; text-align: center;">
                      <a href="${escapeHtml(zoomUrl || `https://zoom.us/j/${zoomId}?pwd=CLINIC`)}" style="background: #10b981; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block;" target="_blank">
                        🎥 Launch Physician Consultation Room (Zoom)
                      </a>
                      <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
                        Meeting ID: ${escapeHtml(zoomId || "Live Link")} · Passcode: CLINIC
                      </div>
                    </div>
                  ` : `
                    <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 12.5px; color: #cbd5e1;">
                      📍 <strong>OPD Room:</strong> Main Clinic Consultation Suite (${escapeHtml(clinicAddress)})
                    </div>
                  `}
                </div>

                <div style="margin-top: 10px; font-size: 11px; color: #64748b; text-align: right;">
                  ${safeTime} · Delivered via Clinic Desk
                </div>
              </div>

              <!-- Chat Reply Prompt -->
              <div style="text-align: center; padding-top: 8px; font-size: 12px; color: #94a3b8;">
                💬 <em>Reply directly to this email to send a care note or prescription update to ${safeName}</em>
              </div>
            </div>
          `;

        doctorTicket = await createFollowupTicket({
          email: doctorEmail,
          name: doctor,
          ccEmails: [],
          subject: doctorSubject,
          description: doctorEmailHtml,
          priority: 2,
          tags: [
            isCancelled ? "clinic_appointment_cancelled" : "clinic_appointment",
            mode.toLowerCase(),
            `appointment_${appointmentId}`,
            "doctor_notification",
          ],
        });
      } catch (docErr) {
        console.warn("Could not dispatch doctor notification ticket:", docErr);
      }
    }

    return NextResponse.json({
      ok: true,
      patientTicketId: patientTicket.id,
      doctorTicketId: doctorTicket?.id || null,
      patientEmail: email,
      doctorEmail,
      mode,
      hasZoom: isOnline && Boolean(zoomUrl || zoomId),
      freshserviceTicketId: (patientTicket as any).freshserviceTicketId,
      agentExecution,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not dispatch appointment email.";
    console.error("Appointment email route error:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
