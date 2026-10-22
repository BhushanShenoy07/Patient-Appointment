import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import {
  executeClinicMultiAgent,
  executeArtAgent,
  ART_AGENTS,
  MULTIAGENT_CAPABILITIES,
  type ArtAgentType,
} from "@/lib/adk-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in to execute ART Agent tasks." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const agent = (body.agent || "multi") as ArtAgentType;
    const prompt = String(body.prompt || "").trim();

    // If multiagent is triggered (the primary way requested by the user):
    if (agent === "multi" || agent === ART_AGENTS.multi) {
      const generatedPrompt =
        prompt ||
        `[CLINIC_AUTOMATION_EVENT]
Target: Patient Appointment Automation Agent multiagent (${ART_AGENTS.multi})
Action: ${body.action || "Process Appointment Pipeline"}
Patient: ${body.patientName || "Patient"} (${body.patientEmail || "N/A"})
Doctor: ${body.doctor || "Physician"}
Slot: ${body.date || "Scheduled Date"} at ${body.time || "Scheduled Time"} (${body.mode || "Online"})
Zoom: ${body.zoomUrl || "None"}
Notes: ${body.notes || "None"}

Please coordinate with connected capabilities:
1. Freshdesk Agent: Notify patient and physician.
2. Zoom Agent: Prepare video room if Online.
3. Google Calendar Agent: Schedule consultation slot.
4. Airtable Agent: Synchronize appointment record.`;

      const result = await executeClinicMultiAgent(generatedPrompt, {
        action: body.action,
        patientName: body.patientName,
        patientEmail: body.patientEmail,
        doctor: body.doctor,
        date: body.date,
        time: body.time,
        mode: body.mode,
        zoomUrl: body.zoomUrl,
        zoomId: body.zoomId,
        notes: body.notes,
        appointmentId: body.appointmentId,
      });

      return NextResponse.json({
        ok: true,
        agent: "multi",
        agentId: ART_AGENTS.multi,
        agentName: "Patient Appointment Automation Agent multiagent",
        execution: result,
      });
    }

    // Otherwise single agent execution
    if (!prompt) {
      return NextResponse.json({ error: "Prompt instruction is required." }, { status: 400 });
    }

    const singleResult = await executeArtAgent(agent, prompt);

    return NextResponse.json({
      ok: singleResult.ok,
      agent,
      agentId: ART_AGENTS[agent] || agent,
      result: singleResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ART Agent execution notice";
    console.error("Agent execute route error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agents: ART_AGENTS,
    capabilities: MULTIAGENT_CAPABILITIES,
    multiAgentId: ART_AGENTS.multi,
    multiAgentName: "Patient Appointment Automation Agent multiagent",
  });
}
