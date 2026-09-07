"""Named Entity Recognition (NER) routes (SIH26189 Phase 10).

Admin operations: process record, batch backfill.
Investigation / Review operations: view extractions, candidate review queue.
All actions follow strict RBAC and audit logging.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ALL_ROLES,
    REVIEW_ROLES,
    ROLE_ADMIN,
    require_roles,
)
from app.database.postgres import get_db, get_worker_session
from app.models.intel_entity import IngestionRecord
from app.models.ner import NERExtraction
from app.models.user import User
from app.services import audit_service
from app.services.ner_service import (
    extract_entities_from_text,
    process_record_ner,
    review_ner_extraction,
)

router = APIRouter(prefix="/ner", tags=["Named Entity Recognition (NER)"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class NERExtractionOut(BaseModel):
    id: str
    record_id: str
    entity_type: str
    entity_text: str
    start_offset: int
    end_offset: int
    confidence: float
    engine: str
    normalized_ref: str | None = None
    match_status: str
    matched_entity_type: str | None = None
    matched_entity_id: str | None = None
    review_status: str
    reviewed_by_id: str | None = None
    reviewed_at: str | None = None
    review_note: str | None = None
    created_at: str | None = None


class NERReviewPayload(BaseModel):
    decision: str = Field(description="'confirm' or 'reject'")
    note: str | None = Field(default=None, max_length=1000)


def _serialize_extraction(ext: NERExtraction) -> dict[str, Any]:
    return {
        "id": str(ext.id),
        "record_id": str(ext.record_id),
        "entity_type": ext.entity_type,
        "entity_text": ext.entity_text,
        "start_offset": ext.start_offset,
        "end_offset": ext.end_offset,
        "confidence": ext.confidence,
        "engine": ext.engine,
        "normalized_ref": ext.normalized_ref,
        "match_status": ext.match_status,
        "matched_entity_type": ext.matched_entity_type,
        "matched_entity_id": str(ext.matched_entity_id) if ext.matched_entity_id else None,
        "review_status": ext.review_status,
        "reviewed_by_id": str(ext.reviewed_by_id) if ext.reviewed_by_id else None,
        "reviewed_at": ext.reviewed_at.isoformat() if ext.reviewed_at else None,
        "review_note": ext.review_note,
        "created_at": ext.created_at.isoformat() if ext.created_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/process/{record_id}",
    response_model=list[NERExtractionOut],
    dependencies=[Depends(require_roles(ROLE_ADMIN))],
)
def process_single_record(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only: run NER extraction and candidate matching on a raw ingested record."""
    record = db.query(IngestionRecord).filter(IngestionRecord.id == record_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail=f"Ingestion record {record_id} not found")

    try:
        extractions = process_record_ner(db, record, current_user=current_user)
        audit_service.log_action(
            db,
            current_user,
            "NER_PROCESS",
            "IngestionRecord",
            str(record.id),
            details=f"Extracted {len(extractions)} entities from record {record.id}",
        )
        db.commit()
        return [_serialize_extraction(e) for e in extractions]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"NER processing failed: {exc}")


@router.post(
    "/backfill",
    dependencies=[Depends(require_roles(ROLE_ADMIN))],
)
def backfill_ner(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    """Admin-only: batch backfill NER over pending raw ingested documents using worker session."""
    worker_db = get_worker_session()
    try:
        # Find records that are imported or pending and have raw_text
        records = (
            worker_db.query(IngestionRecord)
            .filter(
                IngestionRecord.raw_text.isnot(None),
                IngestionRecord.processing_status.in_(("imported", "pending")),
            )
            .order_by(IngestionRecord.created_at.desc())
            .limit(limit)
            .all()
        )

        processed_count = 0
        total_extracted = 0

        for rec in records:
            exts = process_record_ner(worker_db, rec, current_user=current_user)
            processed_count += 1
            total_extracted += len(exts)

        audit_service.log_action(
            worker_db,
            current_user,
            "NER_BACKFILL",
            "IngestionRecord",
            details=f"Backfilled NER over {processed_count} records ({total_extracted} extractions)",
        )
        worker_db.commit()
        return {
            "status": "completed",
            "records_processed": processed_count,
            "total_entities_extracted": total_extracted,
        }
    finally:
        worker_db.close()


@router.get(
    "/records/{record_id}",
    response_model=list[NERExtractionOut],
    dependencies=[Depends(require_roles(*REVIEW_ROLES))],
)
def get_record_extractions(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all NER extractions for a specific ingested intelligence document."""
    rows = (
        db.query(NERExtraction)
        .filter(NERExtraction.record_id == record_id)
        .order_by(NERExtraction.start_offset.asc())
        .all()
    )
    return [_serialize_extraction(r) for r in rows]


@router.get(
    "/extractions/pending",
    response_model=list[NERExtractionOut],
    dependencies=[Depends(require_roles(*REVIEW_ROLES))],
)
def get_pending_review_queue(
    entity_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve pending candidate extraction leads requiring investigator review."""
    query = db.query(NERExtraction).filter(NERExtraction.review_status == "pending")
    if entity_type:
        query = query.filter(NERExtraction.entity_type == entity_type.upper())
    rows = query.order_by(NERExtraction.created_at.desc()).limit(limit).all()
    return [_serialize_extraction(r) for r in rows]


@router.post(
    "/extractions/{id}/review",
    response_model=NERExtractionOut,
    dependencies=[Depends(require_roles(*REVIEW_ROLES))],
)
def review_extraction_endpoint(
    id: uuid.UUID,
    payload: NERReviewPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm or reject a candidate extraction lead with full audit trail."""
    try:
        updated = review_ner_extraction(
            db,
            user=current_user,
            extraction_id=id,
            decision=payload.decision,
            note=payload.note,
        )
        return _serialize_extraction(updated)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
