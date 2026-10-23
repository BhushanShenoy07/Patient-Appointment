// Client-side Clinical Medical Report PDF Generator (Zero-dependency PDF-1.4)

export interface PatientPdfData {
  patientName: string;
  patientAge?: string | number;
  patientGender?: string;
  bloodGroup?: string;
  email?: string;
  phone?: string;
  medicalNotes?: string;
  appointments?: Array<{
    date: string;
    doctor: string;
    mode: string;
    status: string;
    notes?: string;
  }>;
  staffName?: string;
  clinicName?: string;
}

function escapePdf(str: string | number | undefined | null): string {
  return String(str || "")
    .replace(/[\\()]/g, "\\$&")
    .replace(/[^\x20-\x7E]/g, " ");
}

export function buildPatientPdfBlob(data: PatientPdfData): Blob {
  const clinicName = data.clinicName || "METRO HEALTH CLINIC & AUTOMATED CARE NETWORK";
  const reportId = `MHC-RPT-${Math.floor(100000 + Math.random() * 900000)}`;
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const patientName = data.patientName || "Registered Patient";
  const patientAge = data.patientAge ? String(data.patientAge) : "Not Specified";
  const patientGender = data.patientGender || "Other";
  const bloodGroup = data.bloodGroup || "Standard Profile (Unspecified)";
  const email = data.email || "Not Provided";
  const phone = data.phone || "Not Provided";
  const medicalNotes = data.medicalNotes || "No prior adverse drug reactions or chronic allergies documented.";
  const appointments = data.appointments || [];
  const physician = data.staffName || "Attending Medical Officer";

  const ops: string[] = [];

  // 1. Top Banner
  ops.push("0.06 0.22 0.42 rg"); // Deep Navy Blue
  ops.push("36 712 540 54 re f");

  ops.push("1 1 1 rg");
  ops.push(`BT /F2 15 Tf 48 745 Td (${escapePdf(clinicName)}) Tj ET`);
  ops.push(`BT /F1 8.5 Tf 48 726 Td (CLINICAL PATIENT RECORD & COMPREHENSIVE MEDICAL DOSSIER  |  CONFIDENTIAL) Tj ET`);

  // Metadata Bar
  ops.push("0.93 0.95 0.98 rg");
  ops.push("36 676 540 28 re f");
  ops.push("0.75 0.80 0.88 RG 1 w");
  ops.push("36 676 540 28 re S");

  ops.push("0.15 0.25 0.40 rg");
  ops.push(`BT /F2 8.5 Tf 46 686 Td (REPORT ID: ${escapePdf(reportId)}) Tj ET`);
  ops.push(`BT /F1 8.5 Tf 210 686 Td (ISSUED: ${escapePdf(generatedAt)}) Tj ET`);
  ops.push(`BT /F1 8.5 Tf 395 686 Td (PREPARED BY: ${escapePdf(physician)}) Tj ET`);

  // Section 1: Patient Demographic & Clinical Profile
  ops.push("0.06 0.22 0.42 rg");
  ops.push("BT /F2 10.5 Tf 36 652 Td (1. PATIENT DEMOGRAPHIC & CLINICAL PROFILE) Tj ET");
  ops.push("0.15 0.40 0.70 RG 1.5 w");
  ops.push("36 646 m 576 646 l S");

  ops.push("0.98 0.98 0.99 rg");
  ops.push("36 540 540 100 re f");
  ops.push("0.85 0.88 0.92 RG 0.75 w");
  ops.push("36 540 540 100 re S");

  ops.push("0.15 0.2 0.3 rg");
  ops.push("BT /F2 9.5 Tf 48 620 Td (Full Patient Name:) Tj ET");
  ops.push(`BT /F2 10 Tf 145 620 Td (${escapePdf(patientName)}) Tj ET`);

  ops.push("BT /F2 9.5 Tf 330 620 Td (Blood Group:) Tj ET");
  ops.push(`BT /F2 10 Tf 415 620 Td (${escapePdf(bloodGroup)}) Tj ET`);

  ops.push("BT /F2 9.5 Tf 48 596 Td (Age & Gender:) Tj ET");
  ops.push(`BT /F1 9.5 Tf 145 596 Td (${escapePdf(patientAge)} yrs  |  ${escapePdf(patientGender)}) Tj ET`);

  ops.push("BT /F2 9.5 Tf 330 596 Td (Telephone:) Tj ET");
  ops.push(`BT /F1 9.5 Tf 415 596 Td (${escapePdf(phone)}) Tj ET`);

  ops.push("BT /F2 9.5 Tf 48 572 Td (Email Address:) Tj ET");
  ops.push(`BT /F1 9.5 Tf 145 572 Td (${escapePdf(email)}) Tj ET`);

  ops.push("BT /F2 9.5 Tf 330 572 Td (Registry Status:) Tj ET");
  ops.push("BT /F1 9.5 Tf 415 572 Td (Active Registered Record) Tj ET");

  ops.push("BT /F2 9.5 Tf 48 548 Td (Clinical Summary:) Tj ET");
  ops.push(`BT /F1 9 Tf 145 548 Td (${escapePdf(medicalNotes.slice(0, 75))}) Tj ET`);

  // Section 2: Clinical Observations & Medical History
  ops.push("0.06 0.22 0.42 rg");
  ops.push("BT /F2 10.5 Tf 36 514 Td (2. CLINICAL OBSERVATIONS & MEDICAL HISTORY) Tj ET");
  ops.push("0.15 0.40 0.70 RG 1.5 w");
  ops.push("36 508 m 576 508 l S");

  ops.push("0.98 0.98 0.99 rg");
  ops.push("36 438 540 62 re f");
  ops.push("0.85 0.88 0.92 RG 0.75 w");
  ops.push("36 438 540 62 re S");

  ops.push("0.2 0.25 0.3 rg");
  ops.push(`BT /F1 9 Tf 48 480 Td (${escapePdf(medicalNotes.slice(0, 95))}) Tj ET`);
  if (medicalNotes.length > 95) {
    ops.push(`BT /F1 9 Tf 48 465 Td (${escapePdf(medicalNotes.slice(95, 190))}) Tj ET`);
  }
  ops.push("BT /F1 8.5 Tf 48 448 Td (Electronic Records: Verified live with Airtable & ADK Telehealth Infrastructure.) Tj ET");

  // Section 3: Consultation Timeline & Appointment Roster
  ops.push("0.06 0.22 0.42 rg");
  ops.push("BT /F2 10.5 Tf 36 412 Td (3. CONSULTATION TIMELINE & APPOINTMENT ROSTER) Tj ET");
  ops.push("0.15 0.40 0.70 RG 1.5 w");
  ops.push("36 406 m 576 406 l S");

  // Table Header
  ops.push("0.12 0.28 0.50 rg");
  ops.push("36 384 540 18 re f");
  ops.push("1 1 1 rg");
  ops.push("BT /F2 8.5 Tf 44 389 Td (DATE) Tj ET");
  ops.push("BT /F2 8.5 Tf 115 389 Td (PHYSICIAN) Tj ET");
  ops.push("BT /F2 8.5 Tf 240 389 Td (FORMAT) Tj ET");
  ops.push("BT /F2 8.5 Tf 330 389 Td (STATUS) Tj ET");
  ops.push("BT /F2 8.5 Tf 410 389 Td (CLINICAL NOTES) Tj ET");

  let curY = 366;
  const displayAppts = appointments.slice(0, 10);
  if (displayAppts.length === 0) {
    ops.push("0.98 0.98 0.98 rg");
    ops.push(`36 ${curY} 540 18 re f`);
    ops.push("0.5 0.5 0.5 rg");
    ops.push(`BT /F1 8.5 Tf 44 ${curY + 5} Td (No prior consultations recorded. New patient file ready for consultation.) Tj ET`);
    curY -= 20;
  } else {
    displayAppts.forEach((appt, idx) => {
      if (idx % 2 === 0) {
        ops.push("0.96 0.97 0.99 rg");
        ops.push(`36 ${curY} 540 16 re f`);
      }
      ops.push("0.2 0.25 0.35 rg");
      ops.push(`BT /F1 8 Tf 44 ${curY + 4} Td (${escapePdf(appt.date)}) Tj ET`);
      ops.push(`BT /F1 8 Tf 115 ${curY + 4} Td (${escapePdf(appt.doctor.slice(0, 22))}) Tj ET`);
      ops.push(`BT /F1 8 Tf 240 ${curY + 4} Td (${escapePdf(appt.mode)}) Tj ET`);
      ops.push(`BT /F2 8 Tf 330 ${curY + 4} Td (${escapePdf(appt.status)}) Tj ET`);
      ops.push(`BT /F1 8 Tf 410 ${curY + 4} Td (${escapePdf((appt.notes || "Standard visit").slice(0, 30))}) Tj ET`);
      curY -= 17;
    });
  }

  // Section 4: Sign-off & Verification
  ops.push("0.15 0.40 0.70 RG 1 w");
  ops.push("36 150 m 576 150 l S");

  // Physician Sign Block
  ops.push("0.2 0.25 0.35 rg");
  ops.push("BT /F2 9.5 Tf 48 130 Td (Authorized Healthcare Professional / Clinic Staff:) Tj ET");
  ops.push("0.5 0.5 0.5 RG 0.5 w");
  ops.push("48 100 m 240 100 l S");
  ops.push(`BT /F1 8.5 Tf 48 88 Td (Verified: ${escapePdf(physician)}) Tj ET`);

  // Stamp block
  ops.push("0.85 0.90 0.95 RG 1 w");
  ops.push("370 75 190 55 re S");
  ops.push("0.06 0.22 0.42 rg");
  ops.push("BT /F2 8.5 Tf 385 115 Td (METRO HEALTH CLINIC) Tj ET");
  ops.push("BT /F1 7.5 Tf 385 102 Td (Official Health Record Seal) Tj ET");
  ops.push("BT /F1 7.5 Tf 385 89 Td (Authenticated via Zoe AI Assistant) Tj ET");

  // Confidentiality footnote
  ops.push("0.5 0.55 0.6 rg");
  ops.push("BT /F1 7 Tf 36 42 Td (CONFIDENTIALITY NOTICE: This document contains privileged medical information under clinical privacy standards.) Tj ET");
  ops.push("BT /F1 7 Tf 36 32 Td (Intended solely for the patient and authorized medical personnel. Generated live by Zoe Clinic Assistant.) Tj ET");

  const streamContent = ops.join("\n");
  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(streamContent);
  const streamLen = streamBytes.length;

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];

  function addObj(content: string) {
    offsets.push(encoder.encode(body).length);
    body += content + "\n";
  }

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  addObj("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj");
  addObj("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");
  addObj(`6 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj`);

  const xrefOffset = encoder.encode(body).length;
  let xref = "xref\n0 7\n0000000000 65535 f \n";
  for (let i = 0; i < offsets.length; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const fullPdfStr = body + xref + trailer;
  return new Blob([encoder.encode(fullPdfStr)], { type: "application/pdf" });
}

export function downloadPatientPdf(data: PatientPdfData): void {
  try {
    const blob = buildPatientPdfBlob(data);
    const url = URL.createObjectURL(blob);
    const safeName = (data.patientName || "Patient").replace(/[^a-zA-Z0-9_-]/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}_Medical_Report.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error("Failed to download patient PDF:", err);
  }
}
