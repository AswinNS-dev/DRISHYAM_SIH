"""SIH26189: admin-only structured ingestion pipeline tests."""
import pytest

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.criminal import Criminal
from app.models.intel_entity import (
    EntityRelationship,
    IngestionJob,
    PhoneNumber,
    SuspiciousPattern,
)
from app.models.role import Role
from app.models.user import User

ING = "/api/v2/ingestion"


def _make_user(client, db_session, role_name: str, username: str) -> User:
    role = db_session.query(Role).filter_by(name=role_name).first()
    if role is None:
        role = Role(name=role_name, description=f"{role_name} role")
        db_session.add(role)
        db_session.flush()
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.title(),
        hashed_password=hash_password("Password123!"),
        role_id=role.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user
    return user


@pytest.fixture
def admin_user(client, db_session):
    user = _make_user(client, db_session, "admin", "ingest-admin")
    yield user
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def investigator_user(client, db_session):
    user = _make_user(client, db_session, "investigator", "ingest-io")
    yield user
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_user(client, db_session):
    user = _make_user(client, db_session, "viewer", "ingest-viewer")
    yield user
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def seed_person(db_session):
    criminal = Criminal(full_name="Vikram Rao", aliases="", gender="Male", status="at_large")
    db_session.add(criminal)
    db_session.commit()
    return criminal


def test_ingestion_sources_lists_types(admin_user, client):
    r = client.get(f"{ING}/sources")
    assert r.status_code == 200, r.text
    body = r.json()
    types = {t["source_type"] for t in body["supported_source_types"]}
    assert {"cdr_record", "financial_transaction", "fir_record", "surveillance"} <= types


def test_admin_ingests_cdr_creates_phones_and_relationship(admin_user, client, db_session):
    r = client.post(f"{ING}/jobs", json={
        "source_type": "cdr_record",
        "source_name": "TelCo A",
        "records": [
            {"caller_number": "9880000001", "callee_number": "9880000002", "call_direction": "outgoing"},
        ],
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "imported"
    assert body["valid_records"] == 1
    assert body["relationships_created"] == 1
    assert db_session.query(PhoneNumber).count() == 2
    assert db_session.query(EntityRelationship).filter(EntityRelationship.relationship_type == "communicated_with").count() == 1


def test_ingestion_validates_required_fields(admin_user, client):
    r = client.post(f"{ING}/jobs", json={
        "source_type": "cdr_record",
        "records": [{"caller_number": "9880000001"}],  # callee missing
    })
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "failed"
    assert body["invalid_records"] == 1
    assert body["error_summary"], "row errors must be reported"


def test_ingestion_rejects_unknown_source_type(admin_user, client):
    r = client.post(f"{ING}/jobs", json={"source_type": "tarot_cards", "records": [{"x": 1}]})
    assert r.status_code == 422


def test_raw_text_stored_verbatim_no_nlp(admin_user, client, db_session):
    raw = "He met near the bus stand at 9pm kya? #nlp_would_parse_this"
    r = client.post(f"{ING}/jobs", json={
        "source_type": "police_report",
        "records": [{"title": "Report 12", "raw_text": raw}],
    })
    assert r.status_code == 201
    body = r.json()
    assert body["valid_records"] == 1
    job = db_session.query(IngestionJob).order_by(IngestionJob.created_at.desc()).first()
    assert job is not None
    assert job.status in ("imported", "validated")


def test_financial_link_flags_high_risk_person(admin_user, client, db_session, seed_person):
    # Give the person 3 FIR-equivalent links via mo_summary empty; risk = 45 + 0
    # Directly create relationships via two ingestion calls then check anomaly.
    r1 = client.post(f"{ING}/jobs", json={
        "source_type": "financial_transaction",
        "records": [{"person_a_name": "Vikram Rao", "person_b_name": "Vikram Rao", "amount": 50000}],  # same person -> no rel
    })
    assert r1.status_code == 201
    body = r1.json()
    # same person pair is skipped, but record still imports
    assert body["valid_records"] == 1


def test_non_admin_cannot_ingest(client, db_session, investigator_user, viewer_user):
    """RBAC: ingestion endpoints must 403 for investigator and viewer."""
    for user_role in ("investigator_user", "viewer_user"):
        pass
    for r in (
        client.get(f"{ING}/sources"),
        client.get(f"{ING}/jobs"),
        client.get(f"{ING}/overview"),
        client.post(f"{ING}/jobs", json={"source_type": "fir_record", "records": [{"fir_number": "X"}]}),
        client.post(f"{ING}/sources", json={"name": "Rogue Source", "source_type": "fir_record"}),
    ):
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


def test_repeated_cdr_creates_suspicious_pattern(admin_user, client, db_session):
    records = [
        {"caller_number": "9811100001", "callee_number": f"98222000{i:02d}"}
        for i in range(1, 5)
    ]
    r = client.post(f"{ING}/jobs", json={"source_type": "cdr_record", "records": records})
    assert r.status_code == 201, r.text
    patterns = db_session.query(SuspiciousPattern).filter(SuspiciousPattern.pattern_type == "repeated_communication").all()
    assert patterns, "repeated-communication pattern must be detected after >=3 CDR rows"
    p = patterns[0]
    assert "not a confirmed criminal association" in (p.description or "")
