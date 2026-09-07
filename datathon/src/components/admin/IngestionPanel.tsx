import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Play,
  Loader2,
  RefreshCw,
  Archive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Brain,
  Sparkles,
  Check,
  X,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  archiveIngestionJob,
  createIngestionJob,
  getIngestionJobs,
  getIngestionSources,
  listRawIngestionRecords,
  processNER,
  backfillNER,
  getRecordNER,
  reviewNERExtraction,
  type IngestionJobRecord,
  type IngestionSourcesResponse,
  type IngestionRecordItem,
  type NERExtractionRecord,
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
  const [activeTab, setActiveTab] = useState<'jobs' | 'ner'>('jobs');

  const [sources, setSources] = useState<IngestionSourcesResponse | null>(null);
  const [jobs, setJobs] = useState<IngestionJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sourceType, setSourceType] = useState('cdr_record');
  const [sourceName, setSourceName] = useState('');
  const [rowsText, setRowsText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // NER and Raw Records state
  const [rawRecords, setRawRecords] = useState<IngestionRecordItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [processingNERId, setProcessingNERId] = useState<string | null>(null);
  const [backfillingNER, setBackfillingNER] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [extractionsByRecord, setExtractionsByRecord] = useState<Record<string, NERExtractionRecord[]>>({});
  const [loadingExtractions, setLoadingExtractions] = useState<Record<string, boolean>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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

  const loadRecords = async () => {
    setLoadingRecords(true);
    setError(null);
    try {
      const recs = await listRawIngestionRecords(50);
      setRawRecords(recs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load raw ingestion records');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activeTab === 'ner') {
      void loadRecords();
    }
  }, [activeTab]);

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

  // NER actions
  const handleRunNER = async (recordId: string) => {
    setProcessingNERId(recordId);
    setError(null);
    setMessage(null);
    try {
      const res = await processNER(recordId);
      setMessage(`Assistive NER processed: ${res.extractions_count} entities extracted.`);
      setExtractionsByRecord((prev) => ({ ...prev, [recordId]: res.extractions }));
      setExpandedRecordId(recordId);
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NER processing failed');
    } finally {
      setProcessingNERId(null);
    }
  };

  const handleBackfillNER = async () => {
    setBackfillingNER(true);
    setError(null);
    setMessage(null);
    try {
      const res = await backfillNER(100);
      setMessage(`Assistive NER Backfill complete: processed ${res.processed_count} records.`);
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backfill failed');
    } finally {
      setBackfillingNER(false);
    }
  };

  const toggleExpandRecord = async (recordId: string) => {
    if (expandedRecordId === recordId) {
      setExpandedRecordId(null);
      return;
    }
    setExpandedRecordId(recordId);
    if (!extractionsByRecord[recordId]) {
      setLoadingExtractions((prev) => ({ ...prev, [recordId]: true }));
      try {
        const exts = await getRecordNER(recordId);
        setExtractionsByRecord((prev) => ({ ...prev, [recordId]: exts }));
      } catch {
        // ignore
      } finally {
        setLoadingExtractions((prev) => ({ ...prev, [recordId]: false }));
      }
    }
  };

  const handleReviewLead = async (extractionId: string, decision: 'confirmed' | 'rejected', recordId: string) => {
    setReviewingId(extractionId);
    setError(null);
    try {
      await reviewNERExtraction(extractionId, decision);
      setMessage(`Lead marked as ${decision}. Action audited.`);
      // Refresh extractions for this record
      const exts = await getRecordNER(recordId);
      setExtractionsByRecord((prev) => ({ ...prev, [recordId]: exts }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setReviewingId(null);
    }
  };

  const getEntityBadgeStyle = (entityType: string) => {
    switch (entityType.toUpperCase()) {
      case 'VEHICLE':
        return 'border-purple-500/40 bg-purple-950/40 text-purple-300';
      case 'PHONE':
        return 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300';
      case 'PERSON':
      case 'CRIMINAL':
        return 'border-red-500/40 bg-red-950/40 text-red-300';
      case 'LOCATION':
        return 'border-blue-500/40 bg-blue-950/40 text-blue-300';
      case 'MONEY':
        return 'border-amber-500/40 bg-amber-950/40 text-amber-300';
      case 'ORGANIZATION':
      case 'ORG':
        return 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300';
      case 'FIR':
        return 'border-teal-500/40 bg-teal-950/40 text-teal-300';
      default:
        return 'border-zinc-500/40 bg-zinc-950/40 text-zinc-300';
    }
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Header Info */}
      <div className="rounded border border-[var(--border-muted)] bg-[var(--bg-secondary)]/50 p-4 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#1E6FD9]" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              SIH26189 Data Ingestion &amp; Assistive NER
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'jobs'
                  ? 'bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)] text-[var(--accent-blue)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Ingestion Jobs
            </button>
            <button
              onClick={() => setActiveTab('ner')}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ner'
                  ? 'bg-[var(--accent-teal)]/20 border border-[var(--accent-teal)] text-[var(--accent-teal)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Raw Records &amp; Assistive NER
            </button>
          </div>
        </div>
        <p className="text-[9.5px] leading-relaxed text-[var(--text-secondary)]">
          Structured intelligence ingestion into <b>raw_ingested_data</b> with validation, normalization, spaCy NER
          extraction, and conservative entity/relationship matching. Free-text narratives yield <b>assistive leads</b>{' '}
          for human officer review. Every action and review decision is audited.
        </p>
      </div>

      {(error || message) && (
        <div
          className={`rounded border px-3 py-2 text-[10px] uppercase tracking-wider flex items-center gap-2 ${
            error ? 'border-red-500/30 text-red-300' : 'border-[#0E9E78]/30 text-[#0E9E78]'
          }`}
        >
          {error ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          <span>{error ?? message}</span>
        </div>
      )}

      {activeTab === 'jobs' ? (
        /* Jobs Tab */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Submit new job */}
          <div className="rounded border border-[var(--border-muted)] bg-[var(--bg-primary)]/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                New Ingestion Job
              </h4>
              <button onClick={insertTemplate} className="text-[9px] text-[#1E6FD9] hover:underline cursor-pointer">
                Insert template
              </button>
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
                    <option key={t.source_type} value={t.source_type}>
                      {t.label}
                    </option>
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
                {spec.optional_fields.length > 0 && (
                  <> · <span className="text-[var(--text-secondary)]">Optional:</span> {spec.optional_fields.join(', ')}</>
                )}
              </div>
            )}
            <label className="block">
              <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">
                Records (JSON array, or one JSON object per line, max 500)
              </span>
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
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Ingestion Jobs
              </h4>
              <button
                onClick={() => void load()}
                className="inline-flex items-center gap-1 text-[9px] text-[#1E6FD9] hover:underline cursor-pointer"
              >
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
                  <div
                    key={job.id}
                    className="rounded border border-[var(--border-muted)] bg-[var(--bg-secondary)]/40 p-2.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[7.5px] font-bold uppercase ${
                          STATUS_TONES[job.status] || 'border-zinc-500/30 text-zinc-400'
                        }`}
                      >
                        {job.status}
                      </span>
                      <span className="text-[9.5px] font-semibold text-[var(--text-primary)]">
                        {job.source_type.replace(/_/g, ' ')}
                      </span>
                      {job.source_name && (
                        <span className="text-[8.5px] text-[var(--text-muted)]">· {job.source_name}</span>
                      )}
                      <span className="ml-auto text-[8px] text-[var(--text-disabled)]">
                        {job.created_at
                          ? new Date(job.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5px] text-[var(--text-secondary)]">
                      <span>{job.total_records} total</span>
                      <span className="text-emerald-400">{job.valid_records} valid</span>
                      {job.invalid_records > 0 && (
                        <span className="text-red-400">{job.invalid_records} invalid</span>
                      )}
                      <span>{job.relationships_created} rel</span>
                      <span>{job.entities_created} entities</span>
                    </div>
                    {job.error_summary.length > 0 && (
                      <div className="mt-1 flex items-start gap-1 text-[8px] text-amber-400/90">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                          Row errors:{' '}
                          {job.error_summary.slice(0, 2).map((e) => `row ${e.row} (${e.errors[0]})`).join('; ')}
                          {job.error_summary.length > 2 ? ` +${job.error_summary.length - 2} more` : ''}
                        </span>
                      </div>
                    )}
                    {job.status !== 'archived' && (
                      <button
                        onClick={() => void doArchive(job.id)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[8.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <Archive className="h-3 w-3" /> Archive
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Raw Records & Assistive NER Tab */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border-muted)] bg-[var(--bg-primary)]/70 p-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[var(--accent-teal)]" />
              <div>
                <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Assistive NER Intelligence Pipeline
                </h4>
                <div className="flex items-center gap-1.5 text-[8.5px] text-[var(--accent-amber)] mt-0.5">
                  <ShieldAlert className="w-3 h-3 shrink-0" />
                  <span>
                    ASSISTIVE ONLY: Extracted entities and co-occurrences are prospective investigative leads. Human review decision required.
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleBackfillNER()}
                disabled={backfillingNER}
                className="px-3 py-1.5 bg-[var(--accent-teal)]/20 hover:bg-[var(--accent-teal)]/40 border border-[var(--accent-teal)]/40 text-[var(--accent-teal)] rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {backfillingNER ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Backfill NER (All Records)
              </button>
              <button
                onClick={() => void loadRecords()}
                disabled={loadingRecords}
                className="px-2.5 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[var(--text-muted)] rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingRecords ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loadingRecords ? (
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading raw intelligence records…
            </div>
          ) : rawRecords.length === 0 ? (
            <div className="rounded border border-[var(--border-muted)] bg-[var(--bg-primary)]/40 p-8 text-center text-[10px] text-[var(--text-muted)]">
              No raw intelligence records found in raw_ingested_data. Ingest records first using the &apos;Ingestion Jobs&apos; tab.
            </div>
          ) : (
            <div className="space-y-2">
              {rawRecords.map((rec) => {
                const isExpanded = expandedRecordId === rec.id;
                const extractions = extractionsByRecord[rec.id] || rec.extractions || [];
                const isProcessing = processingNERId === rec.id;
                const isLoadingExt = Boolean(loadingExtractions[rec.id]);

                return (
                  <div
                    key={rec.id}
                    className="rounded border border-[var(--border-secondary)] bg-[var(--bg-primary)]/80 hover:border-[var(--border-primary)] transition-all overflow-hidden"
                  >
                    <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[var(--border-primary)]/40 bg-[var(--bg-secondary)]/30">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 text-[8px] font-bold uppercase text-[var(--accent-blue)]">
                            {rec.source_type}
                          </span>
                          <span className="text-[10.5px] font-bold text-[var(--text-primary)]">
                            {rec.title || rec.external_ref || 'Raw Record'}
                          </span>
                          {rec.external_ref && rec.title && (
                            <span className="text-[9px] text-[var(--text-muted)] font-mono">
                              ({rec.external_ref})
                            </span>
                          )}
                          <span className="text-[8px] text-[var(--text-disabled)] ml-auto md:ml-0">
                            {rec.created_at ? new Date(rec.created_at).toLocaleString('en-IN') : ''}
                          </span>
                        </div>
                        {rec.raw_text && (
                          <p className="text-[9px] text-[var(--text-secondary)] line-clamp-2 max-w-4xl italic">
                            &quot;{rec.raw_text}&quot;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleRunNER(rec.id)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 bg-[var(--accent-blue)]/15 hover:bg-[var(--accent-blue)]/30 border border-[var(--accent-blue)]/30 text-[var(--accent-blue)] rounded text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {isProcessing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Brain className="w-2.5 h-2.5" />}
                          Run NER
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleExpandRecord(rec.id)}
                          className="px-2 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--border-secondary)] border border-[var(--border-primary)] text-[var(--text-muted)] rounded text-[9px] font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {extractions.length > 0 ? `${extractions.length} Entities` : 'View'}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Entities & Leads view */}
                    {isExpanded && (
                      <div className="p-3 bg-[var(--bg-primary)] space-y-3">
                        {isLoadingExt ? (
                          <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)] py-3 justify-center">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading entity extractions…
                          </div>
                        ) : extractions.length === 0 ? (
                          <div className="text-[9px] text-[var(--text-muted)] py-2 text-center">
                            No entities extracted yet for this record. Click &apos;Run NER&apos; to extract entities using spaCy and conservative matchers.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Extracted Chips */}
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-[var(--accent-teal)]" />
                                Extracted Entities ({extractions.length}):
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {extractions.map((ext) => (
                                  <div
                                    key={ext.id}
                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[9.5px] ${getEntityBadgeStyle(
                                      ext.entity_type
                                    )}`}
                                  >
                                    <span className="font-bold uppercase tracking-wider text-[8px] opacity-80">
                                      {ext.entity_type}:
                                    </span>
                                    <span className="font-semibold">{ext.entity_text}</span>
                                    <span className="text-[8px] opacity-75">
                                      ({Math.round(ext.confidence * 100)}%)
                                    </span>
                                    {ext.matched_entity_type && (
                                      <span className="px-1 py-0.2 rounded bg-black/30 text-[7.5px] uppercase tracking-wider">
                                        Matched {ext.matched_entity_type}
                                      </span>
                                    )}
                                    <span
                                      className={`px-1 py-0.2 rounded text-[7.5px] uppercase font-bold ${
                                        ext.review_status === 'confirmed'
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : ext.review_status === 'rejected'
                                          ? 'bg-red-500/20 text-red-300'
                                          : 'bg-amber-500/20 text-amber-300'
                                      }`}
                                    >
                                      {ext.review_status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Human Review Decisions for Pending Extractions */}
                            <div className="border-t border-[var(--border-secondary)] pt-2 space-y-1.5">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                                <span>Human Verification &amp; Review Decisions:</span>
                                <span className="text-[8px] text-[var(--accent-amber)] lowercase">
                                  * decisions are audited permanently
                                </span>
                              </div>
                              <div className="space-y-1">
                                {extractions.map((ext) => (
                                  <div
                                    key={`rev-${ext.id}`}
                                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-[var(--bg-secondary)]/30 border border-[var(--border-primary)] text-[9px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-[var(--text-primary)]">
                                        {ext.entity_text}
                                      </span>
                                      <span className="text-[8px] text-[var(--text-muted)] uppercase">
                                        [{ext.entity_type} via {ext.engine}]
                                      </span>
                                      {ext.matched_entity_type && (
                                        <span className="text-[8px] text-[var(--accent-teal)]">
                                          → linked to {ext.matched_entity_type}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {ext.review_status === 'pending' ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => void handleReviewLead(ext.id, 'confirmed', rec.id)}
                                            disabled={reviewingId === ext.id}
                                            className="px-2 py-0.5 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 rounded text-[8px] font-bold uppercase transition-colors cursor-pointer flex items-center gap-1"
                                          >
                                            <Check className="w-2.5 h-2.5" />
                                            Confirm
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void handleReviewLead(ext.id, 'rejected', rec.id)}
                                            disabled={reviewingId === ext.id}
                                            className="px-2 py-0.5 bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-300 rounded text-[8px] font-bold uppercase transition-colors cursor-pointer flex items-center gap-1"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                            Reject
                                          </button>
                                        </>
                                      ) : (
                                        <span
                                          className={`text-[8px] font-bold uppercase tracking-wider ${
                                            ext.review_status === 'confirmed'
                                              ? 'text-emerald-400'
                                              : 'text-zinc-500'
                                          }`}
                                        >
                                          {ext.review_status === 'confirmed' ? '✓ Confirmed' : '✗ Rejected'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer Pipeline summary */}
      <div className="flex items-start gap-2 text-[8.5px] leading-relaxed text-[var(--text-disabled)]">
        <FileText className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Pipeline: Ingest raw reports → spaCy NER + structural regex extractors → conservative entity match → prospective co-occurrence leads generated (confidence &le; 0.50, status under_review) → human officer confirms or rejects → audit log recorded.
        </span>
      </div>
    </div>
  );
};

export default IngestionPanel;
