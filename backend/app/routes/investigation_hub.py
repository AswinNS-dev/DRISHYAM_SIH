"""Investigation Hub — officer-centric unified investigation intelligence.

Provides a fast, mobile-friendly entry point for KSP officers:

* ``GET /investigation-hub/search``   — grouped federation search across real
  authorized records (persons, cases, FIRs, locations, police stations and
  modus-operandi matches).
* ``GET /investigation-hub/interpret`` — natural-language (English + Kannada +
  mixed) interpretation of a clue into structured retrieval filters.
* ``POST /investigation-hub/image-search`` — honest image-search workflow.
  No face-matching engine ships with DRISHYAM, so this endpoint reports a safe
  "unavailable" state and never fabricates an identity match.

Every result originates from the real, authorized database.  Nothing is invented.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ALL_ROLES,
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    ROLE_POLICYMAKER,
    require_roles,
)
from app.database.postgres import get_db
from app.models.crime import CrimeCase
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink
from app.models.location import Location
from app.models.officer import Officer
from app.models.victim import Victim
from app.services.mo_semantic_service import search_similar_mo

router = APIRouter(
    prefix="/investigation-hub",
    tags=["Investigation Hub"],
    dependencies=[Depends(require_roles(*ALL_ROLES))],
)

# Roles permitted to view MO (semantic) intelligence.  Other roles still see
# the person/case/FIR/location/station groups but not MO matches.
_MO_ROLES = (ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER)

# ---------------------------------------------------------------------------
# Kannada / mixed-language support
# ---------------------------------------------------------------------------

# Kannada -> English crime category mapping
_KANNADA_CRIME = {
    "ಕೊಲೆ": "murder", "ಕೊಲೆ ಪ್ರಕರಣ": "murder", "ಹತ್ಯೆ": "murder",
    "ಕಳ್ಳತನ": "theft", "ಕಳವು": "theft", "ಚೋರಿ": "theft",
    "ನಕಲಿ": "fraud", "ವಂಚನೆ": "fraud",
    "ಮಾದಕವಸ್ತು": "narcotics", "ಡ್ರಗ್ಸ್": "narcotics", "ಔಷಧ": "narcotics",
    "ಅತ್ಯಾಚಾರ": "assault", "ಹಲ್ಲೆ": "assault", "ದಾಳಿ": "assault",
    "ಅಪಹರಣ": "kidnapping", "ಕಿಡ್ನಾಪ್": "kidnapping",
    "ದರೋಡೆ": "robbery", "ದರೋಡೆಯ": "robbery",
    "ಕೊಲೆ/ದರೋಡೆ": "robbery", "ಸುಲಿಗೆ": "extortion",
}

# Kannada district -> English district
_KANNADA_DISTRICT = {
    "ಬೆಂಗಳೂರು": "Bengaluru Urban", "ಬೆಂಗಳೂರು ಅರ್ಬನ್": "Bengaluru Urban",
    "ಬೆಂಗಳೂರು ನಗರ": "Bengaluru Urban", "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ": "Bengaluru Rural",
    "ಮೈಸೂರು": "Mysuru", "ಮಂಗಳೂರು": "Mangaluru", "ಬೆಳಗಾವಿ": "Belagavi",
    "ಬಳ್ಳಾರಿ": "Ballari", "ಕಲಬುರಗಿ": "Kalaburagi", "ಹಾಸನ": "Hassan",
    "ತುಮಕೂರು": "Tumkuru", "ಧಾರವಾಡ": "Dharwad",
}

# Kannada injury / MO indicator words -> normalized English keyword
_KANNADA_MO = {
    "ಕುತ್ತಿಗೆ": "neck", "ಕುತ್ತಿಗೆ ಗಾಯ": "neck", "ಗಂಟಲು": "neck",
    "ಕತ್ತರಿಸಿ": "cut", "ಕತ್ತರಿಸಿದ": "cut", "ಇರಿದ": "stabbed", "ಇರಿಯುವ": "stab",
    "ಗನ್": "gun", "ಬಂದೂಕು": "gun", "ಪಿಸ್ತೂಲ್": "pistol", "ಚಾಕು": "knife",
    "ಕೊಡಲಿ": "axe", "ಎತ್ತುಗ": "crowbar",
}

_KANNADA_STATION = {
    "ಕೆಂಪೇಗೌಡ ನಗರ": "Kempegowda Nagar", "ವೈಟ್‌ಫೀಲ್ಡ್": "Whitefield",
    "ಕೆ ಆರ್ ಪುರಂ": "KR Puram", "ಇಂದಿರಾನಗರ": "Indiranagar",
    "ಜಯನಗರ": "Jayanagar", "ಕೋರಮಂಗಲ": "Koramangala",
}

_KANNADA_CONNECTORS = {
    "ಯಾವುದು": "", "ಯಾವ": "", "ಇವರ": "", "ನ": "", "ಇದೆ": "", "ತೋರಿಸಿ": "",
    "ಅಲ್ಲಿ": "", "ಎಲ್ಲ": "", "ಪ್ರಕರಣಗಳನ್ನು": "case", "ಪ್ರಕರಣ": "case",
    "ಸಂಬಂಧ": "related", "ಹಿಂದಿನ": "previous", "ಇದೇ": "similar",
}

# Kanglish (Kannada in Roman characters) normalization
_KANGLISH_TO_KANNADA: dict[str, str] = {
    "tanike": "ತನಿಖೆ",
    "thanike": "ತನಿಖೆ",
    "shankita": "ಶಂಕಿತ",
    "shankitha": "ಶಂಕಿತ",
    "saakshya": "ಸಾಕ್ಷ್ಯ",
    "sakshya": "ಸಾಕ್ಷ್ಯ",
    "aparadha": "ಅಪರಾಧ",
    "prakarana": "ಪ್ರಕರಣ",
    "guptachara": "ಗುಪ್ತಚರ",
    "huduku": "ಹುಡುಕು",
    "huduki": "ಹುಡುಕು",
    "adhikari": "ಅಧಿಕಾರಿ",
    "badhita": "ಬಾಧಿತ",
    "nirbandha": "ಬಂಧನ",
    "varadhi": "ವರದಿ",
    "jaala": "ಜಾಲ",
    "apaya": "ಅಪಾಯ",
    "namaskara": "ನಮಸ್ಕಾರ",
    "namaskar": "ನಮಸ್ಕಾರ",
    "police": "ಪೊಲೀಸ್",
    "kelsa": "ಕೆಲಸ",
    "maneya": "ಮನೆಯ",
    "halli": "ಹಳ್ಳಿ",
    "nagara": "ನಗರ",
    "jilla": "ಜಿಲ್ಲೆ",
    "thani": "ತನಿ",
    "case": "ಕೇಸ್",
    "murder": "ಕೊಲೆ",
    "theft": "ಕಳ್ಳತನ",
    "robbery": "ದರೋಡೆ",
    "assault": "ಹಲ್ಲೆ",
    "fraud": "ಮೋಸ",
    "cyber": "ಸೈಬರ್",
    "drug": "ಮಾದಕ",
    "gang": "ಗ್ಯಾಂಗ್",
    "weapon": "ಆಯುಧ",
    "vehicle": "ವಾಹನ",
    "phone": "ಫೋನ್",
    "night": "ರಾತ್ರಿ",
    "day": "ಹಗಲು",
    "morning": "ಬೆಳಿಗ್ಗೆ",
    "evening": "ಸಂಜೆ",
}


def _is_kanglish(text: str) -> bool:
    """Detect if text is Kanglish (Roman characters used for Kannada words)."""
    if not text:
        return False
    text_lower = text.lower().strip()
    words = text_lower.split()
    kanglish_hits = sum(1 for w in words if w in _KANGLISH_TO_KANNADA or any(k in w for k in _KANGLISH_TO_KANNADA))
    return kanglish_hits >= len(words) * 0.3 and len(words) >= 1


def _normalize_kanglish(text: str) -> str:
    """Convert Kanglish terms to their English equivalents for search."""
    text_lower = text.lower()
    result = text_lower
    for kanglish, kannada in _KANGLISH_TO_KANNADA.items():
        result = result.replace(kanglish, kannada)
    return result

_KANNADA_TIME = {
    "ಕಳೆದ ವಾರ": 7, "ಕಳೆದ ತಿಂಗಳ": 30, "ಕಳೆದ ವರ್ಷ": 365,
    "ಈ ವಾರ": 7, "ಈ ತಿಂಗಳ": 30, "ಈ ವರ್ಷ": 365, "ಇತ್ತೀಚಿನ": 30,
}

_ENGLISH_TIME = {
    "last week": 7, "past week": 7, "last month": 30, "past month": 30,
    "last year": 365, "past year": 365, "this week": 7, "this month": 30,
    "this year": 365, "recent": 30,
}

_ENGLISH_CRIME = [
    "murder", "homicide", "theft", "burglary", "robbery", "fraud", "cyber crime",
    "narcotics", "smuggling", "assault", "illegal mining", "domestic violence",
    "property disputes", "kidnapping", "extortion", "rape",
]

_ENGLISH_MO = {
    "neck": "neck", "cut": "cut", "stabb": "stabbing", "knife": "knife",
    "gun": "gun", "shoot": "shooting", "strangl": "strangulation",
    "poison": "poison", "hammer": "hammer", "axe": "axe",
}

_CASE_RE = re.compile(r"CR-\d{4}-[A-Z]{2,4}-\d+", re.I)
_FIR_RE = re.compile(r"(?:FIR[-\s]*)?(\d{3,4}/[A-Z]{0,4}/?\d{3,4})", re.I)
_PHONE_RE = re.compile(r"(\+91[\s-]?\d{5}[\s-]?\d{5}|\b\d{10}\b)")


def _contains_any(text: str, keys: list[str]) -> bool:
    lower = text.lower()
    return any(k.lower() in lower for k in keys)


class Interpretation(BaseModel):
    """Structured interpretation of a natural-language clue."""

    query: str
    detected_language: str  # "kannada" | "english" | "mixed" | "kanglish"
    person_name: str | None = None
    case_number: str | None = None
    fir_number: str | None = None
    district: str | None = None
    station: str | None = None
    crime_type: str | None = None
    mo_keywords: list[str] = []
    phone: str | None = None
    date_range_days: int | None = None
    search_term: str = ""
    confidence: str = "low"  # high | medium | low
    notes: list[str] = []


def _normalise_crime(text: str) -> str | None:
    lower = text.lower()
    for en in _ENGLISH_CRIME:
        if en in lower:
            return en.title()
    return None


def _fuzzy_kannada(text: str, mapping: dict[str, str]) -> str | None:
    for kan, en in mapping.items():
        if kan in text:
            return en
    return None


def _collect_mo_keywords(text: str) -> list[str]:
    found: list[str] = []
    lower = text.lower()
    for kan, en in _KANNADA_MO.items():
        if kan in text and en not in found:
            found.append(en)
    for en, norm in _ENGLISH_MO.items():
        if en in lower and norm not in found:
            found.append(norm)
    return found


@router.get("/interpret", response_model=Interpretation)
def interpret_query(
    q: str = Query(..., min_length=1, max_length=500),
    current_user: Any = Depends(get_current_user),
):
    """Interpret an English, Kannada, or mixed-language investigation clue into
    structured retrieval filters.  Mirrors the entity extraction used by the AI
    chat but adds Kannada + mixed-language support against the real gazetteers.
    """
    if not q.strip():
        return Interpretation(query=q)

    # Detect language presence (Kannada Unicode range 0C80-0CFF).
    kannada_chars = sum(1 for ch in q if 0x0C80 <= ord(ch) <= 0x0CFF)
    if kannada_chars and _contains_any(q, _KANNADA_CONNECTORS.keys()):
        detected = "kannada"
        mixed = bool(re.search(r"[a-zA-Z]", q))
        if mixed:
            detected = "mixed"
    elif _is_kanglish(q):
        detected = "kanglish"
    else:
        detected = "english"

    result = Interpretation(query=q, detected_language=detected, search_term=q.strip())

    # Kanglish normalization: map Romanized Kannada words to Kannada script
    # so existing gazetteers can match them.
    normalized_q = q
    if detected == "kanglish":
        normalized_q = _normalize_kanglish(q)

    # Case / FIR / phone identifiers
    case_match = _CASE_RE.search(q)
    if case_match:
        result.case_number = case_match.group(0).upper()
        result.search_term = case_match.group(0).upper()
        result.confidence = "high"
        return result

    fir_match = _FIR_RE.search(q)
    if fir_match:
        result.fir_number = fir_match.group(1)
        result.search_term = fir_match.group(1)
        result.confidence = "high"
        return result

    phone_match = _PHONE_RE.search(q)
    if phone_match:
        result.phone = phone_match.group(1)

    # District & station — Kannada then English gazetteers.
    result.district = _fuzzy_kannada(normalized_q, _KANNADA_DISTRICT)
    if not result.district:
        for d in [
            "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Mangaluru",
            "Belagavi", "Ballari", "Kalaburagi", "Hassan", "Tumkuru", "Dharwad",
            "Bengaluru", "Bangalore", "Mysore", "Mangalore", "Bellary",
        ]:
            if d.lower() in q.lower():
                result.district = d
                break

    result.station = _fuzzy_kannada(normalized_q, _KANNADA_STATION)
    if not result.station:
        for s in [
            "Whitefield", "KR Puram", "Kempegowda Nagar", "Indiranagar",
            "Jayanagar", "Koramangala", "HSR Layout", "Peenya", "Yelahanka",
            "Devaraja", "Mangaluru Harbor", "Belagavi City",
        ]:
            if s.lower() in q.lower():
                result.station = s
                break

    # Crime type
    result.crime_type = _fuzzy_kannada(normalized_q, _KANNADA_CRIME)
    if not result.crime_type:
        result.crime_type = _normalise_crime(q)

    # MO / injury indicators
    result.mo_keywords = _collect_mo_keywords(normalized_q)

    # Time ranges — Kannada then English.
    for kan, days in _KANNADA_TIME.items():
        if kan in normalized_q:
            result.date_range_days = days
            break
    if result.date_range_days is None:
        lower = q.lower()
        for en, days in _ENGLISH_TIME.items():
            if en in lower:
                result.date_range_days = days
                break

    # Person name heuristic (English only; Kannada names are left for search).
    if detected != "english":
        mo = re.search(r"(?:of|named|about|for|regarding)\s+([A-Za-z][A-Za-z ]{1,60})$", q)
        if mo:
            result.person_name = mo.group(1).strip().title()
    else:
        name = re.search(
            r"(?:named|about|for|of|who is|regarding)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})",
            q,
        )
        if name:
            candidate = name.group(1)
            if not re.match(r"CR-\d{4}", candidate) and not re.match(r"FIR", candidate):
                result.person_name = candidate

    # Build a clean search term dominated by the extracted filters so the
    # grouped search returns real, useful records.
    parts: list[str] = []
    if result.person_name:
        parts.append(result.person_name)
    if result.crime_type:
        parts.append(result.crime_type)
    if result.district:
        parts.append(result.district)
    if result.station:
        parts.append(result.station)
    if result.mo_keywords:
        parts.extend(result.mo_keywords)
    if not parts:
        parts.append(q.strip())

    result.search_term = " ".join(dict.fromkeys(parts))

    # Confidence scoring
    strength = sum([
        bool(result.case_number),
        bool(result.fir_number),
        bool(result.person_name),
        bool(result.district),
        bool(result.station),
        bool(result.crime_type),
        bool(result.mo_keywords),
        bool(result.phone),
        bool(result.date_range_days),
    ])
    if strength >= 2:
        result.confidence = "high"
    elif strength == 1:
        result.confidence = "medium"
    if case_match or fir_match:
        result.confidence = "high"

    if not strength and detected in ("kannada", "mixed", "kanglish"):
        result.notes.append(
            "Kannada query interpreted, but no district/crime/person filter could be "
            "matched confidently. Suggest searching by district, station or crime type."
        )
    return result


# ---------------------------------------------------------------------------
# Grouped federated search
# ---------------------------------------------------------------------------


class SearchItem(BaseModel):
    id: str
    type: str  # person | case | fir | location | station | mo
    name: str
    detail: str
    status: str | None = None
    subtitle: str | None = None
    meta: dict[str, Any] = {}


class GroupedSearchResult(BaseModel):
    query: str
    persons: list[SearchItem] = []
    victims: list[SearchItem] = []
    cases: list[SearchItem] = []
    firs: list[SearchItem] = []
    locations: list[SearchItem] = []
    stations: list[SearchItem] = []
    mo_matches: list[SearchItem] = []
    mo_intelligence: bool = False
    total: int = 0
    provenance: str = "LIVE"


@router.get("/search", response_model=GroupedSearchResult)
def investigation_search(
    q: str = Query(..., min_length=1, max_length=500),
    limit: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Federated grouped search across real authorized records.

    Respects user role: MO (semantic) matches are only returned for roles that
    hold MO intelligence permission.  Only categories that actually have results
    are populated.
    """
    query = q.strip()
    pattern = f"%{query}%"
    attempt_mo = current_user.role.name in _MO_ROLES if hasattr(current_user, "role") else True

    result = GroupedSearchResult(query=query)
    result.provenance = "LIVE"

    # ── Persons (criminals) ──
    persons = db.query(Criminal).options(
        selectinload(Criminal.fir_links)
    ).filter(
        or_(
            Criminal.full_name.ilike(pattern),
            Criminal.aliases.ilike(pattern),
            Criminal.mo_summary.ilike(pattern),
        )
    ).limit(limit).all()
    for c in persons:
        case_count = len(c.fir_links)
        result.persons.append(SearchItem(
            id=f"criminal-{c.id}",
            type="person",
            name=c.full_name,
            detail=(c.aliases and f"Alias: {c.aliases}" or "No aliases"),
            status=c.status,
            subtitle=f"{case_count} linked FIR(s) | gang: {c.gang_affiliation or 'N/A'}",
            meta={"criminal_id": str(c.id), "case_count": case_count, "gang": c.gang_affiliation},
        ))

    # ── Victims / witnesses ──
    victims = db.query(Victim).filter(
        or_(
            Victim.full_name.ilike(pattern),
            Victim.contact_number.ilike(pattern),
            Victim.address.ilike(pattern),
        )
    ).limit(limit).all()
    for v in victims:
        result.victims.append(SearchItem(
            id=f"victim-{v.id}",
            type="victim",
            name=v.full_name,
            detail=f"Victim/Witness | {v.gender or 'Gender N/A'} | Age {v.age or 'N/A'}",
            status="active",
            subtitle=(v.contact_number and f"Contact: {v.contact_number}") or (v.address or "No address"),
            meta={"victim_id": str(v.id)},
        ))

    # ── Cases (locations batch-loaded to avoid N+1) ──
    cases = db.query(CrimeCase).filter(
        or_(
            CrimeCase.case_number.ilike(pattern),
            CrimeCase.description.ilike(pattern),
            CrimeCase.mo_tags.ilike(pattern),
        )
    ).limit(limit).all()
    location_ids = [c.location_id for c in cases if c.location_id is not None]
    location_map: dict[str, Location] = {}
    if location_ids:
        for loc in db.query(Location).filter(Location.id.in_(location_ids)).all():
            location_map[str(loc.id)] = loc
    for c in cases:
        location = location_map.get(str(c.location_id)) if c.location_id else None
        district = location.district if location else None
        result.cases.append(SearchItem(
            id=f"case-{c.id}",
            type="case",
            name=c.case_number,
            detail=(c.description or "")[:120],
            status=c.status,
            subtitle=district or "District N/A",
            meta={
                "case_id": str(c.id),
                "district": district,
                "occurred_at": str(c.occurred_at.date()) if c.occurred_at else None,
                "category_id": str(c.category_id),
            },
        ))

    # ── FIRs ──
    firs = db.query(FIR).filter(
        or_(
            FIR.fir_number.ilike(pattern),
            FIR.complainant_name.ilike(pattern),
            FIR.sections.ilike(pattern),
        )
    ).limit(limit).all()
    for f in firs:
        result.firs.append(SearchItem(
            id=f"fir-{f.id}",
            type="fir",
            name=f.fir_number,
            detail=f"Complainant: {f.complainant_name}",
            status=f.status,
            subtitle=f"Sections: {f.sections or 'N/A'} | Case: {f.crime_case_id}",
            meta={"fir_id": str(f.id), "case_id": str(f.crime_case_id)},
        ))

    # ── Locations ──
    locations = db.query(Location).filter(
        or_(
            Location.station.ilike(pattern),
            Location.district.ilike(pattern),
            Location.address.ilike(pattern),
        )
    ).limit(limit).all()
    compact: dict[str, SearchItem] = {}
    for loc in locations:
        key = f"{loc.district}|{loc.station or ''}"
        if key not in compact:
            compact[key] = SearchItem(
                id=f"location-{loc.id}",
                type="location",
                name=f"{loc.station or loc.district}, {loc.district}",
                detail=f"District: {loc.district} | Station: {loc.station or 'N/A'}",
                status="active",
                subtitle="Crime location",
                meta={"location_id": str(loc.id), "district": loc.district, "station": loc.station},
            )
    result.locations = list(compact.values())

    # ── Police stations (deduplicated district/station pairs incl. all) ──
    stations: dict[str, SearchItem] = {}
    station_rows = db.query(Location).filter(Location.station.isnot(None)).limit(200).all()
    for s in station_rows:
        key2 = f"{s.district}|{s.station}"
        if key2 in stations:
            continue
        if (query.lower() in s.station.lower()) or (query.lower() in s.district.lower()):
            stations[key2] = SearchItem(
                id=f"station-{s.id}",
                type="station",
                name=s.station,
                detail=f"Station in {s.district}",
                status="active",
                subtitle=s.district,
                meta={"district": s.district, "station": s.station},
            )
    result.stations = list(stations.values())

    # ── MO semantic matches (role-gated) ──
    result.mo_intelligence = attempt_mo
    if attempt_mo and query:
        try:
            mo = search_similar_mo(db, query, top_k=limit)
            for m in mo.get("results", []):
                if m.get("kind") not in ("criminal", "crime_case", "fir"):
                    continue
                meta = m.get("meta") or {}
                result.mo_matches.append(SearchItem(
                    id=f"mo-{m.get('doc_id')}",
                    type="mo",
                    name=m.get("title") or "MO Match",
                    detail=(m.get("excerpt") or "")[:140],
                    status=m.get("kind"),
                    subtitle=f"Similarity: {m.get('similarity')} | {m.get('kind')}",
                    meta={**meta, "doc_id": m.get("doc_id"), "kind": m.get("kind")},
                ))
        except Exception:
            # Semantic engine may be unavailable; never let it break the search.
            result.mo_matches = []

    result.total = (
        len(result.persons) + len(result.victims) + len(result.cases) + len(result.firs) +
        len(result.locations) + len(result.stations) + len(result.mo_matches)
    )
    return result


