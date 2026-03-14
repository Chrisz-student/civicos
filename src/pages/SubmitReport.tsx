// ============================================
// Screen 1 — Submit a Report (Multi-step wizard)
// Steps: 1) Location  2) Evidence  3) Description  4) Email + Submit
// GSAP slide-in from right on each step
// ============================================

import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import VoiceRecorder from '../components/VoiceRecorder';
import FileDropZone from '../components/FileDropZone';
import LocationPicker from '../components/LocationPicker';
import { submitReport, uploadFileToS3 } from '../services/api';
import type { GPS } from '../types/incident';

const TOTAL_STEPS = 4;

export default function SubmitReport() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const stepRef = useRef<HTMLDivElement>(null);

  // Form state
  const [textContent, setTextContent] = useState('');
  const [location, setLocation] = useState('');
  const [gps, setGps] = useState<GPS | null>(null);
  const [email, setEmail] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);

  // ---- Submission state ----
  const [submitting, setSubmitting] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Status lookup state
  const [lookupId, setLookupId] = useState('');

  const animateIn = useCallback((direction: 'right' | 'left') => {
    if (!stepRef.current) return;
    const xFrom = direction === 'right' ? 300 : -300;
    gsap.fromTo(
      stepRef.current,
      { x: xFrom, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' },
    );
  }, []);

  useLayoutEffect(() => {
    animateIn('right');
  }, [step, animateIn]);

  const goNext = () => {
    setError(null);
    if (step === 1 && !location.trim()) {
      setError('Please provide a location before continuing.');
      return;
    }
    if (step < TOTAL_STEPS) {
      gsap.to(stepRef.current, {
        x: -300,
        opacity: 0,
        duration: 0.3,
        ease: 'power3.in',
        onComplete: () => setStep((s) => s + 1),
      });
    }
  };

  const goBack = () => {
    setError(null);
    if (step > 1) {
      gsap.to(stepRef.current, {
        x: 300,
        opacity: 0,
        duration: 0.3,
        ease: 'power3.in',
        onComplete: () => {
          setStep((s) => s - 1);
        },
      });
    }
  };

  // Figure out the input type to send
  const getInputType = (): 'voice' | 'image' | 'text' => {
    if (voiceBlob) return 'voice';
    if (imageFile) return 'image';
    return 'text';
  };

  // ---- Submit handler ----
  const handleSubmit = async () => {
    setError(null);

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
      // Tell the Lambda the actual file content type so the presigned URL matches.
      // Priority: voice > image (must match getInputType() order above)
      if (voiceBlob) {
        payload.content_type = 'audio/webm';
        // If user also attached an image, send its type so Lambda generates a second URL
        if (imageFile) {
          payload.image_content_type = imageFile.type;
        }
      } else if (imageFile) {
        payload.content_type = imageFile.type;
      }

      const result = await submitReport(payload as any);

      // Step 2: Upload files to S3
      if (voiceBlob) {
        await uploadFileToS3(result.upload_url, voiceBlob, 'audio/webm');
      }
      // Upload image separately if we have one (works whether or not voice was also recorded)
      if (imageFile) {
        const imageUrl = result.image_upload_url || (voiceBlob ? '' : result.upload_url);
        if (imageUrl) {
          await uploadFileToS3(imageUrl, imageFile, imageFile.type);
        }
      }

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

  // =============================================
  // SUCCESS SCREEN
  // =============================================
  if (incidentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card-orange p-8 max-w-md w-full text-center space-y-5">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-white">Report Submitted!</h1>
          <p className="text-white/70">Your incident ID is:</p>
          <p className="text-2xl font-mono font-bold text-orange-400">{incidentId}</p>
          <p className="text-sm text-white/50">
            Save this ID. You'll receive updates at {email}.
          </p>
          <Link
            to={`/status/${incidentId}`}
            className="btn-cone inline-block mt-4 px-8 py-3 text-center"
          >
            Track Report Status →
          </Link>
        </div>
      </div>
    );
  }

  // =============================================
  // WIZARD FORM
  // =============================================
  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-orange-400">Civic</span><span className="text-white">OS</span>
        </h1>
        <p className="text-white/50 mt-1 text-sm">Automated Civic Reporting</p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-3 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`step-dot ${s === step ? 'active' : s < step ? 'done' : ''}`}
            />
            {s < TOTAL_STEPS && (
              <div
                className="h-px w-8"
                style={{
                  background:
                    s < step
                      ? 'rgba(74, 222, 128, 0.5)'
                      : 'rgba(255, 255, 255, 0.15)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step panel — overflow hidden to clip slide animations */}
      <div className="w-full max-w-lg overflow-hidden">
        <div ref={stepRef} className="wizard-step">
          {/* ==== STEP 1: Location ==== */}
          {step === 1 && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">📍</span>
                <h2 className="text-xl font-bold text-white mt-2">Where is the issue?</h2>
                <p className="text-sm text-white/50 mt-1">Enter the location or paste GPS coordinates</p>
              </div>

              <LocationPicker
                onLocationChange={(loc, coords) => {
                  setLocation(loc);
                  setGps(coords);
                }}
              />
            </div>
          )}

          {/* ==== STEP 2: Evidence (Photo / Voice) ==== */}
          {step === 2 && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">📸</span>
                <h2 className="text-xl font-bold text-white mt-2">Add Evidence</h2>
                <p className="text-sm text-white/50 mt-1">Upload a photo or record a voice description (optional)</p>
              </div>

              <FileDropZone onFileSelected={setImageFile} />
              <VoiceRecorder onRecordingComplete={setVoiceBlob} />
            </div>
          )}

          {/* ==== STEP 3: Description ==== */}
          {step === 3 && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">📝</span>
                <h2 className="text-xl font-bold text-white mt-2">Describe the Issue</h2>
                <p className="text-sm text-white/50 mt-1">Tell us what's happening in your own words</p>
              </div>

              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={5}
                placeholder="e.g. Large pothole on Queen Street, near the intersection with K Road. It's been there for 2 weeks."
                className="dark-input w-full resize-none"
              />

              {/* 111 emergency warning */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
                <p className="text-sm text-red-300 font-semibold">🚨 Is this an emergency?</p>
                <p className="text-xs text-red-200/70 mt-1">
                  If someone is in immediate danger, do not use this form.
                  Call <span className="font-bold text-red-300">111</span> (NZ Emergency Services) immediately.
                </p>
              </div>
            </div>
          )}

          {/* ==== STEP 4: Email + Review + Submit ==== */}
          {step === 4 && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">✉️</span>
                <h2 className="text-xl font-bold text-white mt-2">Almost Done!</h2>
                <p className="text-sm text-white/50 mt-1">Enter your email and review your report</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">Your Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="dark-input w-full"
                />
                <p className="text-xs text-white/40">
                  You'll be CC'd on the formal email sent to the council.
                </p>
              </div>

              {/* Review summary */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Review</p>
                <div className="text-sm text-white/80 space-y-1">
                  <p>📍 <span className="text-white/50">Location:</span> {location || <span className="italic text-white/30">not set</span>}</p>
                  <p>📸 <span className="text-white/50">Photo:</span> {imageFile ? imageFile.name : <span className="italic text-white/30">none</span>}</p>
                  <p>🎤 <span className="text-white/50">Voice:</span> {voiceBlob ? 'Recorded' : <span className="italic text-white/30">none</span>}</p>
                  <p>📝 <span className="text-white/50">Description:</span> {textContent ? textContent.slice(0, 60) + (textContent.length > 60 ? '…' : '') : <span className="italic text-white/30">none</span>}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-lg w-full mt-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="max-w-lg w-full mt-6 flex gap-3">
        {step > 1 && (
          <button type="button" onClick={goBack} className="btn-ghost flex-1">
            ← Back
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button type="button" onClick={goNext} className="btn-cone flex-1 py-3 text-lg">
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-cone flex-1 py-3 text-lg"
          >
            {submitting ? '⏳ Submitting...' : '🚀 Submit Report'}
          </button>
        )}
      </div>

      {/* Check existing report */}
      <div className="max-w-lg w-full mt-8 glass-card p-5">
        <p className="text-sm font-semibold text-white/60 mb-3">Already submitted a report?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value.toUpperCase())}
            placeholder="Enter Incident ID (e.g. CIV-2026-35195)"
            className="dark-input flex-1 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => { if (lookupId.trim()) navigate(`/status/${lookupId.trim()}`); }}
            disabled={!lookupId.trim()}
            className="btn-ghost text-sm whitespace-nowrap"
          >
            Check Status
          </button>
        </div>
      </div>
    </div>
  );
}
