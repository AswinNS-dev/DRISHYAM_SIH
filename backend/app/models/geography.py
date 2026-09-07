"""Authoritative Indian geographic hierarchy models (States, Districts, Police Stations)."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import UUIDPKMixin


class State(Base, UUIDPKMixin):
    """Normalized Indian State / Union Territory."""
    __tablename__ = "states"

    state_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    state_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    state_type: Mapped[str] = mapped_column(String(30), default="state", nullable=False)  # state | union_territory
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    districts: Mapped[list["District"]] = relationship(back_populates="state", cascade="all, delete-orphan")


class District(Base, UUIDPKMixin):
    """Normalized District belonging to a State."""
    __tablename__ = "districts"

    state_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("states.id", ondelete="CASCADE"), nullable=False, index=True
    )
    district_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    district_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    state: Mapped["State"] = relationship(back_populates="districts")
    police_stations: Mapped[list["PoliceStation"]] = relationship(back_populates="district", cascade="all, delete-orphan")


class PoliceStation(Base, UUIDPKMixin):
    """Normalized Police Station belonging to a District."""
    __tablename__ = "police_stations"

    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("districts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    station_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    station_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    district: Mapped["District"] = relationship(back_populates="police_stations")
