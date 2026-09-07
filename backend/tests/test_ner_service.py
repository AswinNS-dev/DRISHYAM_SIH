"""Tests for Assistive NER service, conservative matching, geography hierarchy, and review endpoints."""
import pytest
from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User
from app.models.geography import State, District, PoliceStation
from app.models.criminal import Criminal
from app.models.intel_entity import Vehicle, PhoneNumber, IngestionRecord
from app.models.ner import NERExtraction
from app.services.ner_service import (
    extract_entities_from_text,
    perform_conservative_matching,
    process_record_ner,
)


def _role(db_session, name: str) -> Role:
    role = db_session.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=name.title())
        db_session.add(role)
        db_session.flush()
    return role


def _make_user(db_session, username: str, role_name: str = "admin") -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.replace("-", " ").title(),
        hashed_password=hash_password("Password123!"),
        role_id=_role(db_session, role_name).id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def admin_user(db_session):
    return _make_user(db_session, "admin-ner", "admin")


@pytest.fixture
def viewer_user(db_session):
    return _make_user(db_session, "viewer-ner", "viewer")


# ---------------------------------------------------------------------------
# Unit tests: Extraction & Conservative Matching
# ---------------------------------------------------------------------------

def test_extract_entities_structural_priority():
    """Verify that domain regex extractors run first so vehicle registrations and phones are preserved."""
    sample_text = (
        "Intercepted consignment vehicle KA-09-CD-7717 and MH-12-AB-4521 near Electronic City. "
        "Driver contact: +91-98450-12345. Seized Rs. 4,50,000 cash under FIR-2025-0891."
    )
    entities = extract_entities_from_text(sample_text)
    types_found = {e["entity_type"] for e in entities}
    texts_found = {e["entity_text"] for e in entities}

    # Must extract structural domain entities
    assert "VEHICLE" in types_found
    assert "KA-09-CD-7717" in texts_found
    assert "MH-12-AB-4521" in texts_found
    assert "PHONE" in types_found
    assert "+91-98450-12345" in texts_found
    assert "MONEY" in types_found
    assert "FIR_NO" in types_found
    assert "FIR-2025-0891" in texts_found


def test_conservative_matching_leads_only(db_session):
    """Conservative matching resolves known DB entities and labels leads as assistive only."""
    # Seed a known criminal and vehicle
    crim = Criminal(full_name="Rajesh Patil", status="at_large")
    veh = Vehicle(registration_number="KA-09-CD-7717", make="Tata", model="Ace", status="flagged")
    phone = PhoneNumber(number="+91-98450-12345", carrier="Airtel", status="active")
    db_session.add_all([crim, veh, phone])
    db_session.commit()

    sample_extractions = [
        {"entity_type": "PERSON", "entity_text": "Rajesh Patil", "start_offset": 0, "end_offset": 12, "confidence": 0.90, "engine": "spacy"},
        {"entity_type": "VEHICLE", "entity_text": "KA-09-CD-7717", "start_offset": 20, "end_offset": 33, "confidence": 0.95, "engine": "structural_regex"},
        {"entity_type": "PHONE", "entity_text": "+91-98450-12345", "start_offset": 40, "end_offset": 55, "confidence": 0.95, "engine": "structural_regex"},
        {"entity_type": "PERSON", "entity_text": "Unknown Bystander", "start_offset": 60, "end_offset": 77, "confidence": 0.70, "engine": "spacy"},
    ]

    matched = [perform_conservative_matching(db_session, ext) for ext in sample_extractions]
    
    # Rajesh Patil should be matched
    matched_crim = next((m for m in matched if m["entity_text"] == "Rajesh Patil"), None)
    assert matched_crim is not None
    assert matched_crim["match_status"] == "matched_criminal"
    assert matched_crim["matched_entity_type"] == "criminal"
    assert matched_crim["matched_entity_id"] == crim.id

    # KA-09-CD-7717 should be matched
    matched_veh = next((m for m in matched if m["entity_text"] == "KA-09-CD-7717"), None)
    assert matched_veh is not None
    assert matched_veh["match_status"] == "matched_vehicle"
    assert matched_veh["matched_entity_type"] == "vehicle"
    assert matched_veh["matched_entity_id"] == veh.id

    # Unknown bystander should NOT match
    matched_unknown = next((m for m in matched if m["entity_text"] == "Unknown Bystander"), None)
    assert matched_unknown is not None
    assert matched_unknown["match_status"] == "unmatched"
    assert matched_unknown.get("matched_entity_id") is None


