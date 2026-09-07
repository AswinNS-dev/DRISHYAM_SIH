"""NER extraction tracking model (SIH26189 Phase 7)."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import UUIDPKMixin


class NERExtraction(Base, UUIDPKMixin):
    """Audited named-entity extraction record grounded in raw ingested intelligence."""
    __tablename__ = "ner_extractions"

    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("raw_ingested_data.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # PERSON | ORG | LOCATION | PHONE | VEHICLE | DATE | MONEY | FIR_NO
    entity_text: Mapped[str] = mapped_column(String(500), nullable=False)
    start_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    end_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    engine: Mapped[str] = mapped_column(String(50), nullable=False)
    # spacy/en_core_web_sm | rule_based_fallback
    normalized_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Candidate matching (conservative, never auto-accuse)
    match_status: Mapped[str] = mapped_column(String(50), default="unmatched", nullable=False, index=True)
    # unmatched | matched_criminal | matched_organization | matched_location
    matched_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    matched_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    # Human-in-the-loop review
    review_status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False, index=True)
    # pending | confirmed | rejected
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    record: Mapped["IngestionRecord"] = relationship(foreign_keys=[record_id])
    reviewed_by: Mapped["User"] = relationship(foreign_keys=[reviewed_by_id])

    __table_args__ = (
        Index("ix_ner_extractions_record_type", "record_id", "entity_type"),
    )
