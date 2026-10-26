const apiRoot = "https://api.airtable.com/v0";

export const COL = {
  name: "Patient Name",
  email: "Patient Email",
  phone: "Phone No",
  date: "Appointment Date",
  time: "Appointment Time",
  doctor: "Doctor",
  status: "Status",
  mode: "Mode",
  bloodGroup: "Blood Group",
  notes: "Medical Notes",
  age: "Age",
  gender: "Gender",
  zoomId: "Zoom Meeting ID",
  zoomUrl: "Zoom Join URL",
  calendarId: "Google Calendar Event ID",
  followupDay: "Follow-up Day",
  followupStart: "Follow-up Start",
  ticketId: "Ticket ID",
  createdTime: "Created Time",
  lastModifiedTime: "Last Modified Time",
} as const;

function hasAirtableConfig() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const base = process.env.AIRTABLE_BASE_ID?.trim();
  const table = process.env.AIRTABLE_TABLE_ID?.trim();
  return Boolean(token && token !== "xxx" && base && base !== "xxx" && table && table !== "xxx");
}

function config() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const base = process.env.AIRTABLE_BASE_ID?.trim();
  const table = process.env.AIRTABLE_TABLE_ID?.trim();
  if (!token || token === "xxx" || !base || base === "xxx" || !table || table === "xxx") {
    throw new Error("Airtable is not configured or using placeholder credentials.");
  }
  return { token, base, table };
}

