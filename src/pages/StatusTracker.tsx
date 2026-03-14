// ============================================
// Screen 2 — Status Tracking Page
// URL: /status/:incidentId
// Dark blue-purple + orange theme
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProgressTracker from '../components/ProgressTracker';
import { getReportStatus } from '../services/api';
import type { IncidentRecord } from '../types/incident';

export default function StatusTracker() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const [record, setRecord] = useState<IncidentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchStatus = useCallback(async (isManual = false) => {
    if (!incidentId) return;
    if (isManual) setRefreshing(true);
    try {
      const data = await getReportStatus(incidentId);
      if (data) {
        setRecord(data);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ---- Loading ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/50 text-lg">Loading report...</p>
      </div>
    );
  }

  // ---- Not found ----
  if (notFound || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card-orange p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">🔍</div>
          <h1 className="text-2xl font-bold text-white">Report Not Found</h1>
          <p className="text-white/60">
            No report found for <span className="font-mono font-bold text-orange-400">{incidentId}</span>.
            Please check the ID and try again.
          </p>
          <Link to="/" className="btn-cone inline-block mt-4 px-6 py-3">
            ← Submit a New Report
          </Link>
        </div>
      </div>
    );
  }

  // ---- Status display ----
  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-orange-400">Civic</span><span className="text-white">OS</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Report Status</p>
        </div>

        {/* Incident ID card */}
        <div className="glass-card-orange p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-white/50">Incident ID</p>
            <p className="text-xl font-mono font-bold text-orange-400">
              {record.incident_id}
            </p>
            <p className="text-xs text-white/30 mt-1">
              Submitted {new Date(record.created_at).toLocaleString()}
            </p>
          </div>

          {/* Progress stepper */}
          <div>
            <h2 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wide">
              Progress
            </h2>
            <ProgressTracker currentStatus={record.status} />
          </div>

          {/* AI Classification */}
          {record.ai_analysis && (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
                AI Classification
              </h2>

              {/* Summary */}
              {record.ai_analysis.summary && (
                <p className="text-sm text-white/60 italic">
                  "{record.ai_analysis.summary}"
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium">{record.ai_analysis.category}</p>
                </div>
                <div>
                  <p className="text-gray-500">Subcategory</p>
                  <p className="font-medium">{record.ai_analysis.subcategory}</p>
                </div>
                <div>
                  <p className="text-gray-500">Risk Level</p>
                  <p className="font-medium capitalize">{record.ai_analysis.risk_level}</p>
                </div>
                <div>
                  <p className="text-gray-500">Report Type</p>
                  <p className="font-medium capitalize">{record.ai_analysis.report_type}</p>
                </div>
                <div>
                  <p className="text-gray-500">Confidence</p>
                  <p className="font-medium">
                    {(record.ai_analysis.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Severity Score</p>
                  <p className="font-medium">
                    {record.ai_analysis.severity.toFixed(2)}
                  </p>
                </div>
              </div>

              {record.ai_analysis.location_extracted && (
                <div>
                  <p className="text-white/40 text-sm">AI-Detected Location</p>
                  <p className="text-sm font-medium text-white/90">{record.ai_analysis.location_extracted}</p>
                </div>
              )}
            </div>
          )}

          {/* Voice transcript */}
          {record.transcript && (
            <div className="border-t border-white/10 pt-4 space-y-2">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
                Voice Transcript
              </h2>
              <p className="text-sm text-white/60 italic">"{record.transcript}"</p>
            </div>
          )}

          {/* Routing info */}
          {record.routing && (
            <div className="border-t border-white/10 pt-4 space-y-2">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
                Sent To
              </h2>
              <p className="text-sm font-medium">{(record.routing as any).authority || (record.routing as any).department || 'N/A'}</p>
              {(record.routing as any).email && (
                <p className="text-sm text-gray-500">{(record.routing as any).email}</p>
              )}
            </div>
          )}

          {/* Email confirmation */}
          {record.email && (
            <div className="border-t border-white/10 pt-4 space-y-2">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
                Email Status
              </h2>
              <div className="text-sm space-y-1 text-white/80">
                <p>
                  {(record.email as any).ses_message_id || (record.email as any).authority_email_sent ? '✅' : '⬜'} Sent to authority
                </p>
                <p>
                  {(record.email as any).cc_citizen || (record.email as any).citizen_cc_sent ? '✅' : '⬜'} You were CC'd
                </p>
                {(record.email as any).sent_at && (
                  <p className="text-xs text-gray-400">
                    Sent at {new Date((record.email as any).sent_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="border-t border-white/10 pt-4 flex gap-3">
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm"
            >
              {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Status'}
            </button>
            <Link to="/" className="btn-cone flex-1 text-sm text-center">
              ← New Report
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/30">
          Status auto-refreshes every 30 seconds.
        </p>
      </div>
    </div>
  );
}
