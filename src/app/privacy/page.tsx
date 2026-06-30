'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ConsentItem {
  feature: string;
  label: string;
  description: string;
  status: 'enabled' | 'disabled' | 'not-available';
  phase: string;
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    feature: 'analytics',
    label: 'Session Analytics',
    description: 'Anonymised session data used to improve hazard detection accuracy.',
    status: 'enabled',
    phase: 'Phase 1',
  },
  {
    feature: 'face_recognition',
    label: 'Face Recognition',
    description:
      'Recognises people you designate (family, caregivers). Requires explicit consent. Not enabled in Phase 1.',
    status: 'not-available',
    phase: 'Phase 3',
  },
  {
    feature: 'emergency_streaming',
    label: 'Emergency Camera Streaming',
    description:
      'Streams live camera to trusted contacts or emergency services. Not enabled in Phase 1.',
    status: 'not-available',
    phase: 'Phase 4',
  },
];

export default function PrivacyPage() {
  const [consents, setConsents] = useState(CONSENT_ITEMS);
  const [dataDeleted, setDataDeleted] = useState(false);
  const [exported, setExported] = useState(false);

  const toggle = (feature: string) => {
    setConsents((c) =>
      c.map((item) =>
        item.feature === feature && item.status !== 'not-available'
          ? { ...item, status: item.status === 'enabled' ? 'disabled' : 'enabled' }
          : item
      )
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Privacy & Consent</h1>
      <p className="text-gray-400 text-sm mb-8">
        Denarixx Vision AI is built privacy-first. You control what data is collected
        and how it is used. Face recognition and emergency streaming are disabled in
        Phase 1 and require explicit opt-in when available.
      </p>

      <section aria-labelledby="consent-heading" className="mb-8">
        <h2 id="consent-heading" className="text-xl font-bold text-white mb-4">
          Feature Consent
        </h2>
        <div className="space-y-3">
          {consents.map((item) => (
            <Card key={item.feature}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{item.label}</span>
                    <Badge variant="muted">{item.phase}</Badge>
                    {item.status === 'not-available' && (
                      <Badge variant="muted">Not in Phase 1</Badge>
                    )}
                    {item.status === 'enabled' && (
                      <Badge variant="success">Enabled</Badge>
                    )}
                    {item.status === 'disabled' && (
                      <Badge variant="muted">Disabled</Badge>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
                <Button
                  onClick={() => toggle(item.feature)}
                  disabled={item.status === 'not-available'}
                  variant={item.status === 'enabled' ? 'danger' : 'primary'}
                  size="sm"
                  aria-label={`${item.status === 'enabled' ? 'Disable' : 'Enable'} ${item.label}`}
                >
                  {item.status === 'not-available'
                    ? 'Unavailable'
                    : item.status === 'enabled'
                    ? 'Disable'
                    : 'Enable'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="data-heading" className="mb-8">
        <h2 id="data-heading" className="text-xl font-bold text-white mb-4">
          Your Data
        </h2>
        <Card>
          <p className="text-gray-400 text-sm mb-4">
            You have the right to export or delete all data associated with your account
            at any time. These are GDPR-style controls — your data belongs to you.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => setExported(true)}
              variant="outline"
              size="md"
              aria-label="Export your data"
            >
              📥 Export My Data
            </Button>
            <Button
              onClick={() => setDataDeleted(true)}
              variant="danger"
              size="md"
              aria-label="Delete all your data"
            >
              🗑 Delete All My Data
            </Button>
          </div>
          {exported && (
            <p className="text-green-400 text-sm mt-3" role="status">
              ✓ Export queued. In a production system, you would receive a data download link by email.
            </p>
          )}
          {dataDeleted && (
            <p className="text-red-400 text-sm mt-3" role="status">
              ✓ Deletion requested. In a production system, all personal data would be purged within 30 days.
            </p>
          )}
        </Card>
      </section>

      <section aria-labelledby="legal-heading">
        <h2 id="legal-heading" className="text-xl font-bold text-white mb-4">
          Legal Framework
        </h2>
        <Card className="border-gray-700">
          <div className="text-gray-400 text-sm space-y-3">
            <p>
              <strong className="text-white">GDPR / UK GDPR:</strong> Face recognition
              data is a special category (Article 9). A Data Protection Impact Assessment
              (DPIA) will be completed before that feature is enabled. Individual deletion
              rights are supported.
            </p>
            <p>
              <strong className="text-white">BIPA (Illinois):</strong> If the app operates
              in the US, Illinois BIPA-compliant consent and deletion flows will be
              implemented before face recognition ships.
            </p>
            <p>
              <strong className="text-white">Medical Device:</strong> Denarixx Vision AI
              is not a medical device. The medication safety feature reads labels — it does
              not make clinical decisions or dosage recommendations.
            </p>
            <p>
              <strong className="text-white">Emergency streaming:</strong> When enabled
              in a future phase, emergency camera streaming will include explicit disclosure
              that bystanders may be captured, and will comply with jurisdiction-specific
              regulations.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
