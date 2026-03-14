// ============================================
// CIVICOS — TypeScript interfaces
// These match the DynamoDB record schema
// ============================================

/** GPS coordinates */
export interface GPS {
  lat: number;
  lng: number;
}

/** The input data submitted by the citizen */
export interface IncidentInput {
  type: 'voice' | 'image' | 'text';
  s3_key: string;
  text_content: string;
  location: string;
  gps?: GPS;               // Optional — device may not have GPS
  citizen_email: string;
}

/** AI analysis result — written by Person 1B's CivicOS-ai-processor Lambda */
export interface AiAnalysis {
  category: string;           // e.g. "Infrastructure & Roading", "Noise Complaints", "unsupported"
  subcategory: string;        // e.g. "Pothole", "Residential noise"
  report_type: string;        // complaint | request | information | notice | emergency
  severity: number;           // 0.0 - 1.0 numeric score
  risk_level: string;         // low | medium | high | critical
  location_extracted: string; // AI-extracted location from the report
  summary: string;            // AI-generated summary of the issue
  confidence: number;         // 0.0 - 1.0 confidence score
}

/** Routing info (Pair 2 writes this) */
export interface Routing {
  department: string;
  email_address: string;
}

/** Email sending status (Pair 2 writes this) */
export interface EmailStatus {
  sent_at: string;
  citizen_cc_sent: boolean;
  authority_email_sent: boolean;
}

/** All possible statuses a report can have */
export type IncidentStatus =
  | 'submitted'
  | 'analyzed'           // Person 1B sets this after AI classification
  | 'processing_failed'  // Person 1B sets this if AI fails
  | 'needs_location'     // Person 1B sets this when location cannot be extracted from text/audio
  | 'legal_review'
  | 'sent_to_authority'
  | 'sent'              // Pair 2 sets this after email is sent
  | 'authority_response'
  | 'unsupported';       // Person 1B sets this if category not supported

/** The full DynamoDB record for one incident */
export interface IncidentRecord {
  incident_id: string;
  status: IncidentStatus;
  created_at: string;
  input: IncidentInput;
  // Added by Person 1B (AI classification):
  ai_analysis?: AiAnalysis;
  processed_at?: string;
  transcript?: string;        // For voice inputs — transcribed text
  // Added by Pair 2 (legal + routing + email):
  legal?: { citation: string; description: string };
  routing?: Routing;
  email?: EmailStatus;
}

/** What the frontend sends when submitting a new report */
export interface SubmitReportPayload {
  text_content?: string;   // Text description — required for text input, optional for image/voice
  location?: string;       // Required for image input; omitted for text/audio (AI extracts it)
  gps?: GPS;               // Optional — only included if coordinates available
  citizen_email: string;
  input_type: 'voice' | 'image' | 'text';
}

/** What the API returns after a successful submit */
export interface SubmitReportResponse {
  incident_id: string;
  upload_url: string;        // presigned S3 URL for the primary file (voice or image)
  image_upload_url: string;  // presigned S3 URL for image — only set when voice + image both uploaded
}