class ImageSearchResult(BaseModel):
    status: str  # "unavailable" | "available"
    message: str
    safe_fallback: str
    upload_required: bool = True
    matches: list[Any] = []
    capability: str = "none"


@router.post("/image-search", response_model=ImageSearchResult)
async def image_search(
    current_user: Any = Depends(get_current_user),
):
    """Honest image investigation workflow.

    DRISHYAM does not ship a face-recognition / embedding matching engine and its
    authorized person image dataset is not enabled for reverse matching.  This
    endpoint therefore reports a safe *unavailable* state rather than fabricating
    identity matches.  The UI uses this to guide the officer to identifier search.
    """
    return ImageSearchResult(
        status="unavailable",
        message=(
            "Image/face matching is not currently available for this dataset. "
            "DRISHYAM does not fabricate identity matches."
        ),
        safe_fallback=(
            "Search by name, FIR number, case number, complaint number, "
            "police station, district, location, crime type or MO description instead."
        ),
        upload_required=True,
        capability="none",
    )


# ---------------------------------------------------------------------------
# SIH26189: Command Center intelligence overview
# ---------------------------------------------------------------------------

class IntelligenceOverview(BaseModel):
    """High-level intelligence overview for the SIH26189 command center.

    Every value is derived from stored records; the ``ai_insights`` block is
    rule-based and each entry carries its grounding data.
    """
    entity_counts: dict[str, int] = {}
    active_investigations: int = 0
    recent_cases: list[dict[str, Any]] = []
    high_risk_entities: list[dict[str, Any]] = []
    influential_entities: list[dict[str, Any]] = []
    recent_relationships: list[dict[str, Any]] = []
    network_growth: list[dict[str, Any]] = []
    temporal_activity: list[dict[str, Any]] = []
    hotspot_districts: list[dict[str, Any]] = []
    cross_case_connections: int = 0
    anomalies: list[dict[str, Any]] = []
    suspicious_patterns: list[dict[str, Any]] = []
    ingestion_summary: dict[str, Any] = {}
    ai_insights: list[dict[str, Any]] = []
    generated_at: str = ""
    data_mode: str = ""