def test_process_record_ner_creates_assistive_candidate_leads(db_session):
    """Verify process_record_ner never auto-accuses: sets confidence <= 0.50 and status='under_review'."""
    crim_a = Criminal(full_name="Vikram Rao", status="at_large")
    crim_b = Criminal(full_name="Sunil Shetty", status="at_large")
    db_session.add_all([crim_a, crim_b])
    db_session.flush()

    raw_rec = IngestionRecord(
        source_type="police_report",
        title="Field Intercept Lead",
        raw_text="Field officers observed Vikram Rao meeting Sunil Shetty at the warehouse dock.",
        processing_status="raw",
    )
    db_session.add(raw_rec)
    db_session.commit()

    saved_rows = process_record_ner(db_session, raw_rec)
    assert len(saved_rows) >= 2
    assert raw_rec.processing_status == "nlp_processed"

    # Check candidate leads generated in entity_relationships
    from app.models.intel_entity import EntityRelationship
    leads = db_session.query(EntityRelationship).filter(
        EntityRelationship.provenance == "NER_EXTRACTED"
    ).all()
    
    assert len(leads) >= 1
    for lead in leads:
        assert lead.confidence <= 0.50
        assert lead.status == "under_review"
        assert "candidate lead" in (lead.evidence_records or "").lower()


# ---------------------------------------------------------------------------
# API integration tests: Geography hierarchy & NER endpoints
# ---------------------------------------------------------------------------

def test_geography_hierarchy_endpoints(client, db_session, admin_user):
    """Test state -> district -> police station cascading API endpoints."""
    client.app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        # Seed a test State, District, and Station
        st = State(state_code="TS", state_name="Telangana", state_type="state")
        db_session.add(st)
        db_session.flush()

        dist = District(state_id=st.id, district_code="HYD", district_name="Hyderabad")
        db_session.add(dist)
        db_session.flush()

        station = PoliceStation(
            district_id=dist.id,
            station_code="HYD_CYB",
            station_name="Cyberabad Station",
            latitude=17.4399,
            longitude=78.3908,
        )
        db_session.add(station)
        db_session.commit()

        # 1. Get states
        res_states = client.get("/api/v2/geography/states")
        assert res_states.status_code == 200
        states_data = res_states.json()
        assert any(s["state_code"] == "TS" for s in states_data)

        # 2. Get districts for state
        res_dist = client.get(f"/api/v2/geography/states/{st.id}/districts")
        assert res_dist.status_code == 200
        assert len(res_dist.json()) >= 1
        assert res_dist.json()[0]["district_name"] == "Hyderabad"

        # 3. Get stations for district
        res_stations = client.get(f"/api/v2/geography/districts/{dist.id}/stations")
        assert res_stations.status_code == 200
        assert len(res_stations.json()) >= 1
        assert res_stations.json()[0]["station_name"] == "Cyberabad Station"
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_ner_review_audit_and_rbac(client, db_session, admin_user, viewer_user):
    """Test NER extraction human review: viewer cannot review, admin decision is audited."""
    # Seed a raw record and an extraction
    rec = IngestionRecord(source_type="field_note", raw_text="Spotted suspect", processing_status="processed")
    db_session.add(rec)
    db_session.flush()

    ext = NERExtraction(
        record_id=rec.id,
        entity_type="PERSON",
        entity_text="Test Suspect",
        start_offset=0,
        end_offset=12,
        confidence=0.85,
        engine="spacy",
        review_status="pending",
    )
    db_session.add(ext)
    db_session.commit()

    # 1. Viewer attempt to review -> 403 Forbidden
    client.app.dependency_overrides[get_current_user] = lambda: viewer_user
    res_viewer = client.post(f"/api/v2/ner/extractions/{ext.id}/review", json={"decision": "confirmed"})
    assert res_viewer.status_code == 403

    # 2. Admin review -> 200 OK and status confirmed
    client.app.dependency_overrides[get_current_user] = lambda: admin_user
    res_admin = client.post(f"/api/v2/ner/extractions/{ext.id}/review", json={"decision": "confirmed", "note": "Verified by IO"})
    assert res_admin.status_code == 200
    assert res_admin.json()["review_status"] == "confirmed"

    # Verify DB update
    db_session.refresh(ext)
    assert ext.review_status == "confirmed"
    assert ext.review_note == "Verified by IO"
    client.app.dependency_overrides.pop(get_current_user, None)
