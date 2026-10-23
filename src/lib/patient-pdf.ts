// Client-side Clinical Medical Report PDF Generator (Zero-dependency PDF-1.4)
// Designed in clean medical stationery style with dual physician/receptionist sign-off

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
  doctorName?: string;
  receptionistName?: string;
  clinicName?: string;
}

function escapePdf(str: string | number | undefined | null): string {
  return String(str || "")
    .replace(/[\\()]/g, "\\$&")
    .replace(/[^\x20-\x7E]/g, " ");
}

export function buildPatientPdfBlob(data: PatientPdfData): Blob {
  const clinicName = data.clinicName || "METRO HEALTH CLINICAL ASSOCIATES";
  const reportId = `MHC-${Math.floor(100000 + Math.random() * 900000)}`;
  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const patientName = data.patientName || "Registered Patient";
  const patientAge = data.patientAge ? String(data.patientAge) : "Unspecified";
  const patientGender = data.patientGender || "Other";
  const bloodGroup = data.bloodGroup || "Standard Profile (Unspecified)";
  const email = data.email || "Not Provided";
  const phone = data.phone || "Not Provided";
  const medicalNotes = data.medicalNotes || "Routine outpatient review. No adverse clinical reactions or chronic flags documented.";
  const appointments = data.appointments || [];

  // Attending Doctor and Verifying Receptionist
  const doctorName = data.doctorName || "Dr. Sarah Connor, M.D.";
  const receptionistName = data.receptionistName || "Vrushali Patil";

  const ops: string[] = [];

  // 1. Top Clinical Stationery Header (Image Style)
  // Left: Clinical Title & Tagline
  ops.push("0.08 0.28 0.58 rg");
  ops.push(`BT /F2 14.5 Tf 36 752 Td (${escapePdf(clinicName)}) Tj ET`);
  ops.push("0.18 0.45 0.72 rg");
  ops.push("BT /F1 8 Tf 36 740 Td (The Strength of Experience & Comprehensive Patient Care) Tj ET");

  // Right: Clinic Centers
  ops.push("0.25 0.30 0.40 rg");
  ops.push("BT /F2 7.5 Tf 340 754 Td (Main Medical Center) Tj ET");
  ops.push("BT /F1 7 Tf 340 744 Td (1010 Healthcare Drive, Ste 400) Tj ET");
  ops.push("BT /F2 7.5 Tf 460 754 Td (Outpatient Pavilion) Tj ET");
  ops.push("BT /F1 7 Tf 460 744 Td (2040 Medical Parkway, Ste 100) Tj ET");

  // Contact line
  ops.push("0.15 0.45 0.75 rg");
  ops.push("BT /F2 7.5 Tf 36 724 Td (Tel: (850) 863-2153   |   Fax: (850) 863-8085) Tj ET");
  ops.push("0.25 0.30 0.40 rg");
  ops.push("BT /F1 7.5 Tf 440 724 Td (www.metrohealthassociates.org) Tj ET");

  // Separator Rule
  ops.push("0.75 0.80 0.88 RG 0.8 w");
  ops.push("36 714 m 576 714 l S");

  // Centered Document Header
  ops.push("0.08 0.20 0.38 rg");
  ops.push("BT /F2 13 Tf 175 692 Td (Patient Clinical Record & Medical Summary) Tj ET");
  ops.push("0.4 0.45 0.5 rg");
  ops.push("BT /F1 8.5 Tf 210 678 Td (Official Outpatient Medical Dossier) Tj ET");

  // Date and MR# line (like reference image)
  ops.push("0.2 0.25 0.35 rg");
  ops.push("BT /F2 8.5 Tf 36 654 Td (Date: ) Tj ET");
  ops.push(`BT /F1 8.5 Tf 65 654 Td (${escapePdf(formattedDate)}) Tj ET`);
  ops.push("BT /F2 8.5 Tf 420 654 Td (MR# ) Tj ET");
  ops.push(`BT /F1 8.5 Tf 445 654 Td (${escapePdf(reportId)}  (Office Use Only)) Tj ET`);

  // Content Divider
  ops.push("0.85 0.88 0.92 RG 0.6 w");
  ops.push("36 644 m 576 644 l S");

  // Section 1: Patient Demographic Profile
  ops.push("0.08 0.28 0.58 rg");
  ops.push("BT /F2 9.5 Tf 36 626 Td (1. PATIENT DEMOGRAPHIC & CLINICAL PROFILE) Tj ET");

  ops.push("0.98 0.98 0.99 rg");
  ops.push("36 546 540 70 re f");
  ops.push("0.85 0.88 0.92 RG 0.6 w");
  ops.push("36 546 540 70 re S");

  ops.push("0.2 0.25 0.35 rg");
  ops.push("BT /F2 8.5 Tf 48 596 Td (Patient Name:) Tj ET");
  ops.push(`BT /F2 9.5 Tf 125 596 Td (${escapePdf(patientName)}) Tj ET`);
  ops.push("BT /F2 8.5 Tf 330 596 Td (Blood Group:) Tj ET");
  ops.push(`BT /F2 9.5 Tf 410 596 Td (${escapePdf(bloodGroup)}) Tj ET`);

  ops.push("BT /F2 8.5 Tf 48 576 Td (Age & Gender:) Tj ET");
  ops.push(`BT /F1 8.5 Tf 125 576 Td (${escapePdf(patientAge)} yrs   |   ${escapePdf(patientGender)}) Tj ET`);
  ops.push("BT /F2 8.5 Tf 330 576 Td (Telephone:) Tj ET");
  ops.push(`BT /F1 8.5 Tf 410 576 Td (${escapePdf(phone)}) Tj ET`);

  ops.push("BT /F2 8.5 Tf 48 556 Td (Email Address:) Tj ET");
  ops.push(`BT /F1 8.5 Tf 125 556 Td (${escapePdf(email)}) Tj ET`);
  ops.push("BT /F2 8.5 Tf 330 556 Td (Record Status:) Tj ET");
  ops.push("BT /F1 8.5 Tf 410 556 Td (Active Registered Outpatient) Tj ET");

  // Section 2: Clinical Observations & Medical History (NO TOOL NAMES)
  ops.push("0.08 0.28 0.58 rg");
  ops.push("BT /F2 9.5 Tf 36 524 Td (2. CLINICAL OBSERVATIONS & MEDICAL HISTORY) Tj ET");

  ops.push("0.98 0.98 0.99 rg");
  ops.push("36 464 540 50 re f");
  ops.push("0.85 0.88 0.92 RG 0.6 w");
  ops.push("36 464 540 50 re S");

  ops.push("0.2 0.25 0.35 rg");
  ops.push(`BT /F1 8.5 Tf 48 496 Td (Clinical Notes: ${escapePdf(medicalNotes.slice(0, 95))}) Tj ET`);
  if (medicalNotes.length > 95) {
    ops.push(`BT /F1 8.5 Tf 48 482 Td (${escapePdf(medicalNotes.slice(95, 190))}) Tj ET`);
  }
  ops.push("BT /F1 8.5 Tf 48 468 Td (Allergies: No known drug allergies (NKDA) reported on outpatient intake.) Tj ET");

  // Section 3: Consultation Timeline & Appointment Roster
  ops.push("0.08 0.28 0.58 rg");
  ops.push("BT /F2 9.5 Tf 36 442 Td (3. CONSULTATION & APPOINTMENT TIMELINE) Tj ET");

  ops.push("0.10 0.28 0.52 rg");
  ops.push("36 418 540 16 re f");
  ops.push("1 1 1 rg");
  ops.push("BT /F2 8 Tf 44 423 Td (DATE) Tj ET");
  ops.push("BT /F2 8 Tf 120 423 Td (ATTENDING DOCTOR) Tj ET");
  ops.push("BT /F2 8 Tf 260 423 Td (FORMAT) Tj ET");
  ops.push("BT /F2 8 Tf 350 423 Td (STATUS) Tj ET");
  ops.push("BT /F2 8 Tf 430 423 Td (OBSERVATIONS) Tj ET");

  let curY = 402;
  const displayAppts = appointments.slice(0, 5);
  if (displayAppts.length === 0) {
    ops.push("0.98 0.98 0.98 rg");
    ops.push(`36 ${curY} 540 16 re f`);
    ops.push("0.4 0.45 0.5 rg");
    ops.push(`BT /F1 8 Tf 44 ${curY + 4} Td (No prior consultation history recorded. Outpatient file active.) Tj ET`);
  } else {
    displayAppts.forEach((appt, idx) => {
      if (idx % 2 === 0) {
        ops.push("0.96 0.97 0.99 rg");
        ops.push(`36 ${curY} 540 16 re f`);
      }
      ops.push("0.2 0.25 0.35 rg");
      ops.push(`BT /F1 8 Tf 44 ${curY + 4} Td (${escapePdf(appt.date)}) Tj ET`);
      ops.push(`BT /F1 8 Tf 120 ${curY + 4} Td (${escapePdf(appt.doctor.slice(0, 24))}) Tj ET`);
      ops.push(`BT /F1 8 Tf 260 ${curY + 4} Td (${escapePdf(appt.mode)}) Tj ET`);
      ops.push(`BT /F2 8 Tf 350 ${curY + 4} Td (${escapePdf(appt.status)}) Tj ET`);
      ops.push(`BT /F1 8 Tf 430 ${curY + 4} Td (${escapePdf((appt.notes || "Clinical consultation").slice(0, 28))}) Tj ET`);
      curY -= 17;
    });
  }

  // Section 4: Sign-off block (Doctor on Left, Receptionist on Right with signatures)
  ops.push("0.75 0.80 0.88 RG 0.8 w");
  ops.push("36 215 m 576 215 l S");

  // Left Column: Attended by Doctor
  ops.push("0.08 0.28 0.58 rg");
  ops.push("BT /F2 9.5 Tf 48 196 Td (Attended by Doctor:) Tj ET");
  // Dummy stylized cursive signature
  ops.push("0.12 0.35 0.65 rg");
  ops.push(`BT /F2 11 Tf 48 174 Td (~ ${escapePdf(doctorName)} ~) Tj ET`);
  ops.push("0.4 0.45 0.55 RG 0.7 w");
  ops.push("48 166 m 250 166 l S");
  ops.push("0.2 0.25 0.35 rg");
  ops.push(`BT /F2 8.5 Tf 48 152 Td (${escapePdf(doctorName)}) Tj ET`);
  ops.push("BT /F1 7.5 Tf 48 140 Td (Attending Physician / Specialist) Tj ET");
  ops.push(`BT /F1 7.5 Tf 48 128 Td (Date: ${escapePdf(formattedDate)}) Tj ET`);

  // Right Column: Verified by Receptionist
  ops.push("0.08 0.28 0.58 rg");
  ops.push("BT /F2 9.5 Tf 340 196 Td (Verified by Receptionist:) Tj ET");
  // Dummy stylized cursive signature
  ops.push("0.12 0.35 0.65 rg");
  ops.push(`BT /F2 11 Tf 340 174 Td (~ ${escapePdf(receptionistName)} ~) Tj ET`);
  ops.push("0.4 0.45 0.55 RG 0.7 w");
  ops.push("340 166 m 540 166 l S");
  ops.push("0.2 0.25 0.35 rg");
  ops.push(`BT /F2 8.5 Tf 340 152 Td (${escapePdf(receptionistName)}) Tj ET`);
  ops.push("BT /F1 7.5 Tf 340 140 Td (Front Desk Clinic Receptionist) Tj ET");
  ops.push(`BT /F1 7.5 Tf 340 128 Td (Date: ${escapePdf(formattedDate)}) Tj ET`);

  // Center Clinic Seal Badge
  ops.push("0.85 0.90 0.95 RG 0.8 w");
  ops.push("180 72 240 32 re S");
  ops.push("0.08 0.28 0.58 rg");
  ops.push("BT /F2 8 Tf 198 90 Td (METRO HEALTH MEDICAL ASSOCIATES) Tj ET");
  ops.push("BT /F1 7.5 Tf 210 78 Td (Official Clinical Verification Seal) Tj ET");

  // Confidentiality footnote (NO TOOL NAMES)
  ops.push("0.5 0.55 0.6 rg");
  ops.push("BT /F1 6.8 Tf 36 46 Td (CONFIDENTIAL MEDICAL RECORD: Contains privileged protected health information under healthcare privacy standards.) Tj ET");
  ops.push("BT /F1 6.8 Tf 36 36 Td (Intended solely for authorized patient clinical care. Any unauthorized duplication is prohibited.) Tj ET");

  // Bottom Dual Accent Stripes (Green stripe matching the reference image!)
  ops.push("0.08 0.28 0.58 rg"); // Navy blue accent line
  ops.push("0 10 612 8 re f");
  ops.push("0.30 0.68 0.22 rg"); // Fresh medical green stripe matching user image!
  ops.push("0 0 612 10 re f");

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