// Fallback in-memory clinic store with realistic seed data
function getISODate(daysOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = getISODate(0);
const tomorrow = getISODate(1);
const nextWeek = getISODate(4);

interface MockRecord {
  id: string;
  createdTime: string;
  fields: Record<string, any>;
}

const mockStore: MockRecord[] = [
  // Seed Patients
  {
    id: "recPatient001",
    createdTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    fields: {
      "Patient Name": "Aarav Sharma",
      "Patient Email": "aarav.sharma@example.com",
      "Email": "aarav.sharma@example.com",
      "Phone No": "+91 98765 43210",
      "Phone": "+91 98765 43210",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient002",
    createdTime: new Date(Date.now() - 86400000 * 4).toISOString(),
    fields: {
      "Patient Name": "Meera Patel",
      "Patient Email": "meera.patel@example.com",
      "Email": "meera.patel@example.com",
      "Phone No": "+91 98234 56789",
      "Phone": "+91 98234 56789",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient003",
    createdTime: new Date(Date.now() - 86400000 * 3).toISOString(),
    fields: {
      "Patient Name": "Rajesh Kumar",
      "Patient Email": "rajesh.kumar@example.com",
      "Email": "rajesh.kumar@example.com",
      "Phone No": "+91 97123 45678",
      "Phone": "+91 97123 45678",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient004",
    createdTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    fields: {
      "Patient Name": "Priya Nair",
      "Patient Email": "priya.nair@example.com",
      "Email": "priya.nair@example.com",
      "Phone No": "+91 99887 76655",
      "Phone": "+91 99887 76655",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient005",
    createdTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    fields: {
      "Patient Name": "Sunita Gupta",
      "Patient Email": "sunita.gupta@example.com",
      "Email": "sunita.gupta@example.com",
      "Phone No": "+91 98711 22334",
      "Phone": "+91 98711 22334",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient006",
    createdTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    fields: {
      "Patient Name": "Vikram Malhotra",
      "Patient Email": "vikram.m@example.com",
      "Email": "vikram.m@example.com",
      "Phone No": "+91 91234 56780",
      "Phone": "+91 91234 56780",
      "Status": "Registered",
    },
  },
  // Seed Appointments
  {
    id: "recAppt001",
    createdTime: new Date(Date.now() - 3600000 * 6).toISOString(),
    fields: {
      "Patient Name": "Aarav Sharma",
      "Patient Email": "aarav.sharma@example.com",
      "Email": "aarav.sharma@example.com",
      "Phone No": "+91 98765 43210",
      "Phone": "+91 98765 43210",
      "Doctor": "Dr. Ananya Rao",
      "Appointment Date": today,
      "Appointment Time": "09:30",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "84729103948",
      "Zoom Join URL": "https://zoom.us/j/84729103948?pwd=CLINIC",
      "Google Calendar Event ID": "cal_seed_001",
    },
  },
  {
    id: "recAppt002",
    createdTime: new Date(Date.now() - 3600000 * 4).toISOString(),
    fields: {
      "Patient Name": "Meera Patel",
      "Patient Email": "meera.patel@example.com",
      "Email": "meera.patel@example.com",
      "Phone No": "+91 98234 56789",
      "Phone": "+91 98234 56789",
      "Doctor": "Dr. Arjun Mehta",
      "Appointment Date": today,
      "Appointment Time": "11:00",
      "Mode": "Offline",
      "Status": "Scheduled",
      "Google Calendar Event ID": "cal_seed_002",
    },
  },
  {
    id: "recAppt003",
    createdTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    fields: {
      "Patient Name": "Rajesh Kumar",
      "Patient Email": "rajesh.kumar@example.com",
      "Email": "rajesh.kumar@example.com",
      "Phone No": "+91 97123 45678",
      "Phone": "+91 97123 45678",
      "Doctor": "Dr. Neha Sharma",
      "Appointment Date": today,
      "Appointment Time": "14:30",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "85920194821",
      "Zoom Join URL": "https://zoom.us/j/85920194821?pwd=CLINIC",
      "Google Calendar Event ID": "cal_seed_003",
    },
  },
  {
    id: "recAppt004",
    createdTime: new Date(Date.now() - 3600000 * 8).toISOString(),
    fields: {
      "Patient Name": "Priya Nair",
      "Patient Email": "priya.nair@example.com",
      "Email": "priya.nair@example.com",
      "Phone No": "+91 99887 76655",
      "Phone": "+91 99887 76655",
      "Doctor": "Dr. Rohan Nair",
      "Appointment Date": today,
      "Appointment Time": "16:00",
      "Mode": "Offline",
      "Status": "Completed",
      "Google Calendar Event ID": "cal_seed_004",
    },
  },
  {
    id: "recAppt005",
    createdTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    fields: {
      "Patient Name": "Sunita Gupta",
      "Patient Email": "sunita.gupta@example.com",
      "Email": "sunita.gupta@example.com",
      "Phone No": "+91 98711 22334",
      "Phone": "+91 98711 22334",
      "Doctor": "Dr. Priya Menon",
      "Appointment Date": tomorrow,
      "Appointment Time": "10:30",
      "Mode": "Offline",
      "Status": "Scheduled",
      "Google Calendar Event ID": "cal_seed_005",
    },
  },
  {
    id: "recAppt006",
    createdTime: new Date(Date.now() - 3600000 * 14).toISOString(),
    fields: {
      "Patient Name": "Vikram Malhotra",
      "Patient Email": "vikram.m@example.com",
      "Email": "vikram.m@example.com",
      "Phone No": "+91 91234 56780",
      "Phone": "+91 91234 56780",
      "Doctor": "Dr. Bhushan Shenoy",
      "Appointment Date": tomorrow,
      "Appointment Time": "15:00",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "87391028472",
      "Zoom Join URL": "https://zoom.us/j/87391028472?pwd=CLINIC",
      "Google Calendar Event ID": "cal_seed_006",
    },
  },
  {
    id: "recAppt007",
    createdTime: new Date(Date.now() - 3600000 * 20).toISOString(),
    fields: {
      "Patient Name": "Aarav Sharma",
      "Patient Email": "aarav.sharma@example.com",
      "Email": "aarav.sharma@example.com",
      "Phone No": "+91 98765 43210",
      "Phone": "+91 98765 43210",
      "Doctor": "Dr. Karan Iyer",
      "Appointment Date": nextWeek,
      "Appointment Time": "11:30",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "88492019283",
      "Zoom Join URL": "https://zoom.us/j/88492019283?pwd=CLINIC",
    },
  },
];

export const APPOINTMENTS_TABLE_ALLOWED_FIELDS = new Set([
  "Patient Name",
  "Patient Email",
  "Phone No",
  "Appointment Date",
  "Appointment Time",
  "Doctor",
  "Status",
  "Ticket ID",
  "Zoom Meeting ID",
  "Zoom Join URL",
  "Google Calendar Event ID",
  "Mode",
  "Blood Group",
  "Medical Notes",
  "Age",
  "Gender",
]);

export const PATIENTS_TABLE_ALLOWED_FIELDS = new Set([
  "Patient Name",
  "Patient Email",
  "Phone No",
  "Age",
  "Gender",
  "Blood Group",
  "Medical Notes",
]);

export function isAirtableLive() {
  return hasAirtableConfig();
}

function patientsTableId() {
  return process.env.AIRTABLE_PATIENTS_TABLE_ID?.trim() || "tblP3i2fS5SRkdkx9";
}

export async function airtableRequest(path = "", init: RequestInit = {}, tableOverride?: string) {
  const c = config();
  const table = tableOverride || c.table;
  const response = await fetch(`${apiRoot}/${c.base}/${encodeURIComponent(table)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) {
    const err = new Error(body.error?.message || body.message || `Airtable request failed (${response.status}).`);
    (err as any).status = response.status;
    (err as any).errorType = body.error?.type;
    throw err;
  }
  return body;
}

async function fetchTableRecords(tableId: string): Promise<any[]> {
  let records: any[] = [];
  let offset = "";
  do {
    const query = new URLSearchParams({ pageSize: "100" });
    if (offset) query.set("offset", offset);
    const page = await airtableRequest(`?${query}`, {}, tableId);
    records = records.concat(page.records || []);
    offset = page.offset || "";
  } while (offset);
  return records;
}

export function deduplicateRecordsList(records: any[]): any[] {
  if (!Array.isArray(records) || records.length <= 1) return records || [];
  const map = new Map<string, any>();
  for (const item of records) {
    if (!item) continue;
    const f = item.fields || {};
    const isAppt = Boolean(f["Appointment Date"] || f["Appointment Time"] || f["Doctor"]);
    if (!isAppt) {
      const email = String(f["Patient Email"] || f["Email"] || f["Patient Name"] || item.id).trim().toLowerCase();
      const pKey = `patient_${email}`;
      if (!map.has(pKey)) map.set(pKey, item);
      continue;
    }

    const patientIdent = String(f["Patient Email"] || f["Email"] || f["Patient Name"] || f["Phone No"] || "").trim().toLowerCase();
    const dateVal = String(f["Appointment Date"] || "").slice(0, 10).trim();
    const timeVal = String(f["Appointment Time"] || "").trim();

    if (!patientIdent || !dateVal || !timeVal) {
      map.set(item.id, item);
      continue;
    }

    const slotKey = `appt_${patientIdent}__${dateVal}__${timeVal}`;
    const existing = map.get(slotKey);
    if (!existing) {
      map.set(slotKey, item);
    } else {
      const isRealId = (id: string) => /^rec[a-zA-Z0-9]{14,}/.test(id);
      const ef = existing.fields || {};
      const scoreA = (isRealId(item.id) ? 10 : 0) + (f["Zoom Join URL"] ? 5 : 0) + (f["Ticket ID"] ? 5 : 0);
      const scoreB = (isRealId(existing.id) ? 10 : 0) + (ef["Zoom Join URL"] ? 5 : 0) + (ef["Ticket ID"] ? 5 : 0);
      const chosen = scoreA >= scoreB ? item : existing;
      const other = scoreA >= scoreB ? existing : item;
      map.set(slotKey, {
        ...chosen,
        fields: {
          ...other.fields,
          ...chosen.fields,
        },
      });
    }
  }
  return Array.from(map.values());
}

export async function listAirtableRecords() {
  if (hasAirtableConfig()) {
    try {
      const c = config();
      const apptRecords = await fetchTableRecords(c.table);

      let patientRecords: any[] = [];
      const ptId = patientsTableId();
      if (ptId) {
        try {
          patientRecords = await fetchTableRecords(ptId);
        } catch (e) {
          console.warn("Could not load Patients table:", e instanceof Error ? e.message : e);
        }
      }

      // Map patient demographics from Patients table
      const demographicsMap = new Map<string, Record<string, any>>();
      for (const pr of patientRecords) {
        const pf = pr.fields || {};
        const key = String(pf["Patient Email"] || pf["Email"] || pf["Patient Name"] || "").trim().toLowerCase();
        if (key) demographicsMap.set(key, { ...pf, _patientId: pr.id });
      }

      // Merge demographics into appointments
      const enriched = apptRecords.map((r: any) => {
        const rf = r.fields || {};
        const key = String(rf["Patient Email"] || rf["Email"] || rf["Patient Name"] || "").trim().toLowerCase();
        const demo = demographicsMap.get(key);
        if (demo) {
          return {
            ...r,
            fields: {
              Age: demo.Age || rf.Age || "",
              Gender: demo.Gender || rf.Gender || "Other",
              "Blood Group": demo["Blood Group"] || rf["Blood Group"] || "",
              "Medical Notes": demo["Medical Notes"] || rf["Medical Notes"] || "",
              ...rf,
            },
          };
        }
        return r;
      });

      // Include standalone registered patients from Patients table
      const apptKeys = new Set(
        apptRecords.map((r: any) =>
          String(r.fields?.["Patient Email"] || r.fields?.["Email"] || r.fields?.["Patient Name"] || "").trim().toLowerCase()
        )
      );

      for (const pr of patientRecords) {
        const pf = pr.fields || {};
        const key = String(pf["Patient Email"] || pf["Email"] || pf["Patient Name"] || "").trim().toLowerCase();
        if (key && !apptKeys.has(key)) {
          enriched.push({
            id: pr.id,
            createdTime: pr.createdTime,
            fields: {
              ...pf,
              Status: pf.Status || "Registered",
            },
          });
        }
      }

      return deduplicateRecordsList(enriched);
    } catch (error) {
      console.warn("Airtable API unreachable or failed; using resilient local clinic store:", error instanceof Error ? error.message : "unknown");
    }
  }
  return deduplicateRecordsList(JSON.parse(JSON.stringify(mockStore)));
}

export async function saveAirtableRecord(
  id: string | null,
  fields: Record<string, unknown>,
  explicitTableId?: string
) {
  const isUpdate = Boolean(id && !id.startsWith("patient:") && !id.startsWith("local:"));
  let currentId: string | null = isUpdate ? id : null;

  const COMPUTED_FIELD_NAMES = new Set([
    "Created Time",
    "Created time",
    "created_time",
    "createdTime",
    "Created",
    "Last Modified Time",
    "Last modified time",
    "last_modified_time",
    "lastModifiedTime",
    "Last Modified By",
    "last_modified_by",
    "Created By",
    "created_by",
    "Auto Number",
    "id",
    "Record ID",
  ]);

  // Strip computed / read-only fields
  const rawValues: Record<string, unknown> = { ...fields };
  for (const k of Object.keys(rawValues)) {
    if (COMPUTED_FIELD_NAMES.has(k) || rawValues[k] === undefined) {
      delete rawValues[k];
    }
  }

  // Determine whether this is an Appointment or a Patient record
  const isAppointment = Boolean(
    rawValues["Appointment Date"] || rawValues["Appointment Time"] || rawValues["Doctor"]
  );

  const c = config();
  const targetTable = explicitTableId || c.table;

  // Strictly filter values according to table schema
  const values: Record<string, unknown> = {};
  if (targetTable === c.table) {
    // Primary table (tblLSp4tTMNANmGjc) contains all 18 writable fields
    for (const [k, v] of Object.entries(rawValues)) {
      if (APPOINTMENTS_TABLE_ALLOWED_FIELDS.has(k)) {
        if (k === "Appointment Date") {
          if (v === "" || v === null || v === undefined) {
            if (currentId) values[k] = null;
          } else {
            values[k] = String(v).slice(0, 10);
          }
        } else if (v === "" || v === null || v === undefined) {
          if (currentId) values[k] = null;
        } else {
          values[k] = v;
        }
      }
    }
  } else {
    // Secondary demographic table (tblP3i2fS5SRkdkx9) if explicitly targeted
    for (const [k, v] of Object.entries(rawValues)) {
      if (PATIENTS_TABLE_ALLOWED_FIELDS.has(k)) {
        if (v === "" || v === null || v === undefined) {
          if (currentId) values[k] = null;
        } else {
          values[k] = v;
        }
      }
    }
  }

  // Before inserting a new duplicate appointment row in Airtable, check if an appointment
  // already exists for the same patient on this date and time slot
  if (!currentId && isAppointment && hasAirtableConfig() && targetTable === c.table) {
    try {
      const pEmail = String(rawValues["Patient Email"] || rawValues["Email"] || "").trim().toLowerCase();
      const pName = String(rawValues["Patient Name"] || "").trim().toLowerCase();
      const apptDate = String(rawValues["Appointment Date"] || "").slice(0, 10).trim();
      const apptTime = String(rawValues["Appointment Time"] || "").trim();

      if ((pEmail || pName) && apptDate && apptTime) {
        const existingAppts = await fetchTableRecords(c.table);
        const match = existingAppts.find((r: any) => {
          const rf = r.fields || {};
          const rEmail = String(rf["Patient Email"] || rf["Email"] || "").trim().toLowerCase();
          const rName = String(rf["Patient Name"] || "").trim().toLowerCase();
          const rDate = String(rf["Appointment Date"] || "").slice(0, 10).trim();
          const rTime = String(rf["Appointment Time"] || "").trim();
          const rStatus = String(rf["Status"] || "").trim().toLowerCase();
          if (rStatus === "cancelled") return false;
          const patientMatches = (pEmail && rEmail === pEmail) || (pName && rName === pName);
          return patientMatches && rDate === apptDate && (rTime === apptTime || rTime.startsWith(apptTime) || apptTime.startsWith(rTime));
        });
        if (match) {
          currentId = match.id;
        }
      }
    } catch {
      // Continue with normal flow if check encounters network issue
    }
  }

  if (hasAirtableConfig()) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const result = await airtableRequest(
          currentId ? `/${encodeURIComponent(currentId)}` : "",
          {
            method: currentId ? "PATCH" : "POST",
            body: JSON.stringify({ fields: values, typecast: true }),
          },
          targetTable
        );

        // If saving an appointment that also contains patient demographic fields (Age, Gender, Blood Group, Medical Notes),
        // save those demographic fields to the Patients table in the background
        if (isAppointment && hasAirtableConfig()) {
          const demoFields: Record<string, unknown> = {};
          if (rawValues["Patient Name"]) demoFields["Patient Name"] = rawValues["Patient Name"];
          if (rawValues["Patient Email"]) demoFields["Patient Email"] = rawValues["Patient Email"];
          if (rawValues["Phone No"]) demoFields["Phone No"] = rawValues["Phone No"];
          if (rawValues["Age"]) demoFields["Age"] = rawValues["Age"];
          if (rawValues["Gender"]) demoFields["Gender"] = rawValues["Gender"];
          if (rawValues["Blood Group"]) demoFields["Blood Group"] = rawValues["Blood Group"];
          if (rawValues["Medical Notes"]) demoFields["Medical Notes"] = rawValues["Medical Notes"];

          if (Object.keys(demoFields).length > 3) {
            void (async () => {
              try {
                const ptId = patientsTableId();
                const existing = await fetchTableRecords(ptId);
                const email = String(demoFields["Patient Email"] || "").toLowerCase().trim();
                const matched = (existing || []).find(
                  (r: any) => String(r.fields?.["Patient Email"] || "").toLowerCase().trim() === email
                );
                if (matched) {
                  await airtableRequest(`/${encodeURIComponent(matched.id)}`, {
                    method: "PATCH",
                    body: JSON.stringify({ fields: demoFields, typecast: true }),
                  }, ptId);
                } else {
                  await airtableRequest("", {
                    method: "POST",
                    body: JSON.stringify({ fields: demoFields, typecast: true }),
                  }, ptId);
                }
              } catch {
                // Background demographic sync notice
              }
            })();
          }
        }

        // Keep local mockStore in sync for fallback continuity (prevent duplicate appointment slots)
        if (result?.id) {
          const isResultAppt = Boolean(result.fields?.["Appointment Date"] || result.fields?.["Appointment Time"]);
          const pIdent = String(result.fields?.["Patient Email"] || result.fields?.["Patient Name"] || "").trim().toLowerCase();
          const dVal = String(result.fields?.["Appointment Date"] || "").slice(0, 10).trim();
          const tVal = String(result.fields?.["Appointment Time"] || "").trim();

          const idx = mockStore.findIndex(r => {
            if (r.id === result.id || (currentId && r.id === currentId)) return true;
            if (isResultAppt && pIdent && dVal && tVal) {
              const rf = r.fields || {};
              const rIdent = String(rf["Patient Email"] || rf["Patient Name"] || "").trim().toLowerCase();
              const rdVal = String(rf["Appointment Date"] || "").slice(0, 10).trim();
              const rtVal = String(rf["Appointment Time"] || "").trim();
              return rIdent === pIdent && rdVal === dVal && (rtVal === tVal || rtVal.startsWith(tVal) || tVal.startsWith(rtVal));
            }
            return false;
          });
          if (idx >= 0) {
            mockStore[idx] = result;
          } else {
            mockStore.unshift(result);
          }
        }
        return result;
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message || "";
        const status = (lastError as any).status;

        // If ID not found (404), fall back to creating a new record
        if (currentId && (status === 404 || /NOT_FOUND|INVALID_RECORD_ID|Record not found/i.test(message))) {
          console.warn(`Record ${currentId} not found in ${targetTable}; persisting as new record.`);
          currentId = null;
          Object.keys(values).forEach(k => { if (values[k] === null || values[k] === "") delete values[k]; });
          continue;
        }

        // Check for computed field error
        const computedField =
          /Field "([^"]+)" cannot accept a value because the field is computed/i.exec(message)?.[1] ||
          /Cannot (?:modify|update) computed field "([^"]+)"/i.exec(message)?.[1] ||
          /Field "([^"]+)" [^"]*computed/i.exec(message)?.[1];
        if (computedField && Object.hasOwn(values, computedField)) {
          console.warn(`Removing computed field "${computedField}" and retrying...`);
          delete values[computedField];
          continue;
        }

        // Check for unknown field names
        const unknownField = /Unknown field name: "([^"]+)"/i.exec(message)?.[1];
        if (unknownField && Object.hasOwn(values, unknownField)) {
          console.warn(`Removing unmapped field "${unknownField}" from ${targetTable} and retrying...`);
          delete values[unknownField];
          continue;
        }

        throw lastError;
      }
    }
    if (lastError) throw lastError;
  }

  // In-memory fallback
  if (currentId) {
    const existingIndex = mockStore.findIndex(r => r.id === currentId);
    if (existingIndex >= 0) {
      mockStore[existingIndex].fields = { ...mockStore[existingIndex].fields, ...values };
      return JSON.parse(JSON.stringify(mockStore[existingIndex]));
    }
  } else if (isAppointment) {
    const pIdent = String(values["Patient Email"] || values["Email"] || values["Patient Name"] || "").trim().toLowerCase();
    const dVal = String(values["Appointment Date"] || "").slice(0, 10).trim();
    const tVal = String(values["Appointment Time"] || "").trim();
    if (pIdent && dVal && tVal) {
      const matchIdx = mockStore.findIndex(r => {
        const rf = r.fields || {};
        const rIdent = String(rf["Patient Email"] || rf["Email"] || rf["Patient Name"] || "").trim().toLowerCase();
        const rdVal = String(rf["Appointment Date"] || "").slice(0, 10).trim();
        const rtVal = String(rf["Appointment Time"] || "").trim();
        return rIdent === pIdent && rdVal === dVal && (rtVal === tVal || rtVal.startsWith(tVal) || tVal.startsWith(rtVal));
      });
      if (matchIdx >= 0) {
        mockStore[matchIdx].fields = { ...mockStore[matchIdx].fields, ...values };
        return JSON.parse(JSON.stringify(mockStore[matchIdx]));
      }
    }
  }

  const newId = currentId || `rec${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
  const newRecord: MockRecord = {
    id: newId,
    createdTime: new Date().toISOString(),
    fields: values,
  };
  mockStore.unshift(newRecord);
  return JSON.parse(JSON.stringify(newRecord));
}

export async function deleteAirtableRecord(id: string) {
  if (hasAirtableConfig()) {
    const c = config();
    try {
      // First try deleting from appointments table
      await airtableRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" }, c.table);
    } catch (error: any) {
      const status = error?.status;
      const message = error instanceof Error ? error.message : "";
      if (status === 404 || /NOT_FOUND|INVALID_RECORD_ID|Record not found/i.test(message)) {
        // Try deleting from patients table
        const ptId = patientsTableId();
        if (ptId) {
          try {
            await airtableRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" }, ptId);
          } catch {
            // Already gone
          }
        }
      } else {
        throw error;
      }
    }
  }
  const index = mockStore.findIndex(r => r.id === id);
  if (index >= 0) {
    mockStore.splice(index, 1);
  }
  return { ok: true };
}
