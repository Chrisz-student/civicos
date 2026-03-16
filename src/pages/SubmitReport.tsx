// ============================================
// Screen 1 — Submit a Report (Multi-step wizard)
// Steps:
//   1) Choose input type (Image / Text / Audio)
//   2) Provide content   (conditional on type)
//   3) Email address
//   4) Review + Submit
// GSAP slide-in from right on each step advance
// ============================================

import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import VoiceRecorder from '../components/VoiceRecorder';
import FileDropZone from '../components/FileDropZone';
import { submitReport, uploadFileToS3 } from '../services/api';
import type { GPS } from '../types/incident';

const TOTAL_STEPS = 4;

type InputType = 'image' | 'text' | 'audio';

export default function SubmitReport() {
  const navigate = useNavigate();

  // ---- Wizard state ----
  const [step, setStep] = useState(1);
  const stepRef = useRef<HTMLDivElement>(null);

  // ---- Input type ----
  const [inputType, setInputType] = useState<InputType | null>(null);

  // ---- Content state (only the relevant field is used per type) ----
  const [textContent, setTextContent] = useState('');        // type=text
  const [imageFile, setImageFile] = useState<File | null>(null);   // type=image
const [imageLocation, setImageLocation] = useState('');    // type=image — separate location field
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);   // type=audio
  const [gps, setGps] = useState<GPS | null>(null);

  // ---- Email ----
  const [email, setEmail] = useState('');

  // ---- Submission state ----
  const [submitting, setSubmitting] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Status lookup ----
  const [lookupId, setLookupId] = useState('');

  // ---- GSAP slide-in ----
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

  // ---- Navigation helpers ----
  const goNext = () => {
    setError(null);

    // Per-step validation
    if (step === 1 && !inputType) {
      setError('Please choose an input type to continue.');
      return;
    }
    if (step === 2) {
      if (inputType === 'image') {
        if (!imageFile) {
          setError('Please upload an image.');
          return;
        }
        if (!imageLocation.trim()) {
          setError('Please enter the location of the issue (Auckland address or landmark).');
          return;
        }
      }
      if (inputType === 'text' && !textContent.trim()) {
        setError('Please describe the issue before continuing.');
        return;
      }
      if (inputType === 'audio' && !voiceBlob) {
        setError('Please record your voice description before continuing.');
        return;
      }
    }
    if (step === 3 && !email.trim()) {
      setError('Please enter your email address.');
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
        onComplete: () => setStep((s) => s - 1),
      });
    }
  };

  // ---- Choose type and immediately advance ----
  const selectInputType = (type: InputType) => {
    setInputType(type);
    setError(null);
    gsap.to(stepRef.current, {
      x: -300,
      opacity: 0,
      duration: 0.3,
      ease: 'power3.in',
      onComplete: () => setStep(2),
    });
  };

  // ---- Submit handler ----
  const handleSubmit = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        citizen_email: email,
        input_type: inputType,
      };

      if (inputType === 'image') {
        // Location supplied from separate text input; AI analyses the image for context
        payload.location = imageLocation;
        payload.content_type = imageFile!.type;
      } else if (inputType === 'text') {
// No location field — AI extracts it from the text
        payload.text_content = textContent;
      } else if (inputType === 'audio') {
        // No location field — AI extracts it from the transcript
        payload.content_type = 'audio/webm';
      }

      if (gps) payload.gps = gps;

      const result = await submitReport(payload as any);

      // Upload the file to S3
      if (inputType === 'audio' && voiceBlob) {
        await uploadFileToS3(result.upload_url, voiceBlob, 'audio/webm');
      } else if (inputType === 'image' && imageFile) {
        await uploadFileToS3(result.upload_url, imageFile, imageFile.type);
      }

      setIncidentId(result.incident_id);
    } catch (err: any) {
      console.error('Submit error:', err);
      const detail =
        err?.response?.data?.error ||
        err?.response?.data ||
        err?.message ||
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
            <div className={`step-dot ${s === step ? 'active' : s < step ? 'done' : ''}`} />
            {s < TOTAL_STEPS && (
              <div
                className="h-px w-8"
                style={{
                  background: s < step ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.15)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step panel */}
      <div className="w-full max-w-lg overflow-hidden">
        <div ref={stepRef} className="wizard-step">

          {/* ==== STEP 1: Choose input type ==== */}
          {step === 1 && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">📋</span>
                <h2 className="text-xl font-bold text-white mt-2">How would you like to report?</h2>
                <p className="text-sm text-white/50 mt-1">Choose the type of evidence you have</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Image card */}
                <button
                  type="button"
                  onClick={() => selectInputType('image')}
                  className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span className="text-3xl">📸</span>
                  <div>
                    <p className="font-semibold text-white">Photo</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      Upload an image — AI analyses the issue from the photo. You'll supply the location separately.
                    </p>
                  </div>
                </button>

                {/* Text card */}
                <button
                  type="button"
                  onClick={() => selectInputType('text')}
                  className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span className="text-3xl">📝</span>
                  <div>
                    <p className="font-semibold text-white">Text</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      Describe the issue in writing — AI will extract the location and classify it automatically.
                    </p>
                  </div>
                </button>

                {/* Audio card */}
                <button
                  type="button"
                  onClick={() => selectInputType('audio')}
                  className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span className="text-3xl">🎤</span>
                  <div>
                    <p className="font-semibold text-white">Voice Recording</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      Record a voice message — AI transcribes it and extracts the location automatically.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ==== STEP 2: Content (conditional on input type) ==== */}
          {step === 2 && inputType === 'image' && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">📸</span>
                <h2 className="text-xl font-bold text-white mt-2">Upload Your Photo</h2>
                <p className="text-sm text-white/50 mt-1">AI will analyse the image and classify the issue</p>
              </div>

              <FileDropZone onFileSelected={setImageFile} />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">
                  📍 Where is the issue?
                </label>
                <input
                  type="text"
                  value={imageLocation}
                  onChange={(e) => setImageLocation(e.target.value)}
                  placeholder="e.g. 142 Queen Street, Auckland CBD"
                  className="dark-input w-full"
                />
                <p className="text-xs text-white/40">
                  Enter an Auckland address, street intersection, or well-known landmark.
                </p>
              </div>
            </div>
          )}

          {step === 2 && inputType === 'text' && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">📝</span>
                <h2 className="text-xl font-bold text-white mt-2">Describe the Issue</h2>
                <p className="text-sm text-white/50 mt-1">AI will extract the location and classify the report</p>
              </div>

              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                placeholder="e.g. There is a large pothole on Queen Street near the K Road intersection that has been there for two weeks and is causing damage to vehicles."
                className="dark-input w-full resize-none"
              />

              <div
                className="rounded-xl p-3 text-xs"
                style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}
              >
<p className="text-orange-300 font-semibold">📍 Location tip</p>
                <p className="text-orange-200/70 mt-1">
                  Include a specific Auckland street name, address, or well-known landmark (e.g. "in front of Sky Tower", "corner of Ponsonby Road and Franklin Road"). Vague references like "the road near me" cannot be processed.
                </p>
              </div>

              {/* Emergency warning */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
                <p className="text-sm text-red-300 font-semibold">🚨 Is this an emergency?</p>
                <p className="text-xs text-red-200/70 mt-1">
                  If someone is in immediate danger, do not use this form. Call{' '}
                  <span className="font-bold text-red-300">111</span> immediately.
                </p>
              </div>
            </div>
          )}

          {step === 2 && inputType === 'audio' && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">🎤</span>
                <h2 className="text-xl font-bold text-white mt-2">Record Your Report</h2>
                <p className="text-sm text-white/50 mt-1">Speak naturally — AI will transcribe and classify it</p>
              </div>

              <VoiceRecorder onRecordingComplete={setVoiceBlob} />

              <div
                className="rounded-xl p-3 text-xs"
                style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}
              >