@router.get("/intelligence-overview", response_model=IntelligenceOverview)
def intelligence_overview(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Aggregated, fully data-grounded intelligence snapshot (SIH26189 §3)."""
    from datetime import datetime, timedelta

    from sqlalchemy import func as sa_func

    from app.models.intel_entity import (
        EntityRelationship,
        IngestionJob,
        IntelAnomaly,
        Organization,
        PhoneNumber,
        SuspiciousPattern,
        Vehicle,
        IntelEvent,
    )

    now = datetime.utcnow()

    # --- Entity counts ------------------------------------------------------
    entity_counts = {
        "persons": db.query(Criminal).count(),
        "victims": db.query(Victim).count(),
        "organizations": db.query(Organization).count(),
        "vehicles": db.query(Vehicle).count(),
        "phone_numbers": db.query(PhoneNumber).count(),
        "events": db.query(IntelEvent).count(),
        "cases": db.query(CrimeCase).count(),
        "relationships": db.query(EntityRelationship).filter(EntityRelationship.status == "active").count(),
    }

    # --- Active investigations ---------------------------------------------
    active_investigations = db.query(CrimeCase).filter(CrimeCase.status == "under_investigation").count()
    recent_case_rows = (
        db.query(CrimeCase)
        .options(selectinload(CrimeCase.location))
        .filter(CrimeCase.status == "under_investigation")
        .order_by(CrimeCase.created_at.desc())
        .limit(5)
        .all()
    )
    recent_cases = [
        {
            "id": str(c.id),
            "case_number": c.case_number,
            "district": c.location.district if c.location else None,
            "occurred_at": c.occurred_at.isoformat() if c.occurred_at else None,
            "priority": c.priority,
        }
        for c in recent_case_rows
    ]

    # --- High-risk entities (deterministic risk = 45 + 10 * FIR links) ------
    risk_rows = (
        db.query(Criminal, sa_func.count(FIRCriminalLink.fir_id).label("fir_count"))
        .outerjoin(FIRCriminalLink, FIRCriminalLink.criminal_id == Criminal.id)
        .group_by(Criminal.id)
        .order_by(sa_func.count(FIRCriminalLink.fir_id).desc())
        .limit(5)
        .all()
    )
    high_risk_entities = [
        {
            "id": str(criminal.id),
            "name": criminal.full_name,
            "status": criminal.status,
            "fir_count": fir_count,
            "risk_score": min(100.0, 45.0 + fir_count * 10),
        }
        for criminal, fir_count in risk_rows
        if fir_count > 0
    ]

    # --- Influential entities: highest degree in the relationship graph -----
    degree_rows = (
        db.query(
            EntityRelationship.source_type,
            EntityRelationship.source_id,
            sa_func.count(EntityRelationship.id).label("deg"),
        )
        .filter(EntityRelationship.status == "active")
        .group_by(EntityRelationship.source_type, EntityRelationship.source_id)
        .order_by(sa_func.count(EntityRelationship.id).desc())
        .limit(5)
        .all()
    )
    influential_entities = [
        {
            "entity_type": stype,
            "entity_id": str(sid),
            "degree": deg,
            "note": "Degree centrality in the intelligence relationship graph (entities with the most recorded links).",
        }
        for stype, sid, deg in degree_rows
    ]

    # --- Recently discovered relationships ----------------------------------
    rel_rows = db.query(EntityRelationship).filter(EntityRelationship.status == "active").order_by(EntityRelationship.created_at.desc()).limit(8).all()
    recent_relationships = [
        {
            "id": str(r.id),
            "source_type": r.source_type,
            "source_id": str(r.source_id),
            "target_type": r.target_type,
            "target_id": str(r.target_id),
            "relationship_type": r.relationship_type,
            "provenance": r.provenance,
            "confidence": r.confidence,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rel_rows
    ]

    # --- Network growth: new relationships per week (last 6 weeks) ----------
    network_growth = []
    for week_offset in range(5, -1, -1):
        week_start = now - timedelta(days=7 * week_offset + 7)
        week_end = now - timedelta(days=7 * week_offset)
        count = (
            db.query(EntityRelationship)
            .filter(EntityRelationship.created_at >= week_start, EntityRelationship.created_at < week_end)
            .count()
        )
        network_growth.append({
            "week_start": week_start.date().isoformat(),
            "new_relationships": count,
        })

    # --- Temporal activity: FIRs per day (last 14 days) ---------------------
    temporal_activity = []
    for day_offset in range(13, -1, -1):
        day_start = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = db.query(FIR).filter(FIR.filed_at >= day_start, FIR.filed_at < day_end).count()
        temporal_activity.append({"date": day_start.date().isoformat(), "firs": count})

    # --- Geographic hotspots: districts by FIR volume (last 90 days) --------
    hotspot_rows = (
        db.query(Location.district, sa_func.count(FIR.id).label("fir_count"))
        .join(CrimeCase, CrimeCase.location_id == Location.id)
        .join(FIR, FIR.crime_case_id == CrimeCase.id)
        .filter(FIR.filed_at >= now - timedelta(days=90))
        .group_by(Location.district)
        .order_by(sa_func.count(FIR.id).desc())
        .limit(5)
        .all()
    )
    hotspot_districts = [
        {"district": district, "fir_count": count, "window_days": 90}
        for district, count in hotspot_rows
    ]

    # --- Cross-case connections ---------------------------------------------
    cross_rows = (
        db.query(FIRCriminalLink.criminal_id)
        .distinct()
        .group_by(FIRCriminalLink.criminal_id)
        .having(sa_func.count(sa_func.distinct(FIRCriminalLink.fir_id)) >= 2)
        .all()
    )
    cross_case_connections = len(cross_rows)

    # --- Anomalies + suspicious patterns (stored detections) ----------------
    anomaly_rows = (
        db.query(IntelAnomaly)
        .filter(IntelAnomaly.status == "open")
        .order_by(IntelAnomaly.detected_at.desc())
        .limit(5)
        .all()
    )
    anomalies = [
        {
            "id": str(a.id),
            "anomaly_type": a.anomaly_type,
            "title": a.title,
            "severity": a.severity,
            "what_detected": a.what_detected,
            "why_unusual": a.why_unusual,
            "detected_at": a.detected_at.isoformat() if a.detected_at else None,
        }
        for a in anomaly_rows
    ]
    pattern_rows = (
        db.query(SuspiciousPattern)
        .filter(SuspiciousPattern.status == "detected")
        .order_by(SuspiciousPattern.created_at.desc())
        .limit(5)
        .all()
    )
    suspicious_patterns = [
        {
            "id": str(p.id),
            "pattern_type": p.pattern_type,
            "title": p.title,
            "severity": p.severity,
            "confidence": p.confidence,
            "description": (p.description or "")[:240],
        }
        for p in pattern_rows
    ]

    # --- Ingestion status (visible to all roles; raw records are admin-only) -
    job_rows = db.query(IngestionJob.status).all()
    ingestion_counts: dict[str, int] = {}
    for (job_status,) in job_rows:
        ingestion_counts[job_status] = ingestion_counts.get(job_status, 0) + 1
    ingestion_summary = {
        "status_counts": ingestion_counts,
        "total_jobs": len(job_rows),
        "note": "Structured data ingestion is performed by administrators only.",
    }

    # --- Rule-based AI insights (grounded; each carries its basis) ----------
    ai_insights: list[dict[str, Any]] = []
    top_risk = high_risk_entities[0] if high_risk_entities else None
    if top_risk is not None:
        ai_insights.append({
            "id": "cc-insight-risk",
            "label": "AI-generated insight (rule-based)",
            "title": f"Highest-activity person of interest: {top_risk['name']}",
            "detail": (
                f"{top_risk['name']} appears in {top_risk['fir_count']} FIR record(s) "
                f"(risk score {top_risk['risk_score']:.0f}/100). Review the associated network before further escalation."
            ),
            "basis": {"fir_count": top_risk["fir_count"], "source_table": "firs + fir_criminal_links"},
        })
    top_hotspot = hotspot_districts[0] if hotspot_districts else None
    if top_hotspot is not None:
        ai_insights.append({
            "id": "cc-insight-hotspot",
            "label": "AI-generated insight (rule-based)",
            "title": f"Leading geographic hotspot: {top_hotspot['district']}",
            "detail": (
                f"{top_hotspot['district']} recorded {top_hotspot['fir_count']} FIR(s) in the last "
                f"{top_hotspot['window_days']} days, the highest of any district in the current dataset."
            ),
            "basis": {"fir_count": top_hotspot["fir_count"], "window_days": top_hotspot["window_days"], "source_table": "firs + crime_cases + locations"},
        })
    if cross_case_connections > 0:
        ai_insights.append({
            "id": "cc-insight-crosscase",
            "label": "AI-generated insight (rule-based)",
            "title": f"{cross_case_connections} person(s) linked across multiple cases",
            "detail": (
                f"{cross_case_connections} person(s) appear in 2 or more distinct FIR records — "
                "candidates for cross-case relationship analysis on the Network page."
            ),
            "basis": {"cross_case_persons": cross_case_connections, "source_table": "fir_criminal_links"},
        })
    growth_delta = network_growth[-1]["new_relationships"] - network_growth[-2]["new_relationships"] if len(network_growth) >= 2 else 0
    if growth_delta > 0:
        ai_insights.append({
            "id": "cc-insight-growth",
            "label": "AI-generated insight (rule-based)",
            "title": "Relationship graph is growing",
            "detail": (
                f"{network_growth[-1]['new_relationships']} new relationship(s) were recorded in the latest week, "
                f"{growth_delta} more than the previous week. Rising connectivity can precede coordinated activity."
            ),
            "basis": {"latest_week": network_growth[-1], "previous_week": network_growth[-2], "source_table": "entity_relationships"},
        })

    from app.core.data_mode import get_data_mode

    return IntelligenceOverview(
        entity_counts=entity_counts,
        active_investigations=active_investigations,
        recent_cases=recent_cases,
        high_risk_entities=high_risk_entities,
        influential_entities=influential_entities,
        recent_relationships=recent_relationships,
        network_growth=network_growth,
        temporal_activity=temporal_activity,
        hotspot_districts=hotspot_districts,
        cross_case_connections=cross_case_connections,
        anomalies=anomalies,
        suspicious_patterns=suspicious_patterns,
        ingestion_summary=ingestion_summary,
        ai_insights=ai_insights,
        generated_at=now.isoformat(),
        data_mode=str(get_data_mode()),
    )
