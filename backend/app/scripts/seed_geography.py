"""Seed canonical Indian States, Districts, and Police Stations.

Populates states, districts, and police_stations tables from app.data.geography_seed,
and links existing Karnataka locations with their appropriate state_id and district_id.
"""
import sys
from app.database.postgres import SessionLocal
from app.models.geography import State, District, PoliceStation
from app.models.location import Location
from app.data.geography_seed import INDIAN_STATES, DISTRICTS_AND_STATIONS


def seed_geography():
    db = SessionLocal()
    try:
        print("Seeding Indian States & Union Territories...")
        existing_states = {s.state_code: s for s in db.query(State).all()}
        state_objs = {}
        for item in INDIAN_STATES:
            code = item["code"]
            state = existing_states.get(code)
            if not state:
                state = State(
                    state_code=code,
                    state_name=item["name"],
                    state_type=item.get("type", "state"),
                )
                db.add(state)
                db.flush()
                existing_states[code] = state
            state_objs[code] = state
        print(f"Total states/UTs available: {len(state_objs)}")

        print("Seeding Districts and Police Stations...")
        existing_districts = {d.district_code: d for d in db.query(District).all()}
        existing_stations = {ps.station_code: ps for ps in db.query(PoliceStation).all()}
        
        district_count = 0
        station_count = 0

        for state_code, districts in DISTRICTS_AND_STATIONS.items():
            state = state_objs.get(state_code)
            if not state:
                continue

            for dist_data in districts:
                d_code = dist_data["code"]
                district = existing_districts.get(d_code)
                if not district:
                    district = District(
                        state_id=state.id,
                        district_code=d_code,
                        district_name=dist_data["name"],
                    )
                    db.add(district)
                    db.flush()
                    existing_districts[d_code] = district
                    district_count += 1

                for st_data in dist_data.get("stations", []):
                    st_code = st_data["code"]
                    station = existing_stations.get(st_code)
                    if not station:
                        station = PoliceStation(
                            district_id=district.id,
                            station_code=st_code,
                            station_name=st_data["name"],
                            latitude=float(st_data.get("lat", 0.0)),
                            longitude=float(st_data.get("lon", 0.0)),
                        )
                        db.add(station)
                        existing_stations[st_code] = station
                        station_count += 1

        db.flush()
        print(f"Added {district_count} new districts, {station_count} new police stations.")

        # Link existing Karnataka locations
        print("Linking existing locations to State and District...")
        ka_state = state_objs.get("KA")
        if ka_state:
            districts_by_name = {
                d.district_name.lower(): d
                for d in db.query(District).filter(District.state_id == ka_state.id).all()
            }
            locations = db.query(Location).all()
            updated_locs = 0
            for loc in locations:
                changed = False
                if not loc.state:
                    loc.state = "Karnataka"
                    changed = True
                if not loc.state_id:
                    loc.state_id = ka_state.id
                    changed = True
                if loc.district and not loc.district_id:
                    matched_d = districts_by_name.get(loc.district.strip().lower())
                    if matched_d:
                        loc.district_id = matched_d.id
                        changed = True
                if changed:
                    updated_locs += 1

            print(f"Updated {updated_locs} locations with Karnataka state & district references.")

        db.commit()
        print("Geographical hierarchy seeding complete!")

    except Exception as exc:
        db.rollback()
        print(f"Error seeding geography: {exc}")
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed_geography()