<p className="text-orange-300 font-semibold">📍 Location tip</p>
                <p className="text-orange-200/70 mt-1">
                  Make sure to say a specific Auckland street name or landmark (e.g. "outside the Countdown on Queen Street"). Vague directions cannot be processed.
                </p>
              </div>

              {/* Emergency warning */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
                <p className="text-sm text-red-300 font-semibold">🚨 Is this an emergency?</p>
                <p className="text-xs text-red-200/70 mt-1">
                  If someone is in immediate danger, do not use this form. Call{' '}
                  <span className="font-bold text-red-300">111</span> immediately.
                </p>
              </div>
            </div>
          )}

          {/* ==== STEP 3: Email ==== */}
          {step === 3 && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">✉️</span>
                <h2 className="text-xl font-bold text-white mt-2">Your Email</h2>
                <p className="text-sm text-white/50 mt-1">We'll send you updates and CC you on the council email</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">Email Address</label>
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
            </div>
          )}

          {/* ==== STEP 4: Review + Submit ==== */}
          {step === 4 && (
            <div className="glass-card-orange p-6 space-y-5">
              <div className="text-center">
                <span className="text-3xl">🚀</span>
                <h2 className="text-xl font-bold text-white mt-2">Review & Submit</h2>
                <p className="text-sm text-white/50 mt-1">Check your report before sending</p>
              </div>

              <div
                className="rounded-xl p-4 space-y-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Summary</p>
                <div className="text-sm text-white/80 space-y-1">
                  <p>
                    📋 <span className="text-white/50">Type:</span>{' '}
                    {inputType === 'image' ? '📸 Photo' : inputType === 'text' ? '📝 Text' : '🎤 Audio'}
                  </p>
                  {inputType === 'image' && (
                    <>
                      <p>📍 <span className="text-white/50">Location:</span> {imageLocation || <span className="italic text-white/30">not set</span>}</p>
                      <p>📸 <span className="text-white/50">Photo:</span> {imageFile ? imageFile.name : <span className="italic text-white/30">none</span>}</p>
                    </>
                  )}
                  {inputType === 'text' && (
                    <p>📝 <span className="text-white/50">Description:</span>{' '}
                      {textContent ? textContent.slice(0, 80) + (textContent.length > 80 ? '…' : '') : <span className="italic text-white/30">none</span>}
                    </p>
                  )}
                  {inputType === 'audio' && (
                    <p>🎤 <span className="text-white/50">Voice:</span> {voiceBlob ? 'Recorded ✅' : <span className="italic text-white/30">none</span>}</p>
                  )}
                  <p>✉️ <span className="text-white/50">Email:</span> {email}</p>
                </div>
              </div>

              {inputType !== 'image' && (
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}
                >
                  <p className="text-orange-300/80">
                  ℹ️ AI will extract the location from your {inputType === 'audio' ? 'voice recording' : 'description'}. If no recognisable Auckland location is found, you'll be asked to re-submit.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="max-w-lg w-full mt-4 p-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
        >
          {error}
        </div>
      )}

      {/* Navigation buttons — hidden on step 1 (type cards auto-advance) */}
      {step > 1 && (
        <div className="max-w-lg w-full mt-6 flex gap-3">
          <button type="button" onClick={goBack} className="btn-ghost flex-1">
            â† Back
          </button>
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
      )}

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
