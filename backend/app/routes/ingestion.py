"""SIH26189 admin-only data-ingestion routes.

Every endpoint on this router requires the ``admin`` role — enforced
server-side by the router-level ``require_roles`` dependency, matching the
problem statement's "ONLY ADMIN USERS ARE ALLOWED TO PERFORM DATA INGESTION"
constraint. The frontend Admin panel additionally hides the UI, but that is a
presentation-layer courtesy only; authorization lives here.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ROLE_ADMIN, require_roles
from app.database.postgres import get_db
from app.models.intel_entity import (
    DataSource,
    EntityRelationship,
    IngestionJob,
    IngestionRecord,
    IntelAnomaly,
    SuspiciousPattern,
)
from app.services import audit_service
from app.services.intel_ingestion_service import (
    SOURCE_TYPE_SPECS,
    VALID_SOURCE_TYPES,
    archive_job,
    run_ingestion,
    serialize_job,
    serialize_record,
    serialize_relationship,
)

router = APIRouter(
    prefix="/ingestion",
    tags=["Data Ingestion (Admin)"],
    dependencies=[Depends(require_roles(ROLE_ADMIN))],
)


class IngestionRecordPayload(BaseModel):
    """A single structured intelligence record. Free text is stored verbatim."""

    model_config = {"extra": "allow"}

    fir_number: str | None = None
    external_ref: str | None = None
    title: str | None = None
    raw_text: str | None = Field(default=None, max_length=100_000)
    case_number: str | None = None
    person_name: str | None = Field(default=None, max_length=255)
    organization_name: str | None = Field(default=None, max_length=255)


class IngestionJobPayload(BaseModel):
    source_type: str
    source_name: str | None = Field(default=None, max_length=255)
    records: list[IngestionRecordPayload] = Field(min_length=1, max_length=500)


class DataSourcePayload(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    source_type: str
    description: str | None = Field(default=None, max_length=2000)
    contact: str | None = Field(default=None, max_length=255)
    is_active: bool = True


@router.get("/sources")
def list_data_sources(db: Session = Depends(get_db)):
    """Registered upstream intelligence sources + supported ingestion types."""
    sources = db.query(DataSource).order_by(DataSource.created_at.desc()).all()
    return {
        "supported_source_types": [
            {"source_type": key, "label": spec["label"], "required_fields": spec["required"], "optional_fields": spec["optional"]}
            for key, spec in SOURCE_TYPE_SPECS.items()
        ],
        "job_statuses": ["pending", "validated", "imported", "failed", "archived"],
        "sources": [
            {
                "id": str(s.id),
                "name": s.name,
                "source_type": s.source_type,
                "description": s.description,
                "contact": s.contact,
                "is_active": s.is_active,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sources
        ],
    }


@router.post("/sources", status_code=status.HTTP_201_CREATED)
def create_data_source(payload: DataSourcePayload, db: Session = Depends(get_db), current_user: Any = Depends(get_current_user)):
    if payload.source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown source_type '{payload.source_type}'")
    existing = db.query(DataSource).filter(DataSource.name == payload.name).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="A data source with this name already exists")
    source = DataSource(
        name=payload.name,
        source_type=payload.source_type,
        description=payload.description,
        contact=payload.contact,
        is_active=payload.is_active,
        created_by_id=current_user.id,
    )
    db.add(source)
    audit_service.log_action(db, current_user, "CREATE", "DataSource", payload.name)
    db.commit()
    db.refresh(source)
    return {"id": str(source.id), "name": source.name, "source_type": source.source_type}


@router.post("/jobs", status_code=status.HTTP_201_CREATED)
def create_ingestion_job(payload: IngestionJobPayload, db: Session = Depends(get_db), current_user: Any = Depends(get_current_user)):
    """Run the ingestion pipeline: validate → store raw → normalize → link entities."""
    if payload.source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown source_type '{payload.source_type}'. Supported: {sorted(VALID_SOURCE_TYPES)}")
    try:
        job = run_ingestion(
            db,
            source_type=payload.source_type,
            source_name=payload.source_name,
            records=[r.model_dump(exclude_none=True) for r in payload.records],
            user_id=current_user.id,
            user_obj=current_user,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    db.commit()
    db.refresh(job)
    return serialize_job(job)


@router.get("/jobs")
def list_ingestion_jobs(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(IngestionJob).order_by(IngestionJob.created_at.desc())
    if status_filter:
        query = query.filter(IngestionJob.status == status_filter)
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "results": [serialize_job(j) for j in rows]}


@router.get("/jobs/{job_id}")
def get_ingestion_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    payload = serialize_job(job)
    records = (
        db.query(IngestionRecord)
        .filter(IngestionRecord.source_type == job.source_type, IngestionRecord.source_name == job.source_name)
        .order_by(IngestionRecord.created_at.desc())
        .limit(200)
        .all()
    )
    payload["records"] = [serialize_record(r) for r in records]
    return payload


@router.post("/jobs/{job_id}/archive")
def archive_ingestion_job(job_id: str, db: Session = Depends(get_db), current_user: Any = Depends(get_current_user)):
    job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    archive_job(db, job)
    audit_service.log_action(db, current_user, "UPDATE", "IngestionJob", str(job.id), details="archived")
    db.commit()
    db.refresh(job)
    return serialize_job(job)


@router.get("/overview")
def ingestion_overview(db: Session = Depends(get_db)):
    """Status summary for the admin ingestion dashboard."""
    rows = db.query(IngestionJob.status).all()
    counts: dict[str, int] = {}
    for (job_status,) in rows:
        counts[job_status] = counts.get(job_status, 0) + 1
    recent = db.query(IngestionJob).order_by(IngestionJob.created_at.desc()).limit(8).all()
    relationships_total = db.query(EntityRelationship).count()
    patterns_total = db.query(SuspiciousPattern).filter(SuspiciousPattern.status == "detected").count()
    anomalies_total = db.query(IntelAnomaly).filter(IntelAnomaly.status == "open").count()
    return {
        "status_counts": counts,
        "totals": {
            "jobs": len(rows),
            "relationships": relationships_total,
            "suspicious_patterns": patterns_total,
            "open_anomalies": anomalies_total,
        },
        "recent_jobs": [serialize_job(j) for j in recent],
    }


@router.get("/relationships")
def list_entity_relationships(
    relationship_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(EntityRelationship).order_by(EntityRelationship.last_seen.desc())
    if relationship_type:
        query = query.filter(EntityRelationship.relationship_type == relationship_type)
    return {"total": query.count(), "results": [serialize_relationship(e) for e in query.limit(limit).all()]}


@router.get("/records")
def list_ingestion_records(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List raw ingested intelligence documents and their processing status."""
    records = db.query(IngestionRecord).order_by(IngestionRecord.created_at.desc()).limit(limit).all()
    return [serialize_record(r) for r in records]

