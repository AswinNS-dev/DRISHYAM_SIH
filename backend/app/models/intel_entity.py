"""SIH26189 entity-graph extension models.

Extends the existing case/FIR/person core with the remaining intelligence
entity types required by the problem statement — organizations, vehicles,
phone numbers and events — plus a single unified relationship table that
connects ANY two entities (persons, cases, organizations, vehicles, phones,
events, locations, evidence). These tables power the network graph's hidden
connection discovery, cross-case linking and pattern detection.

No NER/NLP is implemented here: raw document text (e.g. FIR narratives)
continues to be stored verbatim with a ``processing_status`` so a future
extraction pipeline can be attached without a schema change.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.mixins import TimestampMixin, UUIDPKMixin
from app.database.postgres import Base


class Organization(Base, UUIDPKMixin, TimestampMixin):
    """Criminal/legitimate organization (syndicate, company, front business)."""
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    org_type: Mapped[str | None] = mapped_column(String(100))  # syndicate, gang, company, ngo, front_business...
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(500))
    district: Mapped[str | None] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)  # active|dormant|dismantled
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_demo_derived: Mapped[bool] = mapped_column(default=False, nullable=False)


class Vehicle(Base, UUIDPKMixin, TimestampMixin):
    """Vehicle linked to persons or cases (stolen, used in crime, owned)."""
    __tablename__ = "vehicles"

    registration_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    vehicle_type: Mapped[str | None] = mapped_column(String(100))  # car, bike, truck...
    make: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="normal", nullable=False)  # normal|stolen|seized|wanted
    notes: Mapped[str | None] = mapped_column(Text)
    is_demo_derived: Mapped[bool] = mapped_column(default=False, nullable=False)


class PhoneNumber(Base, UUIDPKMixin, TimestampMixin):
    """Phone number / communication identifier linked to persons or cases.

    CDR record ingestion (structured, admin-only) attaches numbers to persons;
    shared-number detection feeds the 'shared communication link' pattern.
    """
    __tablename__ = "phone_numbers"

    number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    carrier: Mapped[str | None] = mapped_column(String(100))
    registered_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)  # active|suspended|surveilled
    is_demo_derived: Mapped[bool] = mapped_column(default=False, nullable=False)


class IntelEvent(Base, UUIDPKMixin, TimestampMixin):
    """Intelligence-relevant event (meeting, transaction, incident, rally...)."""
    __tablename__ = "events"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    event_type: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="SET NULL"))
    district: Mapped[str | None] = mapped_column(String(100), index=True)
    is_demo_derived: Mapped[bool] = mapped_column(default=False, nullable=False)


class EntityRelationship(Base, UUIDPKMixin, TimestampMixin):
    """Unified relationship edge between ANY two intelligence entities.

    ``source_type``/``target_type`` use logical entity kinds matching the
    network graph: person | case | fir | organization | vehicle | phone |
    event | location | evidence. Evidence rows (FIR participation, ownership,
    co-accused records) are stored in ``evidence_records`` as JSON so every
    edge rendered in the graph is traceable to stored data.

    ``inferred_from`` records HOW the edge was derived: 'direct_record' when
    an operational record states it, 'multi_hop' when discovered through
    graph traversal (always rendered as INDIRECT in the UI), or a rule name
    such as 'shared_phone'.
    """
    __tablename__ = "entity_relationships"

    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # associated_with | communicated_with | located_at | used_vehicle |
    # connected_to_phone | member_of | linked_through_case | appeared_in_event |
    # financial_connection | shared_location | shared_communication_link
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)  # 0..1
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active|inactive|under_review
    # DIRECT_RECORD | ANALYTICAL_INFERENCE | DEMO_SEED
    provenance: Mapped[str] = mapped_column(String(30), default="DIRECT_RECORD", nullable=False)
    inferred_from: Mapped[str | None] = mapped_column(String(100))
    evidence_records: Mapped[str | None] = mapped_column(Text)  # JSON array of {record_type, record_id, label}
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    __table_args__ = (
        Index("ix_entity_relationships_pair", "source_type", "source_id", "target_type", "target_id"),
    )


class IngestionRecord(Base, UUIDPKMixin, TimestampMixin):
    """Raw ingested data row (SIH26189 §9 data ingestion storage).

    Distinct from import_jobs/import_staging_records (which drive structured
    CSV/XLSX promotion): this is the durable raw store for any ingested
    intelligence document/record. Text is stored verbatim — NO NER/NLP is
    performed — with a processing_status extension point for a future
    extraction pipeline.
    """
    __tablename__ = "raw_ingested_data"

    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # fir_record | police_report | cdr_record | financial_transaction |
    # surveillance | social_media | criminal_history | intelligence_report
    source_name: Mapped[str | None] = mapped_column(String(255))
    external_ref: Mapped[str | None] = mapped_column(String(255), index=True)
    title: Mapped[str | None] = mapped_column(String(500))
    raw_text: Mapped[str | None] = mapped_column(Text)  # verbatim; never NLP-processed
    structured_data: Mapped[str | None] = mapped_column(Text)  # JSON payload
    processing_status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False, index=True)
    # pending | validated | imported | failed | archived
    record_status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active|archived
    linked_case_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crime_cases.id", ondelete="SET NULL"))
    ingested_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo_derived: Mapped[bool] = mapped_column(default=False, nullable=False)


class DataSource(Base, UUIDPKMixin, TimestampMixin):
    """Registered upstream intelligence source (SIH26189 §9 pipeline head)."""
    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class IngestionJob(Base, UUIDPKMixin, TimestampMixin):
    """Admin-only ingestion job tracking (pending → validated → imported/failed → archived)."""
    __tablename__ = "ingestion_jobs"

    data_source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="SET NULL"))
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    # pending | validated | imported | failed | archived
    total_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    invalid_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    relationships_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    entities_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_summary: Mapped[str | None] = mapped_column(Text)  # JSON list of row errors
    ingested_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CaseEntityLink(Base, UUIDPKMixin, TimestampMixin):
    """Association between a case and any intelligence entity (SIH26189 §5).

    A case is never an isolated CRUD record: this table carries the
    Case → Entities → Relationships graph context shown on the case and
    investigation pages.
    """
    __tablename__ = "case_entities"

    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crime_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(100), default="associated", nullable=False)
    # accused | victim | witness | location_of_incident | vehicle_used |
    # connected_to_phone | member_of | financial | associated
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_case_entities_unique", "case_id", "entity_type", "entity_id", "role", unique=True),
    )


class SuspiciousPattern(Base, UUIDPKMixin, TimestampMixin):
    """Detected suspicious pattern with full evidence grounding (SIH26189 §17)."""
    __tablename__ = "suspicious_patterns"

    pattern_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # shared_phone | shared_vehicle | shared_location | repeated_association |
    # cross_case_link | common_intermediary | dense_community | unexpected_bridge
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    entities: Mapped[str | None] = mapped_column(Text)  # JSON [{type,id,name,role}]
    case_ids: Mapped[str | None] = mapped_column(Text)  # JSON [case uuid]
    supporting_records: Mapped[str | None] = mapped_column(Text)  # JSON evidence refs
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)  # low|medium|high|critical
    detection_method: Mapped[str | None] = mapped_column(String(100))
    # Deterministic rule name — never presented as confirmed fact.
    status: Mapped[str] = mapped_column(String(20), default="detected", nullable=False, index=True)  # detected|reviewed|dismissed
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo_derived: Mapped[bool] = mapped_column(default=False, nullable=False)


class IntelAnomaly(Base, UUIDPKMixin, TimestampMixin):
    """Detected anomaly with what/why/grounding fields (SIH26189 §18)."""
    __tablename__ = "anomalies"

    anomaly_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # unusual_relationship_frequency | sudden_connectivity_increase |
    # unexpected_cross_case_link | unusual_location_pattern |
    # new_connection_to_high_risk | sudden_network_expansion
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    what_detected: Mapped[str | None] = mapped_column(Text)
    why_unusual: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="medium", nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    related_entity_type: Mapped[str | None] = mapped_column(String(50))
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    related_case_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crime_cases.id", ondelete="SET NULL"))
    supporting_data: Mapped[str | None] = mapped_column(Text)  # JSON grounding records
    detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False, index=True)  # open|reviewed|dismissed
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    is_demo_derived: Mapped[bool] = mapped_column(default=False, nullable=False)


class NetworkAnalysisRun(Base, UUIDPKMixin):
    """Persisted graph-analysis run (SIH26189 §16 metrics history)."""
    __tablename__ = "network_analysis"

    analysis_type: Mapped[str] = mapped_column(String(50), default="full_graph", nullable=False)
    node_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    edge_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    graph_density: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    connected_components: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    params: Mapped[str | None] = mapped_column(Text)
    computed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class NetworkMetric(Base, UUIDPKMixin):
    """Per-node centrality snapshot from a network_analysis run."""
    __tablename__ = "network_metrics"

    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("network_analysis.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    entity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    degree_centrality: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    betweenness_centrality: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    closeness_centrality: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    pagerank: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    __table_args__ = (
        Index("ix_network_metrics_run_entity", "run_id", "entity_type", "entity_id"),
    )
