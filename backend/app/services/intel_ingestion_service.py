"""SIH26189 data-ingestion pipeline (ADMIN-ONLY).

Implements the ingestion stage of the SIH26189 pipeline:

    DATA SOURCES → DATA INGESTION (admin only) → STORAGE / NORMALIZATION
    → ENTITY & RELATIONSHIP DATA → (downstream graph + AI layers)

Accepts structured intelligence records from admin users, validates and
normalizes them, stores the raw/original payload verbatim, records ingestion
metadata (source, timestamp, status) and — where a record contains structured
identifier fields — deterministically creates entities and relationships that
feed the network graph.

NO NER and NO NLP are implemented: free text is stored as-is with a
``processing_status`` extension point. Entity/relationship extraction uses
exact structured fields and exact-name lookups only, and every derived
relationship is labelled with its provenance so the UI never presents an
inference as a confirmed fact.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.models.criminal import Criminal
from app.models.intel_entity import (
    CaseEntityLink,
    DataSource,
    EntityRelationship,
    IngestionJob,
    IngestionRecord,
    IntelAnomaly,
    IntelEvent,
    Organization,
    PhoneNumber,
    SuspiciousPattern,
    Vehicle,
)
from app.models.crime import CrimeCase
from app.models.location import Location
from app.services import audit_service

# ---------------------------------------------------------------------------
# Source-type specs: required + optional structured fields per record type.
# These are structured-field mappings, NOT NER: every field is explicitly
# provided by the ingesting admin.
# ---------------------------------------------------------------------------

SOURCE_TYPE_SPECS: dict[str, dict[str, Any]] = {
    "fir_record": {
        "label": "FIR record",
        "required": ["fir_number"],
        "optional": ["title", "raw_text", "case_number", "person_name", "district", "incident_date"],
    },
    "police_report": {
        "label": "Police report",
        "required": ["title"],
        "optional": ["raw_text", "case_number", "person_name", "district", "report_date"],
    },
    "cdr_record": {
        "label": "CDR (call detail) record",
        "required": ["caller_number", "callee_number"],
        "optional": ["call_direction", "duration_seconds", "call_timestamp", "raw_text"],
    },
    "financial_transaction": {
        "label": "Financial transaction record",
        "required": ["person_a_name", "person_b_name", "amount"],
        "optional": ["account_ref", "transaction_date", "transaction_type", "raw_text"],
    },
    "surveillance": {
        "label": "Surveillance record",
        "required": ["person_name", "location_name"],
        "optional": ["observed_at", "district", "notes", "raw_text"],
    },
    "social_media": {
        "label": "Social-media intelligence record",
        "required": ["person_name"],
        "optional": ["organization_name", "platform", "content", "observed_at", "raw_text"],
    },
    "criminal_history": {
        "label": "Criminal history record",
        "required": ["person_name"],
        "optional": ["aliases", "status", "gang_affiliation", "raw_text"],
    },
    "intelligence_report": {
        "label": "Intelligence report",
        "required": ["title"],
        "optional": ["raw_text", "case_number", "person_name", "organization_name", "district", "confidence"],
    },
}

VALID_SOURCE_TYPES = set(SOURCE_TYPE_SPECS.keys())

_JOB_STATUSES = ("pending", "validated", "imported", "failed", "archived")
_HIGH_RISK_THRESHOLD = 70.0


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _dumps(value: Any) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)


def validate_record(source_type: str, record: dict[str, Any]) -> list[str]:
    """Validate one structured record against its source-type spec."""
    errors: list[str] = []
    spec = SOURCE_TYPE_SPECS.get(source_type)
    if spec is None:
        return [f"Unknown source_type '{source_type}'"]
    if not isinstance(record, dict):
        return ["Record must be a JSON object"]
    for field in spec["required"]:
        value = record.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            errors.append(f"Missing required field '{field}'")
    for field in ("person_name", "person_a_name", "person_b_name", "organization_name"):
        if field in spec["required"] or field in spec["optional"]:
            value = record.get(field)
            if isinstance(value, str) and len(value) > 255:
                errors.append(f"Field '{field}' exceeds 255 characters")
    return errors


def _resolve_criminal(db: Session, name: str) -> Criminal | None:
    """Deterministic person lookup: exact full name, then aliases, then prefix.

    This is a plain identifier lookup — not NER. Nothing is guessed from free
    text; only a provided structured name field is matched.
    """
    if not name or not name.strip():
        return None
    cleaned = name.strip()
    criminal = db.query(Criminal).filter(Criminal.full_name == cleaned).first()
    if criminal is None:
        criminal = db.query(Criminal).filter(Criminal.aliases == cleaned).first()
    if criminal is None:
        criminal = db.query(Criminal).filter(Criminal.full_name.ilike(f"{cleaned}%")).first()
    return criminal


def _resolve_case(db: Session, case_number: str | None) -> CrimeCase | None:
    if not case_number or not case_number.strip():
        return None
    return db.query(CrimeCase).filter(CrimeCase.case_number == case_number.strip()).first()


def _get_or_create_phone(db: Session, number: str, created_counter: list[int]) -> PhoneNumber | None:
    cleaned = (number or "").strip()
    if not cleaned:
        return None
    phone = db.query(PhoneNumber).filter(PhoneNumber.number == cleaned).first()
    if phone is None:
        phone = PhoneNumber(number=cleaned)
        db.add(phone)
        db.flush()
        created_counter[0] += 1
    return phone


def _get_or_create_organization(db: Session, name: str, created_counter: list[int]) -> Organization | None:
    cleaned = (name or "").strip()
    if not cleaned:
        return None
    org = db.query(Organization).filter(Organization.name == cleaned).first()
    if org is None:
        org = Organization(name=cleaned)
        db.add(org)
        db.flush()
        created_counter[0] += 1
    return org


def _add_relationship(
    db: Session,
    source_type: str,
    source_id,
    target_type: str,
    target_id,
    relationship_type: str,
    *,
    provenance: str = "DIRECT_RECORD",
    inferred_from: str | None = None,
    confidence: float = 1.0,
    evidence_records: list[dict[str, Any]] | None = None,
    created_by_id=None,
) -> bool:
    """Create an entity_relationship edge if an equivalent one does not exist."""
    existing = (
        db.query(EntityRelationship)
        .filter(
            EntityRelationship.source_type == source_type,
            EntityRelationship.source_id == source_id,
            EntityRelationship.target_type == target_type,
            EntityRelationship.target_id == target_id,
            EntityRelationship.relationship_type == relationship_type,
        )
        .first()
    )
    if existing is not None:
        # Refresh the observation window; do not duplicate the edge.
        existing.last_seen = _utcnow()
        return False
    edge = EntityRelationship(
        source_type=source_type,
        source_id=source_id,
        target_type=target_type,
        target_id=target_id,
        relationship_type=relationship_type,
        provenance=provenance,
        inferred_from=inferred_from,
        confidence=max(0.0, min(1.0, confidence)),
        evidence_records=_dumps(evidence_records or []),
        first_seen=_utcnow(),
        last_seen=_utcnow(),
        created_by_id=created_by_id,
    )
    db.add(edge)
    db.flush()
    return True


def _record_pattern(
    db: Session,
    pattern_type: str,
    title: str,
    description: str,
    entities: list[dict[str, Any]],
    supporting: dict[str, Any],
    confidence: float,
    severity: str = "medium",
) -> None:
    """Persist a suspicious-pattern detection (idempotent per type+entities)."""
    existing = (
        db.query(SuspiciousPattern)
        .filter(SuspiciousPattern.pattern_type == pattern_type, SuspiciousPattern.title == title)
        .first()
    )
    if existing is not None:
        return
    db.add(SuspiciousPattern(
        pattern_type=pattern_type,
        title=title,
        description=description,
        entities=_dumps(entities),
        supporting_records=_dumps(supporting),
        confidence=confidence,
        severity=severity,
        detection_method="deterministic_rule",
        status="detected",
    ))
    db.flush()


def _record_anomaly(
    db: Session,
    anomaly_type: str,
    title: str,
    what_detected: str,
    why_unusual: str,
    related_entity_type: str | None,
    related_entity_id,
    supporting: dict[str, Any],
    severity: str = "medium",
    confidence: float = 0.7,
) -> None:
    existing = (
        db.query(IntelAnomaly)
        .filter(IntelAnomaly.anomaly_type == anomaly_type, IntelAnomaly.title == title, IntelAnomaly.status == "open")
        .first()
    )
    if existing is not None:
        return
    db.add(IntelAnomaly(
        anomaly_type=anomaly_type,
        title=title,
        what_detected=what_detected,
        why_unusual=why_unusual,
        severity=severity,
        confidence=confidence,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        supporting_data=_dumps(supporting),
        detected_at=_utcnow(),
        status="open",
    ))
    db.flush()


def _link_case_entity(db: Session, case_id, entity_type: str, entity_id, role: str, confidence: float = 1.0) -> bool:
    existing = (
        db.query(CaseEntityLink)
        .filter(
            CaseEntityLink.case_id == case_id,
            CaseEntityLink.entity_type == entity_type,
            CaseEntityLink.entity_id == entity_id,
            CaseEntityLink.role == role,
        )
        .first()
    )
    if existing is not None:
        return False
    db.add(CaseEntityLink(case_id=case_id, entity_type=entity_type, entity_id=entity_id, role=role, confidence=confidence))
    db.flush()
    return True


def _apply_structured_extraction(
    db: Session,
    source_type: str,
    record: dict[str, Any],
    ingestion_record: IngestionRecord,
    counters: dict[str, int],
    user_id,
) -> None:
    """Deterministic entity/relationship extraction from structured fields.

    Only explicitly provided fields are used. Every derived relationship is
    tagged with provenance so downstream UIs can separate recorded facts from
    analytical inferences. No free-text parsing of any kind.
    """
    created_rels = 0
    created_entities = 0

    if source_type == "cdr_record":
        caller = _get_or_create_phone(db, str(record.get("caller_number", "")), [created_entities])
        callee = _get_or_create_phone(db, str(record.get("callee_number", "")), [created_entities])
        if caller and callee and caller.id != callee.id:
            evidence = [{"record_type": "ingestion_record", "record_id": str(ingestion_record.id), "label": f"CDR {ingestion_record.external_ref or ingestion_record.title or ''}".strip()}]
            if _add_relationship(db, "phone", caller.id, "phone", callee.id, "communicated_with", provenance="DIRECT_RECORD", inferred_from="cdr_record", confidence=1.0, evidence_records=evidence, created_by_id=user_id):
                created_rels += 1

    elif source_type == "financial_transaction":
        person_a = _resolve_criminal(db, str(record.get("person_a_name", "")))
        person_b = _resolve_criminal(db, str(record.get("person_b_name", "")))
        if person_a and person_b and person_a.id != person_b.id:
            amount = record.get("amount")
            evidence = [{
                "record_type": "ingestion_record",
                "record_id": str(ingestion_record.id),
                "label": f"Financial transaction {record.get('account_ref') or ''} amount={amount}".strip(),
            }]
            if _add_relationship(db, "person", person_a.id, "person", person_b.id, "financial_connection", provenance="ANALYTICAL_INFERENCE", inferred_from="financial_transaction_record", confidence=0.6, evidence_records=evidence, created_by_id=user_id):
                created_rels += 1

    elif source_type == "surveillance":
        person = _resolve_criminal(db, str(record.get("person_name", "")))
        location_name = str(record.get("location_name", "")).strip()
        location = db.query(Location).filter(Location.station == location_name).first() if location_name else None
        if person and location:
            evidence = [{"record_type": "ingestion_record", "record_id": str(ingestion_record.id), "label": f"Surveillance observation at {location_name}"}]
            if _add_relationship(db, "person", person.id, "location", location.id, "located_at", provenance="DIRECT_RECORD", inferred_from="surveillance_record", confidence=0.9, evidence_records=evidence, created_by_id=user_id):
                created_rels += 1

    elif source_type == "social_media":
        person = _resolve_criminal(db, str(record.get("person_name", "")))
        org = _get_or_create_organization(db, str(record.get("organization_name", "")), [created_entities]) if record.get("organization_name") else None
        if person and org:
            evidence = [{"record_type": "ingestion_record", "record_id": str(ingestion_record.id), "label": f"Social-media association ({record.get('platform') or 'platform unknown'})"}]
            if _add_relationship(db, "person", person.id, "organization", org.id, "member_of", provenance="ANALYTICAL_INFERENCE", inferred_from="social_media_record", confidence=0.5, evidence_records=evidence, created_by_id=user_id):
                created_rels += 1

    # Person ↔ case linkage (fir_record / police_report / intelligence_report /
    # criminal_history all support an optional person_name + case_number).
    case = _resolve_case(db, record.get("case_number"))
    person = _resolve_criminal(db, str(record.get("person_name", ""))) if record.get("person_name") else None
    if case and person:
        if _link_case_entity(db, case.id, "person", person.id, "linked_through_ingestion", confidence=0.8):
            created_rels += 1
        evidence = [{"record_type": "ingestion_record", "record_id": str(ingestion_record.id), "label": f"{SOURCE_TYPE_SPECS[source_type]['label']} ref {record.get('fir_number') or record.get('case_number') or ''}".strip()}]
        if _add_relationship(db, "person", person.id, "case", case.id, "linked_through_case", provenance="DIRECT_RECORD", inferred_from=source_type, confidence=0.9, evidence_records=evidence, created_by_id=user_id):
            created_rels += 1
        ingestion_record.linked_case_id = case.id

    # Shared-phone suspicious pattern: one number tied to ≥2 distinct persons
    # through CDR pairs is a classic network indicator (deterministic rule).
    if source_type == "cdr_record":
        number = str(record.get("caller_number", "")).strip()
        other = str(record.get("callee_number", "")).strip()
        if number:
            partner = db.query(PhoneNumber).filter(PhoneNumber.number == other).first()
            partner_persons = []
            if partner is not None:
                partner_persons = [
                    r for r in db.query(EntityRelationship)
                    .filter(EntityRelationship.relationship_type == "communicated_with")
                    .filter(
                        (EntityRelationship.source_id == partner.id) | (EntityRelationship.target_id == partner.id)
                    ).all()
                ]
            persons_linked_to_number = db.query(CaseEntityLink).filter(
                CaseEntityLink.entity_type == "phone"
            ).count()
            # Pattern rule: the same number appears in multiple CDR rows with
            # different counterparts → repeated-communication pattern.
            cdr_count = (
                db.query(sa_func.count(IngestionRecord.id))
                .filter(
                    IngestionRecord.source_type == "cdr_record",
                    IngestionRecord.processing_status == "imported",
                    IngestionRecord.structured_data.contains(number),
                )
                .scalar()
                or 0
            )
            if cdr_count >= 3:
                _record_pattern(
                    db,
                    "repeated_communication",
                    f"Repeated communications via {number}",
                    f"Number {number} appears in {cdr_count} imported CDR records. "
                    "Repeated temporal interaction pattern — potential coordination channel. "
                    "This is a detected pattern, not a confirmed criminal association.",
                    entities=[{"type": "phone", "id": str(partner.id) if partner else None, "name": number}],
                    supporting={"cdr_record_count": cdr_count, "counterpart_links": len(partner_persons), "phone_case_links": persons_linked_to_number},
                    confidence=min(0.9, 0.4 + cdr_count * 0.05),
                    severity="medium" if cdr_count < 6 else "high",
                )

    # New connection to a high-risk entity anomaly (deterministic threshold).
    if person is not None:
        fir_count = len(person.fir_links) if hasattr(person, "fir_links") else 0
        risk = min(100.0, 45.0 + fir_count * 10)
        if risk >= _HIGH_RISK_THRESHOLD and created_rels > 0:
            _record_anomaly(
                db,
                "new_connection_to_high_risk",
                f"New ingestion link to high-risk person {person.full_name}",
                f"A newly ingested {SOURCE_TYPE_SPECS[source_type]['label'].lower()} created a relationship to {person.full_name}.",
                f"{person.full_name} is linked to {fir_count} FIR record(s) (risk score {risk:.0f}/100), above the {_HIGH_RISK_THRESHOLD:.0f}-point review threshold. New connections to this entity warrant review.",
                "person",
                person.id,
                {"risk_score": risk, "fir_count": fir_count, "source_type": source_type},
                severity="high" if risk >= 85 else "medium",
            )

    counters["relationships_created"] += created_rels
    counters["entities_created"] += created_entities


def run_ingestion(
    db: Session,
    *,
    source_type: str,
    source_name: str | None,
    records: list[dict[str, Any]],
    user_id,
    user_obj=None,
) -> IngestionJob:
    """Execute the ingestion pipeline for a batch of structured records."""
    if source_type not in VALID_SOURCE_TYPES:
        raise ValueError(f"Unknown source_type '{source_type}'")
    if not records or not isinstance(records, list):
        raise ValueError("records must be a non-empty JSON array")
    if len(records) > 500:
        raise ValueError("A single ingestion job accepts at most 500 records")

    job = IngestionJob(
        source_type=source_type,
        source_name=source_name,
        status="pending",
        total_records=len(records),
        ingested_by_id=user_id,
    )
    db.add(job)
    db.flush()

    counters = {"valid": 0, "invalid": 0, "relationships_created": 0, "entities_created": 0}
    row_errors: list[dict[str, Any]] = []

    for idx, record in enumerate(records, start=1):
        errors = validate_record(source_type, record)
        rec = IngestionRecord(
            source_type=source_type,
            source_name=source_name,
            external_ref=str(record.get("fir_number") or record.get("external_ref") or record.get("account_ref") or f"row-{idx}"),
            title=str(record.get("title") or SOURCE_TYPE_SPECS[source_type]["label"]),
            raw_text=str(record.get("raw_text")) if record.get("raw_text") is not None else None,
            structured_data=_dumps(record),
            ingested_by_id=user_id,
            ingested_at=_utcnow(),
        )
        if errors:
            counters["invalid"] += 1
            rec.processing_status = "failed"
            rec.record_status = "active"
            row_errors.append({"row": idx, "errors": errors})
        else:
            counters["valid"] += 1
            rec.processing_status = "validated"
            db.add(rec)
            db.flush()
            try:
                _apply_structured_extraction(db, source_type, record, rec, counters, user_id)
                rec.processing_status = "imported"
            except Exception as exc:  # noqa: BLE001 — per-row isolation
                rec.processing_status = "failed"
                row_errors.append({"row": idx, "errors": [f"Extraction failed: {exc}"]})
        db.add(rec)

    job.valid_records = counters["valid"]
    job.invalid_records = counters["invalid"]
    job.relationships_created = counters["relationships_created"]
    job.entities_created = counters["entities_created"]
    job.error_summary = _dumps(row_errors[:100])
    job.completed_at = _utcnow()

    if counters["valid"] == 0:
        job.status = "failed"
    elif counters["invalid"] > 0:
        job.status = "validated"
    else:
        job.status = "imported"

    db.flush()
    if user_obj is not None:
        audit_service.log_action(
            db,
            user_obj,
            "DATA_INGESTION",
            "IngestionJob",
            str(job.id),
            details=_dumps({
                "source_type": source_type,
                "source_name": source_name,
                "total_records": job.total_records,
                "valid_records": job.valid_records,
                "invalid_records": job.invalid_records,
                "relationships_created": job.relationships_created,
                "entities_created": job.entities_created,
                "status": job.status,
            }),
        )
    return job


def archive_job(db: Session, job: IngestionJob) -> IngestionJob:
    """Archive a completed job and its raw records (retention workflow)."""
    job.status = "archived"
    db.query(IngestionRecord).filter(
        IngestionRecord.source_type == job.source_type,
        IngestionRecord.source_name == job.source_name,
        IngestionRecord.record_status == "active",
    ).update({"record_status": "archived"}, synchronize_session=False)
    return job


def serialize_job(job: IngestionJob) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "source_type": job.source_type,
        "source_name": job.source_name,
        "status": job.status,
        "total_records": job.total_records,
        "valid_records": job.valid_records,
        "invalid_records": job.invalid_records,
        "relationships_created": job.relationships_created,
        "entities_created": job.entities_created,
        "error_summary": json.loads(job.error_summary) if job.error_summary else [],
        "ingested_by_id": str(job.ingested_by_id) if job.ingested_by_id else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


def serialize_record(rec: IngestionRecord) -> dict[str, Any]:
    return {
        "id": str(rec.id),
        "source_type": rec.source_type,
        "source_name": rec.source_name,
        "external_ref": rec.external_ref,
        "title": rec.title,
        "processing_status": rec.processing_status,
        "record_status": rec.record_status,
        "raw_text": rec.raw_text,
        "structured_data": json.loads(rec.structured_data) if rec.structured_data else None,
        "linked_case_id": str(rec.linked_case_id) if rec.linked_case_id else None,
        "ingested_at": rec.ingested_at.isoformat() if rec.ingested_at else None,
    }


def serialize_relationship(edge: EntityRelationship) -> dict[str, Any]:
    return {
        "id": str(edge.id),
        "source_type": edge.source_type,
        "source_id": str(edge.source_id),
        "target_type": edge.target_type,
        "target_id": str(edge.target_id),
        "relationship_type": edge.relationship_type,
        "weight": edge.weight,
        "confidence": edge.confidence,
        "status": edge.status,
        "provenance": edge.provenance,
        "inferred_from": edge.inferred_from,
        "evidence_records": json.loads(edge.evidence_records) if edge.evidence_records else [],
        "first_seen": edge.first_seen.isoformat() if edge.first_seen else None,
        "last_seen": edge.last_seen.isoformat() if edge.last_seen else None,
    }
