import uuid
from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.import_job import ImportProvenanceMixin
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Location(ImportProvenanceMixin, Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "locations"
    __table_args__ = (UniqueConstraint("station", "address", name="uq_location_station_address"),)

    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    station: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Optional foreign keys linking to normalized geographic hierarchy
    state_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("states.id", ondelete="SET NULL"), nullable=True, index=True
    )
    district_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("districts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    police_station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("police_stations.id", ondelete="SET NULL"), nullable=True, index=True
    )

    state_rel: Mapped["State | None"] = relationship("State", foreign_keys=[state_id])
    district_rel: Mapped["District | None"] = relationship("District", foreign_keys=[district_id])
    station_rel: Mapped["PoliceStation | None"] = relationship("PoliceStation", foreign_keys=[police_station_id])

    crimes: Mapped[list["CrimeCase"]] = relationship(back_populates="location")

