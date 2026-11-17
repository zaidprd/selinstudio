import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import type { ComplianceIssue } from '../types/studio';

interface CompliancePanelProps {
  issues: ComplianceIssue[];
  aiLabelAcknowledged: boolean;
  onToggleAiLabel: (checked: boolean) => void;
}

export function CompliancePanel({
  issues,
  aiLabelAcknowledged,
  onToggleAiLabel,
}: CompliancePanelProps) {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const passCount = issues.filter((i) => i.severity === 'pass').length;

  return (
    <div className="glass-card compact-compliance">
      <div className="compliance-summary-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.86rem' }}>
          <ShieldCheck size={17} style={{ color: 'var(--ok)' }} />
          <span>Status Kesiapan &amp; Adab Syar&apos;i</span>
        </div>
        <div className="row-actions">
          <span className="pill ok">{passCount} Aman</span>
          {warnCount > 0 && <span className="pill warn">{warnCount} Tips</span>}
          {errorCount > 0 && <span className="pill danger">{errorCount} Perbaiki</span>}
        </div>
      </div>

      {/* Show only errors or top warnings inline so beginners aren't overwhelmed */}
      {issues
        .filter((i) => i.severity === 'error')
        .map((issue) => (
          <div key={issue.id} className="status-item error" style={{ marginBlockStart: '0.55rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.83rem' }}>
              <XCircle size={15} />
              <span>{issue.title}</span>
            </div>
            <div className="hint">{issue.detail}</div>
          </div>
        ))}

      <details className="apple-details" style={{ marginBlockStart: '0.6rem' }}>
        <summary>Lihat rincian cek kepatuhan ({issues.length} poin)</summary>
        <div className="details-body">
          <div className="status-list" style={{ marginBlockStart: '0.55rem' }}>
            {issues.map((issue) => (
              <div key={issue.id} className={`status-item ${issue.severity}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.83rem' }}>
                  {issue.severity === 'pass' && <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />}
                  {issue.severity === 'warning' && <AlertTriangle size={15} style={{ color: 'var(--warn)' }} />}
                  {issue.severity === 'error' && <XCircle size={15} style={{ color: 'var(--danger)' }} />}
                  <span>{issue.title}</span>
                </div>
                <div className="hint" style={{ marginBlockStart: '0.15rem' }}>
                  {issue.detail}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBlockStart: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="ai-label-ack"
              checked={aiLabelAcknowledged}
              onChange={(e) => onToggleAiLabel(e.target.checked)}
              style={{ marginBlockStart: '0.2rem' }}
            />
            <label htmlFor="ai-label-ack" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
              Ingatkan toggle <strong>&ldquo;Konten dihasilkan AI&rdquo;</strong> saat unggah ke Shopee/TikTok jika
              memakai visual generatif.
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}
