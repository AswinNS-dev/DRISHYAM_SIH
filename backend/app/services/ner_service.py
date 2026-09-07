"""Named Entity Recognition & Conservative Candidate Matching Service (SIH26189 Phase 7-9).

Extracts intelligence entities (PERSON, ORG, LOCATION, PHONE, VEHICLE, DATE, MONEY, FIR_NO)
from unstructured narrative documents using spaCy (en_core_web_sm) with graceful fallback to
rule-based extractors. Conservatively matches candidate entities against operational records
without ever automatically declaring guilt or auto-confirming identity.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.logging_config import logger
from app.models.criminal import Criminal
from app.models.intel_entity import EntityRelationship, IngestionRecord, Organization, PhoneNumber, Vehicle
from app.models.location import Location
from app.models.ner import NERExtraction
from app.models.user import User
from app.services import audit_service

# ---------------------------------------------------------------------------
# spaCy Engine Loader with Graceful Fallback
# ---------------------------------------------------------------------------

_SPACY_NLP = None
_SPACY_TRIED = False


def _get_spacy_pipeline():
    """Lazily load spaCy model en_core_web_sm; return None if unavailable."""
    global _SPACY_NLP, _SPACY_TRIED
    if _SPACY_TRIED:
        return _SPACY_NLP
    _SPACY_TRIED = True
    try:
        import spacy
        _SPACY_NLP = spacy.load("en_core_web_sm")
        logger.info("spaCy 'en_core_web_sm' loaded successfully for NER")
    except Exception as exc:
        logger.warning(f"spaCy 'en_core_web_sm' unavailable ({exc}); falling back to rule-based NER")
        _SPACY_NLP = None
    return _SPACY_NLP


# ---------------------------------------------------------------------------
# Comprehensive Rule-Based Regular Expressions (All 36 Indian States/UTs)
# ---------------------------------------------------------------------------

# Indian vehicle registration: 2-letter state code + 1-2 digit RTO + 1-3 letters + 1-4 digits
# e.g. KA-09-CD-7717, MH-12-AB-4521, DL-01-XX-1234, TN-38-KL-9012, TS-09-XY-1847, AP-16-BC-6621
_INDIAN_VEHICLE_RE = re.compile(
    r"\b([A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{3,4}|\d{2}[-\s]?BH[-\s]?\d{4}[-\s]?[A-Z]{1,2})\b",
    re.IGNORECASE,
)

# Indian 10-digit phone number with optional +91 prefix and optional formatting hyphen/space
_PHONE_RE = re.compile(r"(?:\+91[-\s]?)?([6-9]\d{4}[-\s]?\d{5}|[6-9]\d{9})\b")

# FIR Number pattern: e.g. FIR-2026-DEM-001, FIR/123/2026, Crime No. 45/2025
_FIR_NO_RE = re.compile(
    r"\b(?:FIR[-\s/#]?(?:\d{4}[-\s/][A-Z0-9-]+|\d+/\d{2,4})|Crime\s+(?:No\.?|Number)\s*\d+/\d{2,4})\b",
    re.IGNORECASE,
)

# Currency amounts in Indian format: Rs. 50,000, 5 Lakhs, 2 Crore, Rs 10000
_MONEY_RE = re.compile(
    r"(?:Rs\.?\s*|\u20b9\s*)\d[\d,]*(?:\.\d+)?(?:\s*(?:lakh|crore|crores|lakhs|k))?|\b\d[\d,]+\s*(?:rupees|rs|inr)\b",
    re.IGNORECASE,
)

# Dates: 2026-08-08, 14/07/2026, 14-07-2026, 8 August 2026, Aug 8, 2026
_DATE_RE = re.compile(
    r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b",
    re.IGNORECASE,
)

# Honorific / Role-based person regex fallback
_PERSON_HONORIFIC_RE = re.compile(
    r"\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Sri\.?|Smt\.?|Shri\.?|Suspect|Accused|Driver|Complainant|Officer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b"
)

# Common Indian investigation organization keywords
_ORG_KEYWORDS_RE = re.compile(
    r"\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*\s+(?:Syndicate|Gang|Enterprises|Traders|Logistics(?:\s+Ltd|\s+Pvt\s+Ltd)?|Private Limited|Pvt Ltd|Ltd|Bank|Hospital|Firm|Company))\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Core Extraction Function
# ---------------------------------------------------------------------------

def extract_entities_from_text(text: str) -> list[dict[str, Any]]:
    """Extract named entities with character offsets, confidence, and engine name."""
    if not text or not text.strip():
        return []

    extractions: list[dict[str, Any]] = []
    seen_spans: set[tuple[int, int]] = set()

    spacy_nlp = _get_spacy_pipeline()
    primary_engine = "spacy/en_core_web_sm" if spacy_nlp is not None else "rule_based_fallback"

    def _overlaps(start: int, end: int) -> bool:
        return any(max(start, s) < min(end, e) for (s, e) in seen_spans)

    # 1. Structural domain-specific extractors (HIGHEST PRIORITY)
    # These have strict syntax that must not be swallowed by general NLP models.

    # Vehicles (e.g. KA-09-CD-7717, MH-12-AB-4521)
    for m in _INDIAN_VEHICLE_RE.finditer(text):
        span = (m.start(), m.end())
        raw_val = m.group(0).strip().upper().replace(" ", "-")
        raw_val = re.sub(r"-+", "-", raw_val)
        if not _overlaps(m.start(), m.end()):
            seen_spans.add(span)
            extractions.append({
                "entity_type": "VEHICLE",
                "entity_text": m.group(0).strip(),
                "start_offset": m.start(),
                "end_offset": m.end(),
                "confidence": 0.95,
                "engine": "rule_based_vehicle_regex",
                "normalized_ref": raw_val,
            })

    # Phones (e.g. +91-98450-12345, 9845012345)
    for m in _PHONE_RE.finditer(text):
        span = (m.start(), m.end())
        digits = m.group(1).replace("-", "").replace(" ", "")
        if not _overlaps(m.start(), m.end()):
            seen_spans.add(span)
            extractions.append({
                "entity_type": "PHONE",
                "entity_text": m.group(0).strip(),
                "start_offset": m.start(),
                "end_offset": m.end(),
                "confidence": 0.95,
                "engine": "rule_based_phone_regex",
                "normalized_ref": digits,
            })

    # FIR Numbers (e.g. FIR-091/ECITY/2026)
    for m in _FIR_NO_RE.finditer(text):
        span = (m.start(), m.end())
        if not _overlaps(m.start(), m.end()):
            seen_spans.add(span)
            extractions.append({
                "entity_type": "FIR_NO",
                "entity_text": m.group(0).strip(),
                "start_offset": m.start(),
                "end_offset": m.end(),
                "confidence": 0.92,
                "engine": "rule_based_fir_regex",
                "normalized_ref": m.group(0).strip().upper(),
            })

    # Money (e.g. Rs. 4,50,000, ₹ 14.5 Lakhs)
    for m in _MONEY_RE.finditer(text):
        span = (m.start(), m.end())
        if not _overlaps(m.start(), m.end()):
            seen_spans.add(span)
            extractions.append({
                "entity_type": "MONEY",
                "entity_text": m.group(0).strip(),
                "start_offset": m.start(),
                "end_offset": m.end(),
                "confidence": 0.90,
                "engine": "rule_based_money_regex",
                "normalized_ref": m.group(0).strip(),
            })

    # 2. Run spaCy NER if available for non-overlapping entities
    if spacy_nlp is not None:
        try:
            doc = spacy_nlp(text)
            for ent in doc.ents:
                etype = ent.label_
                mapped_type = None
                if etype == "PERSON":
                    # Filter out false positive persons that look like vehicle models or codes
                    if not re.search(r"\d", ent.text):
                        mapped_type = "PERSON"
                elif etype in ("ORG", "NORP"):
                    mapped_type = "ORG"
                elif etype in ("GPE", "LOC", "FAC"):
                    mapped_type = "LOCATION"
                elif etype == "DATE":
                    mapped_type = "DATE"
                elif etype == "MONEY":
                    mapped_type = "MONEY"

                if mapped_type and not _overlaps(ent.start_char, ent.end_char):
                    span = (ent.start_char, ent.end_char)
                    seen_spans.add(span)
                    extractions.append({
                        "entity_type": mapped_type,
                        "entity_text": ent.text.strip(),
                        "start_offset": ent.start_char,
                        "end_offset": ent.end_char,
                        "confidence": 0.85,
                        "engine": "spacy/en_core_web_sm",
                        "normalized_ref": _normalize_entity_text(mapped_type, ent.text),
                    })
        except Exception as exc:
            logger.warning(f"spaCy extraction error ({exc}); continuing with regex extractors")

    # Dates (if not already extracted)
    for m in _DATE_RE.finditer(text):
        span = (m.start(), m.end())
        if not any(s <= m.start() and m.end() <= e for (s, e) in seen_spans):
            seen_spans.add(span)
            extractions.append({
                "entity_type": "DATE",
                "entity_text": m.group(0).strip(),
                "start_offset": m.start(),
                "end_offset": m.end(),
                "confidence": 0.85,
                "engine": primary_engine,
                "normalized_ref": m.group(0).strip(),
            })

    # Honorific persons fallback
    for m in _PERSON_HONORIFIC_RE.finditer(text):
        span = (m.start(1), m.end(1))
        name = m.group(1).strip()
        if not any(s <= m.start(1) and m.end(1) <= e for (s, e) in seen_spans):
            seen_spans.add(span)
            extractions.append({
                "entity_type": "PERSON",
                "entity_text": name,
                "start_offset": m.start(1),
                "end_offset": m.end(1),
                "confidence": 0.80,
                "engine": primary_engine,
                "normalized_ref": name.title(),
            })

    # Organization fallback
    for m in _ORG_KEYWORDS_RE.finditer(text):
        span = (m.start(1), m.end(1))
        org_name = m.group(1).strip()
        if not any(s <= m.start(1) and m.end(1) <= e for (s, e) in seen_spans):
            seen_spans.add(span)
            extractions.append({
                "entity_type": "ORG",
                "entity_text": org_name,
                "start_offset": m.start(1),
                "end_offset": m.end(1),
                "confidence": 0.80,
                "engine": primary_engine,
                "normalized_ref": org_name.title(),
            })

    # Sort extractions by character offset
    extractions.sort(key=lambda x: x["start_offset"])
    return extractions


def _normalize_entity_text(entity_type: str, text: str) -> str:
    """Return normalized reference value for exact matching."""
    s = text.strip()
    if entity_type == "VEHICLE":
        return re.sub(r"[-\s]+", "-", s.upper())
    elif entity_type == "PHONE":
        return re.sub(r"[^\d]", "", s)[-10:]
    elif entity_type in ("PERSON", "ORG", "LOCATION"):
        return s.title()
    return s


# ---------------------------------------------------------------------------
# Conservative Candidate Matching (Phase 9)
# ---------------------------------------------------------------------------

def perform_conservative_matching(db: Session, extraction: dict[str, Any]) -> dict[str, Any]:
    """Conservatively check candidate match against operational records.
    
    SAFETY CONSTRAINTS:
    - Never auto-confirm guilt or identity.
    - Match is strictly a proposed investigative lead.
    """
    etype = extraction.get("entity_type")
    text_val = extraction.get("entity_text", "").strip()
    norm_val = extraction.get("normalized_ref") or text_val

    match_status = "unmatched"
    matched_entity_type = None
    matched_entity_id = None

    if etype == "PERSON":
        # Check against criminals table
        cand = db.query(Criminal).filter(
            or_(
                Criminal.full_name.ilike(text_val),
                Criminal.aliases.ilike(f"%{text_val}%"),
            )
        ).first()
        if cand is not None:
            match_status = "matched_criminal"
            matched_entity_type = "criminal"
            matched_entity_id = cand.id

    elif etype == "VEHICLE":
        # Check against vehicles table
        cand_veh = db.query(Vehicle).filter(
            or_(
                Vehicle.registration_number.ilike(norm_val),
                Vehicle.registration_number.ilike(text_val),
                Vehicle.registration_number.ilike(norm_val.replace("-", " ")),
            )
        ).first()
        if cand_veh is not None:
            match_status = "matched_vehicle"
            matched_entity_type = "vehicle"
            matched_entity_id = cand_veh.id

    elif etype == "PHONE":
        # Check against phone_numbers table
        clean_digits = re.sub(r"[^\d]", "", norm_val)[-10:]
        cand_phone = db.query(PhoneNumber).filter(
            or_(
                PhoneNumber.number.ilike(text_val),
                PhoneNumber.number.ilike(f"%{clean_digits}%"),
                PhoneNumber.number.ilike(f"%{clean_digits[:5]}-{clean_digits[5:]}%") if len(clean_digits) == 10 else False,
            )
        ).first()
        if cand_phone is not None:
            match_status = "matched_phone"
            matched_entity_type = "phone"
            matched_entity_id = cand_phone.id

    elif etype == "ORG":
        # Check against organizations table
        clean_org = re.sub(r"[^\w\s]", "", text_val).strip()
        cand_org = db.query(Organization).filter(
            or_(
                Organization.name.ilike(text_val),
                Organization.name.ilike(f"%{text_val}%"),
                Organization.name.ilike(f"%{clean_org}%"),
                Organization.name.ilike(norm_val),
            )
        ).first()
        if cand_org is not None:
            match_status = "matched_organization"
            matched_entity_type = "organization"
            matched_entity_id = cand_org.id

    elif etype == "LOCATION":
        # Check against locations table
        cand_loc = db.query(Location).filter(
            or_(
                Location.district.ilike(text_val),
                Location.station.ilike(f"%{text_val}%"),
                Location.address.ilike(f"%{text_val}%"),
                Location.state.ilike(text_val),
            )
        ).first()
        if cand_loc is not None:
            match_status = "matched_location"
            matched_entity_type = "location"
            matched_entity_id = cand_loc.id

    extraction["match_status"] = match_status
    extraction["matched_entity_type"] = matched_entity_type
    extraction["matched_entity_id"] = matched_entity_id
    return extraction


# ---------------------------------------------------------------------------
# Pipeline Execution over IngestionRecord (Phase 8)
# ---------------------------------------------------------------------------

def process_record_ner(db: Session, record: IngestionRecord, *, current_user: User | None = None) -> list[NERExtraction]:
    """Execute complete NER extraction, candidate matching, and co-occurrence lead creation."""
    text_to_process = record.raw_text or ""
    if not text_to_process and record.title:
        text_to_process = record.title

    if not text_to_process.strip():
        record.processing_status = "nlp_processed"
        db.commit()
        return []

    # Mark as processing
    record.processing_status = "processing"
    db.flush()

    try:
        raw_extractions = extract_entities_from_text(text_to_process)
        saved_rows: list[NERExtraction] = []

        # Track persons and orgs in the same document for conservative co-occurrence leads
        co_occurred_entities: list[tuple[str, uuid.UUID]] = []

        for item in raw_extractions:
            perform_conservative_matching(db, item)

            ner_row = NERExtraction(
                record_id=record.id,
                entity_type=item["entity_type"],
                entity_text=item["entity_text"][:500],
                start_offset=item["start_offset"],
                end_offset=item["end_offset"],
                confidence=item["confidence"],
                engine=item["engine"],
                normalized_ref=item.get("normalized_ref"),
                match_status=item["match_status"],
                matched_entity_type=item.get("matched_entity_type"),
                matched_entity_id=item.get("matched_entity_id"),
                review_status="pending",
            )
            db.add(ner_row)
            saved_rows.append(ner_row)

            if item.get("matched_entity_id") and item.get("matched_entity_type") in ("criminal", "organization"):
                co_occurred_entities.append((item["matched_entity_type"], item["matched_entity_id"]))

        # Phase 9: Co-occurrence leads (provenance='NER_EXTRACTED', confidence<=0.5, status='under_review')
        if len(co_occurred_entities) >= 2:
            _create_cooccurrence_leads(db, record, co_occurred_entities, current_user)

        record.processing_status = "nlp_processed"
        db.commit()
        return saved_rows

    except Exception as exc:
        db.rollback()
        logger.error(f"NER processing failed for record {record.id}: {exc}")
        record.processing_status = "nlp_failed"
        db.commit()
        raise


def _create_cooccurrence_leads(
    db: Session,
    record: IngestionRecord,
    entities: list[tuple[str, uuid.UUID]],
    user: User | None,
) -> None:
    """Create conservative entity_relationship leads for co-occurring entities in same document."""
    import json
    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()

    for i in range(len(entities)):
        for j in range(i + 1, len(entities)):
            src_type, src_id = entities[i]
            tgt_type, tgt_id = entities[j]
            if src_id == tgt_id:
                continue

            pair = (min(src_id, tgt_id), max(src_id, tgt_id))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)

            # Check if relationship already exists
            existing = db.query(EntityRelationship).filter(
                or_(
                    (EntityRelationship.source_id == src_id) & (EntityRelationship.target_id == tgt_id),
                    (EntityRelationship.source_id == tgt_id) & (EntityRelationship.target_id == src_id),
                )
            ).first()

            if existing is None:
                evidence_json = json.dumps([{
                    "record_type": "raw_ingested_data",
                    "record_id": str(record.id),
                    "title": record.title or record.external_ref or "Ingested Document",
                    "note": "NER Co-occurrence candidate lead (under review)",
                }])
                rel = EntityRelationship(
                    source_type="person" if src_type == "criminal" else src_type,
                    source_id=src_id,
                    target_type="person" if tgt_type == "criminal" else tgt_type,
                    target_id=tgt_id,
                    relationship_type="associated_with",
                    weight=0.5,
                    confidence=0.45,  # <= 0.5 as required by Phase 9
                    status="under_review",  # explicitly under_review
                    provenance="NER_EXTRACTED",
                    inferred_from="ner_cooccurrence",
                    evidence_records=evidence_json,
                    created_by_id=user.id if user else None,
                )
                db.add(rel)


# ---------------------------------------------------------------------------
# Human Review of Extraction Lead (Phase 10 & 16)
# ---------------------------------------------------------------------------

def review_ner_extraction(
    db: Session,
    user: User,
    extraction_id: uuid.UUID,
    decision: str,
    note: str | None = None,
) -> NERExtraction:
    """Confirm or reject a candidate extraction lead with full audit trail.
    
    'confirm' means: confirm the candidate extraction / match is accurate.
    NOT: confirm guilt or accusation.
    """
    decision_clean = decision.strip().lower()
    if decision_clean not in ("confirm", "confirmed", "reject", "rejected"):
        raise ValueError("Decision must be 'confirm' or 'reject'")

    ext = db.query(NERExtraction).filter(NERExtraction.id == extraction_id).first()
    if ext is None:
        raise ValueError(f"NERExtraction {extraction_id} not found")

    new_status = "confirmed" if decision_clean in ("confirm", "confirmed") else "rejected"
    ext.review_status = new_status
    ext.reviewed_by_id = user.id
    ext.reviewed_at = datetime.now(timezone.utc)
    ext.review_note = note

    audit_service.log_action(
        db,
        user,
        "REVIEW",
        "NERExtraction",
        str(ext.id),
        details=f"decision={new_status}; type={ext.entity_type}; text={ext.entity_text}; note={note or ''}",
        metadata_json=f'{{"decision":"{new_status}","entity_type":"{ext.entity_type}","entity_text":"{ext.entity_text}"}}',
    )
    db.commit()
    db.refresh(ext)
    return ext
