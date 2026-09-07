"""SIH26189: command-center intelligence overview endpoint test."""
import pytest

from datetime import datetime

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.intel_entity import EntityRelationship, Organization
from app.models.location import Location
from app.models.role import Role
from app.models.user import User

HUB = "/api/v2/investigation-hub"


@pytest.fixture
def overview_client(client, db_session):
    role = Role(name="admin", description="Administrator")
    db_session.add(role)
    db_session.flush()
    user = User(
        username="cc-admin",
        email="cc-admin@example.com",
        full_name="CC Admin",
        hashed_password=hash_password("Password123!"),
        role_id=role.id,
        is_active=True,
    )
    db_session.add(user)
    location = Location(district="Overview District", station="Overview Station", latitude=13.0, longitude=77.5)
    org = Organization(name="Overview Syndicate")
    category = CrimeCategory(name="Overview Category", section_code="IPC 1", severity="low")
    db_session.add_all([location, org, category])
    db_session.flush()
    person = Criminal(full_name="Overview Person", aliases="", gender="Male", status="at_large")
    case = CrimeCase(
        case_number="CR-2026-OV-001",
        category_id=category.id,
        location_id=location.id,
        occurred_at=datetime(2026, 2, 1),
        status="under_investigation",
        priority="high",
    )
    db_session.add_all([person, case])
    db_session.flush()
    db_session.add(EntityRelationship(
        source_type="person",
        source_id=person.id,
        target_type="organization",
        target_id=org.id,
        relationship_type="member_of",
        provenance="DIRECT_RECORD",
    ))
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


def test_intelligence_overview_grounded(overview_client):
    r = overview_client.get(f"{HUB}/intelligence-overview")
    assert r.status_code == 200, r.text
    body = r.json()
    # Counts reflect the rows created in the fixture (plus any seed rows).
    assert body["entity_counts"]["organizations"] >= 1
    assert body["entity_counts"]["relationships"] >= 1
    assert body["active_investigations"] >= 1
    assert any(c["case_number"] == "CR-2026-OV-001" for c in body["recent_cases"])
    # AI insights are labelled as rule-based and carry grounding.
    for insight in body["ai_insights"]:
        assert "rule-based" in insight["label"]
        assert "basis" in insight
    assert body["generated_at"]
    assert len(body["network_growth"]) == 6
    assert len(body["temporal_activity"]) == 14
