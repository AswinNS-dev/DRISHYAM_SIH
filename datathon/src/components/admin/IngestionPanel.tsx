import React, { useEffect, useMemo, useState } from 'react';
import { Database, Play, Loader2, RefreshCw, Archive, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';
import {
  archiveIngestionJob,
  createIngestionJob,
  getIngestionJobs,
  getIngestionSources,
  type IngestionJobRecord,
  type IngestionSourcesResponse,
} from '../../services/api';

const STATUS_TONES: Record<string, string> = {
  pending: 'bg-blue-950/40 text-blue-300 border-blue-500/30',
  validated: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
  imported: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-950/40 text-red-300 border-red-500/30',
  archived: 'bg-zinc-950/40 text-zinc-400 border-zinc-500/30',
};

const ROW_TEMPLATE: Record<string, Record<string, string>> = {
  cdr_record: { caller_number: '', callee_number: '', call_direction: 'outgoing' },
  financial_transaction: { person_a_name: '', person_b_name: '', amount: '' },
  surveillance: { person_name: '', location_name: '' },
  social_media: { person_name: '', organization_name: '', platform: '' },
  fir_record: { fir_number: '', case_number: '', person_name: '', title: '', raw_text: '' },
  police_report: { title: '', case_number: '', person_name: '', raw_text: '' },
  criminal_history: { person_name: '', aliases: '', status: '' },
  intelligence_report: { title: '', person_name: '', organization_name: '', raw_text: '' },
};

const IngestionPanel: React.FC = () => {
  const [sources, setSources] = useState<IngestionSourcesResponse | null>(null);
  const [jobs, setJobs] = useState<IngestionJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sourceType, setSourceType] = useState('cdr_record');
  const [sourceName, setSourceName] = useState('');
  const [rowsText, setRowsText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [src, jobList] = await Promise.all([
        getIngestionSources(),
        getIngestionJobs(1),
      ]);
      setSources(src);
      setJobs(jobList.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingestion data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const spec = useMemo(
    () => sources?.supported_source_types.find((t) => t.source_type === sourceType) || null,
    [sources, sourceType]
  );

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      let records: Array<Record<string, unknown>>;
      const trimmed = rowsText.trim();
      if (!trimmed) throw new Error('Provide at least one record (JSON array or one JSON object per line).');
      try {
        const parsed = JSON.parse(trimmed);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        records = trimmed.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
      }
      const job = await createIngestionJob({
        source_type: sourceType,
        source_name: sourceName.trim() || undefined,
        records,
      });
      setMessage(
        `Job ${job.id.slice(0, 8)}: ${job.status} — ${job.valid_records} valid, ${job.invalid_records} invalid, ` +
        `${job.relationships_created} relationship(s), ${job.entities_created} new entity/entities created.`
      );
      setRowsText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const doArchive = async (jobId: string) => {
    try {
      await archiveIngestionJob(jobId);
      setMessage('Job archived.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const insertTemplate = () => {
    const tmpl = ROW_TEMPLATE[sourceType] || {};
    setRowsText(JSON.stringify([tmpl], null, 2));
  };

  return (
    <div className="space-y-4 font-mono">
      <div className="rounded border border-[var(--border-muted)] bg-[var(--bg-secondary)]/50 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#1E6FD9]" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">SIH26189 Data Ingestion</h3>
        </div>
        <p className="text-[9.5px] leading-relaxed text-[var(--text-secondary)]">
          Structured intelligence ingestion into <b>raw_ingested_data</b> with validation, normalization and deterministic
          entity/relationship linking that feeds the network graph. Free text is stored <b>verbatim</b> — DRISHYAM does
          <b> not</b> implement NER/NLP. Every job is audited. Ingestion is restricted to ADMIN by backend authorization.
        </p>
      </div>

      {(error || message) && (
        <div className={`rounded border px-3 py-2 text-[10px] uppercase tracking-wider flex items-center gap-2 ${error ? 'border-red-500/30 text-red-300' : 'border-[#0E9E78]/30 text-[#0E9E78]'}`}>
          {error ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {error ?? message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Submit new job */}
        <div className="rounded border border-[var(--border-muted)] bg-[var(--bg-primary)]/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">New Ingestion Job</h4>
            <button onClick={insertTemplate} className="text-[9px] text-[#1E6FD9] hover:underline cursor-pointer">Insert template</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">Source type</span>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="mt-1 w-full rounded bg-[var(--bg-primary)] border border-border-color px-2 py-1.5 text-[11px] text-[var(--text-primary)]"
              >
                {(sources?.supported_source_types || []).map((t) => (
                  <option key={t.source_type} value={t.source_type}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">Source name (optional)</span>
              <input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. TelCo A, Crime Branch unit"
                className="mt-1 w-full rounded bg-[var(--bg-primary)] border border-border-color px-2 py-1.5 text-[11px] text-[var(--text-primary)]"
              />
            </label>
          </div>
          {spec && (
            <div className="text-[8.5px] leading-relaxed text-[var(--text-muted)]">
              <span className="text-[var(--accent-teal)]">Required:</span> {spec.required_fields.join(', ') || '—'}
              {spec.optional_fields.length > 0 && <> · <span className="text-[var(--text-secondary)]">Optional:</span> {spec.optional_fields.join(', ')}</>}
            </div>
          )}
          <label className="block">
            <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">Records (JSON array, or one JSON object per line, max 500)</span>
            <textarea
              value={rowsText}
              onChange={(e) => setRowsText(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder='[{"caller_number": "9880000001", "callee_number": "9880000002"}]'
              className="mt-1 w-full rounded bg-[var(--bg-primary)] border border-border-color px-2 py-2 text-[10px] text-[var(--text-primary)] leading-relaxed"
            />
          </label>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded border border-[#1E6FD9]/35 bg-[#1E6FD9]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run ingestion
          </button>
        </div>

        {/* Job history */}
        <div className="rounded border border-[var(--border-muted)] bg-[var(--bg-primary)]/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Ingestion Jobs</h4>
            <button onClick={() => void load()} className="inline-flex items-center gap-1 text-[9px] text-[#1E6FD9] hover:underline cursor-pointer">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-[10px] text-[var(--text-muted)] py-6 text-center">No ingestion jobs yet.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {jobs.map((job) => (
                <div key={job.id} className="rounded border border-[var(--border-muted)] bg-[var(--bg-secondary)]/40 p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded border text-[7.5px] font-bold uppercase ${STATUS_TONES[job.status] || 'border-zinc-500/30 text-zinc-400'}`}>{job.status}</span>
                    <span className="text-[9.5px] font-semibold text-[var(--text-primary)]">{job.source_type.replace(/_/g, ' ')}</span>
                    {job.source_name && <span className="text-[8.5px] text-[var(--text-muted)]">· {job.source_name}</span>}
                    <span className="ml-auto text-[8px] text-[var(--text-disabled)]">{job.created_at ? new Date(job.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5px] text-[var(--text-secondary)]">
                    <span>{job.total_records} total</span>
                    <span className="text-emerald-400">{job.valid_records} valid</span>
                    {job.invalid_records > 0 && <span className="text-red-400">{job.invalid_records} invalid</span>}
                    <span>{job.relationships_created} rel</span>
                    <span>{job.entities_created} entities</span>
                  </div>
                  {job.error_summary.length > 0 && (
                    <div className="mt-1 flex items-start gap-1 text-[8px] text-amber-400/90">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>Row errors: {job.error_summary.slice(0, 2).map((e) => `row ${e.row} (${e.errors[0]})`).join('; ')}{job.error_summary.length > 2 ? ` +${job.error_summary.length - 2} more` : ''}</span>
                    </div>
                  )}
                  {job.status !== 'archived' && (
                    <button onClick={() => void doArchive(job.id)} className="mt-1.5 inline-flex items-center gap-1 text-[8.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                      <Archive className="h-3 w-3" /> Archive
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 text-[8.5px] leading-relaxed text-[var(--text-disabled)]">
        <FileText className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Pipeline: accept → validate → normalize → store raw + structured → record source/timestamp/status → audit.
          Statuses: pending → validated → imported / failed → archived.
        </span>
      </div>
    </div>
  );
};

export default IngestionPanel;
