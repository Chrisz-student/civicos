// ============================================
// Screen 1 — Submit a Report
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import VoiceRecorder from '../components/VoiceRecorder';
import FileDropZone from '../components/FileDropZone';
import LocationPicker from '../components/LocationPicker';
import { submitReport, uploadFileToS3 } from '../services/api';
import type { GPS } from '../types/incident';

export default function SubmitReport() {
  // Form state
  const [textContent, setTextContent] = useState('');
  const [location, setLocation] = useState('');
  const [gps, setGps] = useState<GPS | null>(null);
  const [email, setEmail] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Figure out the input type to send
  const getInputType = (): 'voice' | 'image' | 'text' => {
    if (voiceBlob) return 'voice';
    if (imageFile) return 'image';
    return 'text';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!textContent.trim() && !voiceBlob && !imageFile) {
      setError('Please provide at least a description, voice recording, or photo.');
      return;
    }
    if (!location.trim()) {
      setError('Please provide a location.');
      return;
    }
    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Submit the report to get an incident ID + presigned URL
      const payload: Record<string, unknown> = {
        text_content: textContent,
        location,
        citizen_email: email,
        input_type: getInputType(),
      };
      // Only include GPS if we have real coordinates
      if (gps) {
        payload.gps = gps;
      }
      // Tell the Lambda the actual file content type so the presigned URL matches
      if (imageFile) {
        payload.content_type = imageFile.type; // e.g. 'image/png' or 'image/jpeg'
      } else if (voiceBlob) {
        payload.content_type = 'audio/webm';
      }

      const result = await submitReport(payload as any);

      // Step 2: Upload the file to S3 if there is one
      if (imageFile) {
        await uploadFileToS3(result.upload_url, imageFile, imageFile.type);
      } else if (voiceBlob) {
        await uploadFileToS3(result.upload_url, voiceBlob, 'audio/webm');
      }

      // Step 3: Show success
      setIncidentId(result.incident_id);
    } catch (err: any) {
      console.error('Submit error:', err);
      // Show the real error so we can debug it
      const detail =
        err?.response?.data?.error ||   // API Gateway / Lambda error body
        err?.response?.data ||           // raw response body
        err?.message ||                  // JS error message
        String(err);
      setError(`Error: ${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Success screen ----
  if (incidentId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-gray-900">Report Submitted!</h1>
          <p className="text-gray-600">Your incident ID is:</p>
          <p className="text-xl font-mono font-bold text-blue-700">{incidentId}</p>
          <p className="text-sm text-gray-500">
            Save this ID. You'll receive updates at {email}.
          </p>
          <Link
            to={`/status/${incidentId}`}
            className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Track Report Status →
          </Link>
        </div>
      </div>
    );
  }

  // ---- Submission form ----
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🏛️ CivicOS</h1>
          <p className="text-gray-600 mt-1">Report a civic issue</p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-lg p-6 space-y-6"
        >
          {/* Voice recorder */}
          <VoiceRecorder onRecordingComplete={setVoiceBlob} />

          {/* Text description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
              placeholder="Describe the issue... (e.g. 'Large pothole on Queen Street, near the intersection with K Road. It's been there for 2 weeks.')"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Image upload */}
          <FileDropZone onFileSelected={setImageFile} />

          {/* Location */}
          <LocationPicker
            onLocationChange={(loc, coords) => {
              setLocation(loc);
              setGps(coords);
            }}
          />

          {/* Email */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Your Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">
              You'll be CC'd on the formal email sent to the council.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? '⏳ Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
