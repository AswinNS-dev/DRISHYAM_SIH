"""Geographical hierarchy routes: States -> Districts -> Police Stations (SIH26189 Phase 4A & 12A)."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, require_roles
from app.database.postgres import get_db
from app.models.geography import District, PoliceStation, State

router = APIRouter(prefix="/geography", tags=["Geographical Hierarchy"], dependencies=[Depends(require_roles(*ALL_ROLES))])


class StateOut(BaseModel):
    id: str
    state_code: str
    state_name: str
    state_type: str


class DistrictOut(BaseModel):
    id: str
    state_id: str
    district_code: str
    district_name: str


class PoliceStationOut(BaseModel):
    id: str
    district_id: str
    station_code: str
    station_name: str
    latitude: float
    longitude: float


@router.get("/states", response_model=list[StateOut])
def list_states(db: Session = Depends(get_db)):
    """List all authoritative Indian States and Union Territories."""
    states = db.query(State).order_by(State.state_name.asc()).all()
    return [
        {
            "id": str(s.id),
            "state_code": s.state_code,
            "state_name": s.state_name,
            "state_type": s.state_type,
        }
        for s in states
    ]


@router.get("/states/{state_id}/districts", response_model=list[DistrictOut])
def list_districts_by_state(state_id: uuid.UUID, db: Session = Depends(get_db)):
    """List all districts belonging to a specific state."""
    districts = (
        db.query(District)
        .filter(District.state_id == state_id)
        .order_by(District.district_name.asc())
        .all()
    )
    return [
        {
            "id": str(d.id),
            "state_id": str(d.state_id),
            "district_code": d.district_code,
            "district_name": d.district_name,
        }
        for d in districts
    ]


@router.get("/districts/{district_id}/stations", response_model=list[PoliceStationOut])
def list_stations_by_district(district_id: uuid.UUID, db: Session = Depends(get_db)):
    """List all police stations belonging to a specific district."""
    stations = (
        db.query(PoliceStation)
        .filter(PoliceStation.district_id == district_id)
        .order_by(PoliceStation.station_name.asc())
        .all()
    )
    return [
        {
            "id": str(s.id),
            "district_id": str(s.district_id),
            "station_code": s.station_code,
            "station_name": s.station_name,
            "latitude": s.latitude,
            "longitude": s.longitude,
        }
        for s in stations
    ]
