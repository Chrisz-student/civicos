// ============================================
// CIVICOS — API Service
// All communication with the backend goes here
// ============================================

import axios from 'axios';
import type {
  SubmitReportPayload,
  SubmitReportResponse,
  IncidentRecord,
} from '../types/incident';

// This will point to your API Gateway URL once deployed.
// For now it uses mock data (see below).
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ---- Are we in mock mode? (no API deployed yet) ----
const USE_MOCK = !API_BASE_URL;

// ---- Mock helpers for local development ----
function generateIncidentId(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `CIV-2025-${num}`;
}

function mockSubmit(payload: SubmitReportPayload): SubmitReportResponse {
  const id = generateIncidentId();
  // Save to localStorage so the status page can read it
  const record: IncidentRecord = {
    incident_id: id,
    status: 'submitted',
    created_at: new Date().toISOString(),
    input: {
      type: payload.input_type,
      s3_key: `uploads/${payload.input_type}/${id}.${payload.input_type === 'image' ? 'jpg' : 'webm'}`,
      text_content: payload.text_content,
      location: payload.location,
      gps: payload.gps,
      citizen_email: payload.citizen_email,
    },
  };
  localStorage.setItem(`civicos_${id}`, JSON.stringify(record));
  return { incident_id: id, upload_url: 'mock://no-upload-needed' };
}

function mockGetStatus(incidentId: string): IncidentRecord | null {
  const data = localStorage.getItem(`civicos_${incidentId}`);
  if (!data) return null;
  return JSON.parse(data) as IncidentRecord;
}

// ============================================
// Public API functions — used by components
// ============================================

/**
 * Submit a new report. Returns the incident ID and presigned upload URL.
 */
export async function submitReport(
  payload: SubmitReportPayload
): Promise<SubmitReportResponse> {
  if (USE_MOCK) {
    // Simulate a short delay
    await new Promise((r) => setTimeout(r, 800));
    return mockSubmit(payload);
  }

  const res = await axios.post<SubmitReportResponse>(
    `${API_BASE_URL}/reports`,
    payload
  );
  return res.data;
}

/**
 * Upload a file (image or voice blob) to S3 using the presigned URL.
 */
export async function uploadFileToS3(
  presignedUrl: string,
  file: Blob,
  contentType: string
): Promise<void> {
  if (USE_MOCK) {
    // Nothing to upload in mock mode
    await new Promise((r) => setTimeout(r, 500));
    return;
  }

  await axios.put(presignedUrl, file, {
    headers: { 'Content-Type': contentType },
  });
}

/**
 * Get the status/details of a report by its incident ID.
 */
export async function getReportStatus(
  incidentId: string
): Promise<IncidentRecord | null> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return mockGetStatus(incidentId);
  }

  try {
    const res = await axios.get<IncidentRecord>(
      `${API_BASE_URL}/reports/${incidentId}`
    );
    return res.data;
  } catch {
    return null;
  }
}
