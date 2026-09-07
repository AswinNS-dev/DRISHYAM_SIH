"""SIH26189: hidden multi-hop network discovery + real graph metrics tests."""
import pytest

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from datetime import datetime

from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink
from app.models.location import Location
from app.models.role import Role
from app.models.user import User

NET = "/api/v2/network"


@pytest.fixture
def chain_client(client, db_session):
    """A -> B -> C -> D co-accused chain via three FIRs; A and D share nothing."""
    role = Role(name="admin", description="Administrator")
    db_session.add(role)
    db_session.flush()
    user = User(
        username="net-admin",
        email="net-admin@example.com",
        full_name="Net Admin",
        hashed_password=hash_password("Password123!"),
        role_id=role.id,
        is_active=True,
    )
    db_session.add(user)
    category = CrimeCategory(name="Theft", section_code="IPC 379", severity="medium")
    location = Location(district="Test District", station="Test Station", latitude=13.0, longitude=77.5)
    db_session.add_all([category, location])
    db_session.flush()

    criminals = {}
    for name in ("Alpha Rao", "Beta Singh", "Gamma Rao", "Das Rao"):
        c = Criminal(
            full_name=name,
            aliases="",
            gender="Male",
            status="at_large",
        )
        db_session.add(c)
        criminals[name] = c
    db_session.flush()

    hops = [("Alpha Rao", "Beta Singh"), ("Beta Singh", "Gamma Rao"), ("Gamma Rao", "Das Rao")]
    for i, (name_a, name_b) in enumerate(hops, start=1):
        case = CrimeCase(
            case_number=f"CR-2026-HN-{i:03d}",
            category_id=category.id,
            location_id=location.id,
            occurred_at=datetime(2026, 1, i),
            status="under_investigation",
            priority="medium",
        )
        db_session.add(case)
        db_session.flush()
        fir = FIR(
            fir_number=f"FIR-2026-HN-{i:03d}",
            crime_case_id=case.id,
            complainant_name="Complainer",
            sections="IPC 379",
            status="open",
        )
        db_session.add(fir)
        db_session.flush()
        db_session.add_all([
            FIRCriminalLink(fir_id=fir.id, criminal_id=criminals[name_a].id, role="accused"),
            FIRCriminalLink(fir_id=fir.id, criminal_id=criminals[name_b].id, role="accused"),
        ])
    db_session.commit()

    client.app.dependency_overrides[get_current_user] = lambda: user
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


def test_hidden_network_discovers_2hop(chain_client):
    """A and C share no FIR but are connected via B: 2-hop indirect connection."""
    r = chain_client.get(f"{NET}/hidden-networks?min_hops=2&max_hops=2")
    assert r.status_code == 200, r.text
    body = r.json()
    pairs = {(c["source"]["name"], c["target"]["name"]) for c in body["connections"]}
    assert ("Alpha Rao", "Gamma Rao") in pairs or ("Gamma Rao", "Alpha Rao") in pairs
    conn = next(c for c in body["connections"] if {c["source"]["name"], c["target"]["name"]} == {"Alpha Rao", "Gamma Rao"})
    assert conn["hops"] == 2
    assert "indirect" in conn["label"].lower()
    assert conn["connection_status"] == "POTENTIAL"
    assert len(conn["intermediates"]) == 1
    assert conn["intermediates"][0]["name"] == "Beta Singh"
    assert conn["hop_evidence"], "evidence chain must be present"


def test_hidden_network_discovers_3hop(chain_client):
    """A and D are connected only via B and C: 3-hop indirect connection."""
    r = chain_client.get(f"{NET}/hidden-networks?min_hops=3&max_hops=3")
    assert r.status_code == 200, r.text
    body = r.json()
    pairs = {(c["source"]["name"], c["target"]["name"]) for c in body["connections"]}
    assert ("Alpha Rao", "Das Rao") in pairs or ("Das Rao", "Alpha Rao") in pairs
    conn = next(c for c in body["connections"] if {c["source"]["name"], c["target"]["name"]} == {"Alpha Rao", "Das Rao"})
    assert conn["hops"] == 3
    assert {i["name"] for i in conn["intermediates"]} == {"Beta Singh", "Gamma Rao"}


def test_hidden_network_excludes_direct_pairs(chain_client):
    """Directly connected entities must never be surfaced as hidden connections."""
    r = chain_client.get(f"{NET}/hidden-networks?min_hops=2&max_hops=3")
    body = r.json()
    direct_pairs = {("Alpha Rao", "Beta Singh"), ("Beta Singh", "Gamma Rao"), ("Gamma Rao", "Das Rao")}
    for conn in body["connections"]:
        pair = {conn["source"]["name"], conn["target"]["name"]}
        assert pair not in direct_pairs


def test_link_analysis_has_real_metrics(chain_client):
    """Betweenness/closeness/pagerank must be present and sane."""
    r = chain_client.post(f"{NET}/link-analysis")
    assert r.status_code == 200, r.text
    body = r.json()
    names = {n["node_name"]: n for n in body["high_impact_nodes"]}
    assert "Alpha Rao" in names
    top = names["Alpha Rao"]
    assert top["pagerank_score"] > 0
    assert "closeness_centrality" in top
    assert top["betweenness_score"] >= 0
