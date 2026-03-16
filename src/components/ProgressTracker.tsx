// ============================================
// ProgressTracker — Shows the 5-step pipeline
// Dark theme variant
// ============================================

import type { IncidentStatus } from '../types/incident';

interface ProgressTrackerProps {
  currentStatus: IncidentStatus;
}

const STEPS: { key: IncidentStatus; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'analyzed', label: 'AI Classification' },
  { key: 'legal_review', label: 'Legal Review' },
  { key: 'sent', label: 'Sent to Authority' },
  { key: 'authority_response', label: 'Authority Response' },
];

function getStepIndex(status: IncidentStatus): number {
  if (status === 'unsupported') return 2;
  if (status === 'processing_failed') return 1;
  if (status === 'needs_location') return 1;
  if (status === 'sent_to_authority') return STEPS.findIndex((s) => s.key === 'sent');
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function ProgressTracker({ currentStatus }: ProgressTrackerProps) {
  const currentIndex = getStepIndex(currentStatus);

  return (
    <div className="space-y-1">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isPending = i > currentIndex;
        const isUnsupported = currentStatus === 'unsupported' && i === 1;
        const isFailed = currentStatus === 'processing_failed' && i === 1;
        const isNeedsLocation = currentStatus === 'needs_location' && i === 1;

        let icon = '⬜';
        let textColor = 'text-white/30';
        let label = step.label;

        if (isFailed) {
          icon = '❌';
          textColor = 'text-red-400';
          label = 'AI Classification — Processing failed';
        } else if (isUnsupported) {
          icon = '⚠️';
          textColor = 'text-yellow-400';
          label = 'AI Classification — Unsupported issue type';
        } else if (isNeedsLocation) {
          icon = '📍';
          textColor = 'text-orange-400';
          label = 'AI Classification — Location not specific enough';
        } else if (isCompleted) {
          icon = '✅';
          textColor = 'text-green-400';
        } else if (isCurrent) {
          icon = '🔄';
          textColor = 'text-orange-400 font-semibold';
        } else if (isPending) {
          icon = '⬜';
          textColor = 'text-white/30';
        }

        return (
          <div key={step.key} className={`flex items-center gap-3 py-2 ${textColor}`}>
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

