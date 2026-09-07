"""Generate & import multi-state synthetic investigation data for DRISHYAM.

Enriches Supabase with realistic cross-state criminal syndicates, cases, FIRs,
entities (vehicles, phones, organizations, events), entity relationships,
and raw ingested reports (including CID-32-01).
Exports CSV copies into backend/data/synthetic/.
"""
import os
import csv
import uuid
from datetime import datetime, timedelta, timezone
from app.database.postgres import SessionLocal
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.criminal import Criminal
from app.models.victim import Victim
from app.models.evidence import Evidence
from app.models.chain_of_custody import ChainOfCustody
from app.models.location import Location
from app.models.geography import State, District, PoliceStation
from app.models.intel_entity import Organization, Vehicle, PhoneNumber, IntelEvent, EntityRelationship, IngestionRecord

_SEED_PROVENANCE = "demo"


def seed_multistate():
    db = SessionLocal()
    os.makedirs("data/synthetic", exist_ok=True)
    try:
        print("Fetching states and categories...")
        states_by_code = {s.state_code: s for s in db.query(State).all()}
        districts_by_code = {d.district_code: d for d in db.query(District).all()}
        stations_by_code = {ps.station_code: ps for ps in db.query(PoliceStation).all()}
        
        categories = {c.name: c for c in db.query(CrimeCategory).all()}
        # Fallback category if not found
        default_cat = list(categories.values())[0] if categories else None
        cyber_cat = categories.get("Cyber Crime & Online Fraud", default_cat)
        smuggling_cat = categories.get("Smuggling & Excise Violations", default_cat)
        narcotics_cat = categories.get("Narcotics Smuggling Services", default_cat)
        theft_cat = categories.get("Theft & Burglaries", default_cat)

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # -------------------------------------------------------------
        # 1. LOCATIONS IN TARGET STATES
        # -------------------------------------------------------------
        print("Creating locations in target States...")
        loc_specs = [
            # TN
            ("Hosur Industrial Complex", "Krishnagiri", "Tamil Nadu", "TN", "TN-KRI", "TN-KRI-01", 12.7409, 77.8253, "635126"),
            ("Chennai Port Terminal", "Chennai", "Tamil Nadu", "TN", "TN-CHN", "TN-CHN-01", 13.0827, 80.2707, "600001"),
            # MH
            ("Bandra Kurla Complex", "Mumbai City", "Maharashtra", "MH", "MH-MUM", "MH-MUM-01", 19.0657, 72.8687, "400051"),
            ("Pune Logistics Hub", "Pune", "Maharashtra", "MH", "MH-PUN", "MH-PUN-01", 18.5204, 73.8567, "411001"),
            ("Kolhapur Transit Checkpost", "Kolhapur", "Maharashtra", "MH", "MH-KOL", "MH-KOL-01", 16.7050, 74.2433, "416001"),
            # DL
            ("Mandir Marg Cyber Node", "New Delhi", "Delhi", "DL", "DL-NDL", "DL-NDL-01", 28.6139, 77.2090, "110001"),
            ("Connaught Place Financial Block", "Central Delhi", "Delhi", "DL", "DL-CDL", "DL-CDL-01", 28.6315, 77.2167, "110001"),
            # TS
            ("Cyberabad Tech Corridor", "Hyderabad", "Telangana", "TS", "TS-HYD", "TS-HYD-01", 17.4435, 78.3772, "500081"),
            ("Secunderabad Railway Terminal", "Hyderabad", "Telangana", "TS", "TS-HYD", "TS-HYD-02", 17.4399, 78.4983, "500003"),
            # GJ
            ("Navrangpura Business Center", "Ahmedabad", "Gujarat", "GJ", "GJ-AHM", "GJ-AHM-01", 23.0365, 72.5611, "380009"),
            ("Surat Diamond Market Hub", "Surat", "Gujarat", "GJ", "GJ-SUR", "GJ-SUR-01", 21.1702, 72.8311, "395003"),
            # AP
            ("Governorpet Commercial Zone", "NTR (Vijayawada)", "Andhra Pradesh", "AP", "AP-NTR", "AP-NTR-01", 16.5062, 80.6480, "520002"),
            ("Visakhapatnam Harbor Yard", "Visakhapatnam", "Andhra Pradesh", "AP", "AP-VSK", "AP-VSK-01", 17.6868, 83.2185, "530001"),
            # KA interstate nodes
            ("Electronic City Toll Plaza", "Bengaluru Urban", "Karnataka", "KA", "KA-BLU", "KA-BLU-04", 12.8452, 77.6602, "560100"),
            ("Belagavi Camp Border Gate", "Belagavi", "Karnataka", "KA", "KA-BEL", "KA-BEL-01", 15.8625, 74.5050, "590006"),
            # WB
            ("Park Street Commercial Beat", "Kolkata", "West Bengal", "WB", "WB-KOL", "WB-KOL-01", 22.5526, 88.3527, "700016"),
            # RJ
            ("Jaipur Sindhi Camp Station", "Jaipur", "Rajasthan", "RJ", "RJ-JAI", "RJ-JAI-01", 26.9221, 75.8010, "302001"),
        ]

        locations = {}
        existing_locs = {l.address: l for l in db.query(Location).all()}
        for name, district, state_name, st_code, dist_code, ps_code, lat, lon, pin in loc_specs:
            loc = existing_locs.get(name)
            st_obj = states_by_code.get(st_code)
            dist_obj = districts_by_code.get(dist_code)
            ps_obj = stations_by_code.get(ps_code)
            if not loc:
                loc = Location(
                    address=name,
                    district=district,
                    state=state_name,
                    state_id=st_obj.id if st_obj else None,
                    district_id=dist_obj.id if dist_obj else None,
                    police_station_id=ps_obj.id if ps_obj else None,
                    latitude=lat,
                    longitude=lon,
                    pincode=pin,
                    dataset_provenance=_SEED_PROVENANCE,
                )
                db.add(loc)
                db.flush()
                existing_locs[name] = loc
            locations[name] = loc

        # -------------------------------------------------------------
        # 2. ORGANIZATIONS (SYNDICATES & SHELL COMPANIES)
        # -------------------------------------------------------------
        print("Seeding Organizations...")
        org_data = [
            ("Vanguard Logistics Ltd", "front_business", "Interstate freight carrier fronting illicit transit consignments", "G-12, Hosur Industrial Complex", "Krishnagiri", 0.88),
            ("FinTech Global Solutions", "syndicate", "Cyber fraud syndicate running mule accounts, crypto laundering and fake loans", "Tower B, Cyberabad Tech Corridor", "Hyderabad", 0.94),
            ("Apex Warehousing", "front_business", "Bonded warehouse operation used for contraband staging and Hawala clearing", "Plot 44, Pune Logistics Hub", "Pune", 0.82),
            ("Delta Import-Export Corp", "company", "Cross-border shell entity facilitating forged trade bills and GST evasion", "Port Trust Road, Chennai", "Chennai", 0.76),
        ]
        orgs = {}
        existing_orgs = {o.name: o for o in db.query(Organization).all()}
        for name, otype, desc, addr, dist, risk in org_data:
            org = existing_orgs.get(name)
            if not org:
                org = Organization(
                    name=name,
                    org_type=otype,
                    description=desc,
                    address=addr,
                    district=dist,
                    risk_score=risk,
                    status="active",
                    is_demo_derived=True,
                )
                db.add(org)
                db.flush()
                existing_orgs[name] = org
            orgs[name] = org

        # -------------------------------------------------------------
        # 3. VEHICLES
        # -------------------------------------------------------------
        print("Seeding Vehicles...")
        veh_data = [
            ("KA-09-CD-7717", "truck", "Tata", "LPT 1613", "Dark Grey", "wanted", "Consignment carrier flagged at Attibele-Hosur border; driver Suresh Verma"),
            ("MH-12-AB-4521", "car", "Toyota", "Innova Crysta", "Silver", "wanted", "Escort vehicle linked to Vikram Malhotra; seen crossing Maharashtra border"),
            ("TN-01-XY-9988", "container", "Ashok Leyland", "Tusker", "Blue", "seized", "Seized at Chennai Port terminal with misdeclared cargo"),
            ("DL-01-CY-1001", "car", "Honda", "City", "White", "wanted", "Observed near Mandir Marg cyber hub during cash pick-up"),
            ("TS-09-ZZ-4040", "suv", "Mahindra", "Scorpio-N", "Black", "wanted", "Syndicate transport for cyber mule handlers in Cyberabad"),
            ("GJ-01-MM-8899", "car", "Hyundai", "Creta", "Red", "normal", "Registered under Deepa Patel; multiple Ahmedabad-Surat transit pings"),
            ("AP-16-TX-3344", "truck", "Eicher", "Pro 2049", "Yellow", "normal", "Transit vehicle used for Vijayawada-Belagavi contraband staging"),
            ("MH-09-CQ-6611", "van", "Force", "Traveller", "White", "wanted", "Monitored on Kolhapur-Belagavi NH4 corridor"),
        ]
        vehicles = {}
        existing_vehs = {v.registration_number: v for v in db.query(Vehicle).all()}
        for reg, vtype, make, model, col, status, notes in veh_data:
            veh = existing_vehs.get(reg)
            if not veh:
                veh = Vehicle(
                    registration_number=reg,
                    vehicle_type=vtype,
                    make=make,
                    model=model,
                    color=col,
                    status=status,
                    notes=notes,
                    is_demo_derived=True,
                )
                db.add(veh)
                db.flush()
                existing_vehs[reg] = veh
            vehicles[reg] = veh

        # -------------------------------------------------------------
        # 4. PHONE NUMBERS
        # -------------------------------------------------------------
        print("Seeding Phone Numbers...")
        phone_data = [
            ("+91-98450-12345", "Airtel", "Suresh Verma", "active"),
            ("+91-98200-98765", "Vodafone", "Vikram Malhotra", "active"),
            ("+91-91111-22222", "Jio", "Amit Shah", "surveilled"),
            ("+91-94444-55555", "Airtel", "Rahul Sharma", "active"),
            ("+91-98980-12121", "Vodafone", "Deepa Patel", "active"),
            ("+91-98888-77777", "Jio", "Salim Khan", "surveilled"),
            ("+91-97777-66666", "Airtel", "Venkat Reddy", "active"),
            ("+91-96666-55555", "BSNL", "Prakash Jadhav", "active"),
        ]
        phones = {}
        existing_phones = {p.number: p for p in db.query(PhoneNumber).all()}
        for num, carrier, reg_name, status in phone_data:
            phone = existing_phones.get(num)
            if not phone:
                phone = PhoneNumber(
                    number=num,
                    carrier=carrier,
                    registered_name=reg_name,
                    status=status,
                    is_demo_derived=True,
                )
                db.add(phone)
                db.flush()
                existing_phones[num] = phone
            phones[num] = phone

        # -------------------------------------------------------------
        # 5. CRIMINALS (CROSS-STATE SYNDICATES)
        # -------------------------------------------------------------
        print("Seeding Cross-State Criminals...")
        criminal_data = [
            # Scenario 1: Smuggling
            ("Suresh Verma", "Surya, SV", datetime(1986, 4, 15).date(), "Male", "Scar on right forearm", "Interstate transport coordinator; operates freight consignments across KA-TN-MH corridors.", "at_large", "Vanguard Smuggling Syndicate"),
            ("Vikram Malhotra", "Vicky Mumbai, VM", datetime(1982, 11, 28).date(), "Male", "Tattoo of scorpion on left shoulder", "Financier and receiver for contraband consignments in Mumbai-Pune; uses shell firms.", "at_large", "Vanguard Smuggling Syndicate"),
            ("Ramesh Gowda", "Gowdru, RG", datetime(1988, 8, 9).date(), "Male", "Burn mark on neck", "Local offloader and distributor at Attibele/Electronic City staging godowns.", "arrested", "Vanguard Smuggling Syndicate"),
            # Scenario 2: Cyber
            ("Amit Shah (CyberDon)", "Amit Cyber, Protocol-9", datetime(1991, 1, 23).date(), "Male", "Mole above left eyebrow", "Architect of fake investment and loan apps; directs mule account networks in TS and DL.", "at_large", "Cyber Syndicate Alpha"),
            ("Rahul Sharma", "Techie Rahul, RS", datetime(1994, 7, 12).date(), "Male", "None", "VOIP infrastructure and spoofed SMS gateway manager in Cyberabad.", "under_trial", "Cyber Syndicate Alpha"),
            ("Deepa Patel", "D. Patel, Cashier", datetime(1993, 3, 30).date(), "Female", "Gold ring right pinky", "Liaison for Hawala cashouts and bullion purchase in Ahmedabad and Surat.", "on_bail", "Cyber Syndicate Alpha"),
            # Scenario 3: Contraband / Hawala
            ("Salim Khan", "Pathan, SK Bhai", datetime(1979, 9, 14).date(), "Male", "Limp in right leg", "Interstate Hawala and contraband broker coordinating AP-KA-MH shipments.", "at_large", "Apex Transit Nexus"),
            ("Venkat Reddy", "VR, Andhra Venkat", datetime(1984, 5, 20).date(), "Male", "Birthmark on collarbone", "Staging agent in Vijayawada managing riverine and highway transport links.", "arrested", "Apex Transit Nexus"),
            ("Prakash Jadhav", "PJ, Kolhapur Prakash", datetime(1987, 12, 5).date(), "Male", "Deep cut on chin", "Kolhapur hub manager receiving consignments from Belagavi checkpost.", "at_large", "Apex Transit Nexus"),
        ]
        criminals = {}
        existing_criminals = {c.full_name: c for c in db.query(Criminal).all()}
        for name, aliases, dob, gender, marks, mo, status, gang in criminal_data:
            cr = existing_criminals.get(name)
            if not cr:
                cr = Criminal(
                    full_name=name,
                    aliases=aliases,
                    date_of_birth=dob,
                    gender=gender,
                    identifying_marks=marks,
                    mo_summary=mo,
                    status=status,
                    gang_affiliation=gang,
                    dataset_provenance=_SEED_PROVENANCE,
                )
                db.add(cr)
                db.flush()
                existing_criminals[name] = cr
            criminals[name] = cr

        # -------------------------------------------------------------
        # 6. VICTIMS / COMPLAINANTS
        # -------------------------------------------------------------
        print("Seeding Complainants / Victims...")
        victim_data = [
            ("Kavitha Ramachandran", "9845112233", "Flat 402, Shanthi Apts, Electronic City, Bengaluru", "Female", 38, "Complainant regarding suspicious warehouse activity and container offloading near residential zone."),
            ("Sunil Narang", "9810055443", "B-14, Green Park, New Delhi", "Male", 49, "Victim of high-value crypto and fake loan portal fraud losing Rs. 14,50,000."),
            ("Anand Kulkarni", "9422019988", "12, Shahupuri Main Road, Kolhapur", "Male", 55, "Complainant reporting extortive Hawala demands tied to commercial consignment."),
        ]
        victims = {}
        existing_victims = {(v.full_name, v.contact_number): v for v in db.query(Victim).all()}
        for name, contact, addr, gender, age, stmt in victim_data:
            vi = existing_victims.get((name, contact))
            if not vi:
                vi = Victim(
                    full_name=name,
                    contact_number=contact,
                    address=addr,
                    gender=gender,
                    age=age,
                    statement=stmt,
                    dataset_provenance=_SEED_PROVENANCE,
                )
                db.add(vi)
                db.flush()
                existing_victims[(name, contact)] = vi
            victims[name] = vi

        # -------------------------------------------------------------
        # 7. CASES, FIRS, EVIDENCE & CHAIN OF CUSTODY
        # -------------------------------------------------------------
        print("Seeding Cross-State Cases & FIRs...")
        case_specs = [
            # SCENARIO 1: SMUGGLING CORRIDOR
            {
                "case_number": "CR-2026-INT-001",
                "category": smuggling_cat,
                "location": locations["Electronic City Toll Plaza"],
                "occurred_days_ago": 20,
                "description": "Inter-state contraband transport intercepted at Karnataka border; truck KA-09-CD-7717 linked to Hosur godown and Mumbai transit.",
                "mo_tags": "interstate_smuggling,border_transit,shell_carrier",
                "status": "investigating",
                "priority": "critical",
                "progress": 65,
                "fir_number": "FIR-091/ECITY/2026",
                "sections": "IPC 120B/420, Customs Act 135",
                "complainant": victims["Kavitha Ramachandran"],
                "narrative": "Intelligence received on transit truck KA-09-CD-7717 driven by Suresh Verma, moving contraband along Attibele-Hosur border under Vanguard Logistics Ltd manifest. Escort vehicle MH-12-AB-4521 observed coordinating route with Mumbai contact Vikram Malhotra (+91-98200-98765). Ramesh Gowda apprehended at offloading point.",
                "accused": [criminals["Suresh Verma"], criminals["Vikram Malhotra"], criminals["Ramesh Gowda"]],
                "victim_list": [victims["Kavitha Ramachandran"]],
                "evidence_title": "Contraband Consignment & GPS Tracker",
                "evidence_type": "physical",
            },
            {
                "case_number": "CR-2026-TN-042",
                "category": smuggling_cat,
                "location": locations["Hosur Industrial Complex"],
                "occurred_days_ago": 18,
                "description": "Raid on Vanguard Logistics staging warehouse; forged transport manifests and fake e-way bills seized.",
                "mo_tags": "warehouse_raid,forged_manifest,interstate_smuggling",
                "status": "investigating",
                "priority": "high",
                "progress": 55,
                "fir_number": "FIR-112/HOS/2026",
                "sections": "IPC 468/471/120B",
                "complainant": None,
                "narrative": "Hosur Police raided godown leased to Vanguard Logistics Ltd. Recovered documents tying vehicle KA-09-CD-7717 to outbound runs towards Bengaluru and inbound runs from Mumbai via MH-12-AB-4521.",
                "accused": [criminals["Suresh Verma"], criminals["Vikram Malhotra"]],
                "victim_list": [],
                "evidence_title": "Seized Vanguard Logistics Invoices & E-Way Bills",
                "evidence_type": "document",
            },
            {
                "case_number": "CR-2026-MH-108",
                "category": smuggling_cat,
                "location": locations["Bandra Kurla Complex"],
                "occurred_days_ago": 15,
                "description": "Financial investigation into shell bank accounts routing proceeds of interstate contraband transit.",
                "mo_tags": "money_trail,shell_firm,contraband_finance",
                "status": "open",
                "priority": "high",
                "progress": 30,
                "fir_number": "FIR-305/BKC/2026",
                "sections": "IPC 420/120B, PMLA Act",
                "complainant": None,
                "narrative": "Bandra Cyber/EOW unit initiated probe into accounts operated by Vikram Malhotra. Identified payments transferred to Suresh Verma (+91-98450-12345) matching consignment runs between Maharashtra and Karnataka.",
                "accused": [criminals["Vikram Malhotra"], criminals["Suresh Verma"]],
                "victim_list": [],
                "evidence_title": "Bank Account Ledgers & Corporate Filings",
                "evidence_type": "digital",
            },

            # SCENARIO 2: CYBER FRAUD SYNDICATE
            {
                "case_number": "CR-2026-CYB-001",
                "category": cyber_cat,
                "location": locations["Mandir Marg Cyber Node"],
                "occurred_days_ago": 25,
                "description": "Multi-crore loan app extortion and unauthorized cloud scraping syndicate spanning Delhi, Telangana, and Gujarat.",
                "mo_tags": "cyber_fraud,loan_app_scam,mule_accounts,voip_spoofing",
                "status": "investigating",
                "priority": "critical",
                "progress": 70,
                "fir_number": "FIR-019/CYB-DL/2026",
                "sections": "IT Act 66D/43, IPC 420/384/120B",
                "complainant": victims["Sunil Narang"],
                "narrative": "Complainant duped of Rs. 14.5 Lakhs by fake loan portal operated by FinTech Global Solutions. Money routed through mule accounts managed by Rahul Sharma (+91-94444-55555) in Cyberabad and liquidated into bullion by Deepa Patel (+91-98980-12121) in Ahmedabad under direction of Amit Shah (CyberDon).",
                "accused": [criminals["Amit Shah (CyberDon)"], criminals["Rahul Sharma"], criminals["Deepa Patel"]],
                "victim_list": [victims["Sunil Narang"]],
                "evidence_title": "Server Logs & Fraudulent Portal Database Dump",
                "evidence_type": "digital",
            },
            {
                "case_number": "CR-2026-TS-077",
                "category": cyber_cat,
                "location": locations["Cyberabad Tech Corridor"],
                "occurred_days_ago": 22,
                "description": "VOIP call center bust and mule SIM card seizure in Hitec City tech park.",
                "mo_tags": "sim_box_seizure,call_center_raid,cyber_mule",
                "status": "investigating",
                "priority": "high",
                "progress": 60,
                "fir_number": "FIR-220/CYB-TS/2026",
                "sections": "IT Act 66C/66D, Telegraph Act",
                "complainant": None,
                "narrative": "Cyberabad police conducted operation at Tower B premises. Seized 120 cloned SIM cards, SIM box hardware, and vehicle TS-09-ZZ-4040. Rahul Sharma arrested on premises; communication logs directly tied to Amit Shah (+91-91111-22222).",
                "accused": [criminals["Rahul Sharma"], criminals["Amit Shah (CyberDon)"]],
                "victim_list": [],
                "evidence_title": "Seized SIM Boxes, 120 Cloned SIMs & Laptops",
                "evidence_type": "digital",
            },
            {
                "case_number": "CR-2026-GJ-051",
                "category": cyber_cat,
                "location": locations["Navrangpura Business Center"],
                "occurred_days_ago": 14,
                "description": "Hawala cash liquidation and gold conversion cell dismantled in Ahmedabad.",
                "mo_tags": "hawala_liquidation,bullion_conversion,money_laundering",
                "status": "investigating",
                "priority": "high",
                "progress": 50,
                "fir_number": "FIR-088/NVG-GJ/2026",
                "sections": "IPC 420/120B, PMLA Act",
                "complainant": None,
                "narrative": "Gujarat CID Crime intercepted vehicle GJ-01-MM-8899 driven by Deepa Patel. Discovered Rs. 32 Lakhs in unaccounted cash received from Telangana mule bank withdrawals for onward transfer to Delhi ringleaders.",
                "accused": [criminals["Deepa Patel"], criminals["Amit Shah (CyberDon)"]],
                "victim_list": [],
                "evidence_title": "Seized Hawala Slips, Cash Ledger & Vehicle GJ-01-MM-8899",
                "evidence_type": "physical",
            },

            # SCENARIO 3: CONTRABAND & HAWALA NEXUS
            {
                "case_number": "CR-2026-BEL-099",
                "category": narcotics_cat,
                "location": locations["Belagavi Camp Border Gate"],
                "occurred_days_ago": 12,
                "description": "Interception of commercial consignment with concealed narcotics on NH4 corridor.",
                "mo_tags": "highway_interception,concealed_narcotics,border_checkpoint",
                "status": "investigating",
                "priority": "critical",
                "progress": 75,
                "fir_number": "FIR-441/BEL/2026",
                "sections": "NDPS Act 21/22/29",
                "complainant": None,
                "narrative": "Belagavi police interceptor halted truck AP-16-TX-3344 en route from Vijayawada to Kolhapur. Seized commercial quantity of contraband disguised as agricultural inputs under Apex Warehousing clearance. Driver named Venkat Reddy and Kolhapur handler Prakash Jadhav.",
                "accused": [criminals["Salim Khan"], criminals["Venkat Reddy"], criminals["Prakash Jadhav"]],
                "victim_list": [],
                "evidence_title": "Narcotics Samples & Hidden Compartment Tooling",
                "evidence_type": "physical",
            },
            {
                "case_number": "CR-2026-AP-033",
                "category": narcotics_cat,
                "location": locations["Governorpet Commercial Zone"],
                "occurred_days_ago": 10,
                "description": "Warehouse staging inspection linking agricultural transport fleet to Karnataka border shipments.",
                "mo_tags": "transit_staging,narcotics_supply,fleet_inspection",
                "status": "open",
                "priority": "high",
                "progress": 35,
                "fir_number": "FIR-150/GVP/2026",
                "sections": "NDPS Act 29, IPC 120B",
                "complainant": None,
                "narrative": "Vijayawada Task Force raided loading facility connected to Salim Khan (+91-98888-77777). Venkat Reddy arrested with dispatch schedules showing periodic movements to Belagavi and Kolhapur hubs.",
                "accused": [criminals["Salim Khan"], criminals["Venkat Reddy"]],
                "victim_list": [],
                "evidence_title": "Dispatch Schedules & Transit Documents",
                "evidence_type": "document",
            },
            {
                "case_number": "CR-2026-MH-215",
                "category": theft_cat,
                "location": locations["Kolhapur Transit Checkpost"],
                "occurred_days_ago": 8,
                "description": "Hawala payoff and stolen vehicle recovery tied to Apex Warehousing syndicate.",
                "mo_tags": "hawala_recovery,stolen_vehicle,cross_state_nexus",
                "status": "investigating",
                "priority": "medium",
                "progress": 45,
                "fir_number": "FIR-612/KOL/2026",
                "sections": "IPC 379/411/120B",
                "complainant": victims["Anand Kulkarni"],
                "narrative": "Kolhapur local crime branch intercepted van MH-09-CQ-6611 operated by Prakash Jadhav. Cash packets and stolen electronics originating from Belagavi seized.",
                "accused": [criminals["Prakash Jadhav"], criminals["Salim Khan"]],
                "victim_list": [victims["Anand Kulkarni"]],
                "evidence_title": "Recovered Electronic Goods & Cash Packets",
                "evidence_type": "physical",
            },
        ]

        existing_cases = {c.case_number: c for c in db.query(CrimeCase).all()}
        existing_firs = {f.fir_number: f for f in db.query(FIR).all()}
        existing_evs = {e.title: e for e in db.query(Evidence).all()}
        existing_fir_cr_links = {(l.fir_id, l.criminal_id) for l in db.query(FIRCriminalLink).all()}
        existing_fir_vi_links = {(l.fir_id, l.victim_id) for l in db.query(FIRVictimLink).all()}

        seeded_cases = []
        seeded_firs = []
        seeded_evidences = []

        for spec in case_specs:
            case_no = spec["case_number"]
            case = existing_cases.get(case_no)
            occ_time = now - timedelta(days=spec["occurred_days_ago"])
            rep_time = occ_time + timedelta(hours=4)
            if not case:
                case = CrimeCase(
                    case_number=case_no,
                    category_id=spec["category"].id if spec["category"] else default_cat.id,
                    location_id=spec["location"].id,
                    occurred_at=occ_time,
                    reported_at=rep_time,
                    description=spec["description"],
                    mo_tags=spec["mo_tags"],
                    status=spec["status"],
                    priority=spec["priority"],
                    progress=spec["progress"],
                    dataset_provenance=_SEED_PROVENANCE,
                )
                db.add(case)
                db.flush()
                existing_cases[case_no] = case
            seeded_cases.append(case)

            fir_no = spec["fir_number"]
            fir = existing_firs.get(fir_no)
            if not fir:
                comp_name = spec["complainant"].full_name if spec["complainant"] else "State / Sub-Inspector In-Charge"
                comp_contact = spec["complainant"].contact_number if spec["complainant"] else None
                fir = FIR(
                    fir_number=fir_no,
                    crime_case_id=case.id,
                    complainant_name=comp_name,
                    complainant_contact=comp_contact,
                    sections=spec["sections"],
                    filed_at=rep_time + timedelta(minutes=30),
                    status="registered",
                    narrative=spec["narrative"],
                    dataset_provenance=_SEED_PROVENANCE,
                )
                db.add(fir)
                db.flush()
                existing_firs[fir_no] = fir
            seeded_firs.append(fir)

            # Link accused
            for cr in spec["accused"]:
                if (fir.id, cr.id) not in existing_fir_cr_links:
                    db.add(FIRCriminalLink(fir_id=fir.id, criminal_id=cr.id, role="accused"))
                    existing_fir_cr_links.add((fir.id, cr.id))

            # Link victims
            for vi in spec["victim_list"]:
                if (fir.id, vi.id) not in existing_fir_vi_links:
                    db.add(FIRVictimLink(fir_id=fir.id, victim_id=vi.id))
                    existing_fir_vi_links.add((fir.id, vi.id))

            # Evidence
            ev_title = spec["evidence_title"]
            ev = existing_evs.get(ev_title)
            if not ev:
                ev = Evidence(
                    case_id=case.id,
                    title=ev_title,
                    evidence_type=spec["evidence_type"],
                    description=f"Seized items for case {case_no}: {spec['evidence_title']}",
                    created_by="Investigation Task Force",
                    status="Under Analysis" if spec["progress"] < 60 else "Analyzed",
                    storage_path=f"/evidence/multistate/{case.id}/{spec['evidence_type']}",
                    dataset_provenance=_SEED_PROVENANCE,
                )
                db.add(ev)
                db.flush()
                existing_evs[ev_title] = ev

                db.add(ChainOfCustody(
                    evidence_id=ev.id,
                    action="Seized at Scene",
                    location=spec["location"].address,
                    remarks=f"Registered for case {case_no}",
                ))
            seeded_evidences.append(ev)

        # -------------------------------------------------------------
        # 8. EVENTS
        # -------------------------------------------------------------
        print("Seeding Intelligence Events...")
        event_specs = [
            ("Attibele-Hosur Border Transit Incident", "transit_checkpoint", "Flagging of carrier truck KA-09-CD-7717 accompanied by MH-12-AB-4521", locations["Electronic City Toll Plaza"], 20),
            ("Tower B Cyber Operations Raid", "police_raid", "Special cyber unit raid on illegal VOIP call center and mule operations", locations["Cyberabad Tech Corridor"], 22),
            ("NH4 Kolhapur Border Checkpoint Seizure", "contraband_seizure", "Interception of Belagavi consignment with hidden compartments", locations["Kolhapur Transit Checkpost"], 12),
        ]
        events = {}
        existing_events = {e.title: e for e in db.query(IntelEvent).all()}
        for title, etype, desc, loc, days_ago in event_specs:
            ev = existing_events.get(title)
            if not ev:
                ev = IntelEvent(
                    title=title,
                    event_type=etype,
                    description=desc,
                    location_id=loc.id if loc else None,
                    district=loc.district if loc else None,
                    occurred_at=now - timedelta(days=days_ago),
                    is_demo_derived=True,
                )
                db.add(ev)
                db.flush()
                existing_events[title] = ev
            events[title] = ev

        # -------------------------------------------------------------
        # 9. ENTITY RELATIONSHIPS (GRAPH CONNECTIONS)
        # -------------------------------------------------------------
        print("Seeding Entity Relationships...")
        rel_specs = [
            # Suresh Verma
            ("person", criminals["Suresh Verma"].id, "vehicle", vehicles["KA-09-CD-7717"].id, "used_vehicle", 0.95, "driver_record"),
            ("person", criminals["Suresh Verma"].id, "phone", phones["+91-98450-12345"].id, "connected_to_phone", 0.98, "cdr_subscriber"),
            ("person", criminals["Suresh Verma"].id, "organization", orgs["Vanguard Logistics Ltd"].id, "member_of", 0.90, "payroll_record"),
            ("person", criminals["Suresh Verma"].id, "person", criminals["Vikram Malhotra"].id, "communicated_with", 0.88, "interstate_call_cluster"),
            # Vikram Malhotra
            ("person", criminals["Vikram Malhotra"].id, "vehicle", vehicles["MH-12-AB-4521"].id, "used_vehicle", 0.92, "rto_ownership"),
            ("person", criminals["Vikram Malhotra"].id, "phone", phones["+91-98200-98765"].id, "connected_to_phone", 0.97, "cdr_subscriber"),
            ("person", criminals["Vikram Malhotra"].id, "organization", orgs["Vanguard Logistics Ltd"].id, "associated_with", 0.95, "bank_director"),
            # Ramesh Gowda
            ("person", criminals["Ramesh Gowda"].id, "organization", orgs["Vanguard Logistics Ltd"].id, "member_of", 0.85, "warehouse_staff"),
            ("person", criminals["Ramesh Gowda"].id, "location", locations["Electronic City Toll Plaza"].id, "located_at", 0.90, "apprehended_scene"),
            # Amit Shah
            ("person", criminals["Amit Shah (CyberDon)"].id, "phone", phones["+91-91111-22222"].id, "connected_to_phone", 0.99, "voip_admin"),
            ("person", criminals["Amit Shah (CyberDon)"].id, "organization", orgs["FinTech Global Solutions"].id, "member_of", 0.96, "domain_registrant"),
            ("person", criminals["Amit Shah (CyberDon)"].id, "person", criminals["Rahul Sharma"].id, "communicated_with", 0.92, "encrypted_chats"),
            ("person", criminals["Amit Shah (CyberDon)"].id, "person", criminals["Deepa Patel"].id, "communicated_with", 0.89, "transaction_orders"),
            # Rahul Sharma
            ("person", criminals["Rahul Sharma"].id, "vehicle", vehicles["TS-09-ZZ-4040"].id, "used_vehicle", 0.88, "parking_permit"),
            ("person", criminals["Rahul Sharma"].id, "phone", phones["+91-94444-55555"].id, "connected_to_phone", 0.98, "cdr_subscriber"),
            # Deepa Patel
            ("person", criminals["Deepa Patel"].id, "vehicle", vehicles["GJ-01-MM-8899"].id, "used_vehicle", 0.94, "rto_ownership"),
            ("person", criminals["Deepa Patel"].id, "phone", phones["+91-98980-12121"].id, "connected_to_phone", 0.95, "cdr_subscriber"),
            # Salim Khan
            ("person", criminals["Salim Khan"].id, "phone", phones["+91-98888-77777"].id, "connected_to_phone", 0.97, "cdr_subscriber"),
            ("person", criminals["Salim Khan"].id, "organization", orgs["Apex Warehousing"].id, "associated_with", 0.91, "lease_agreement"),
            ("person", criminals["Salim Khan"].id, "person", criminals["Venkat Reddy"].id, "communicated_with", 0.86, "highway_transit_coordination"),
            # Venkat Reddy
            ("person", criminals["Venkat Reddy"].id, "vehicle", vehicles["AP-16-TX-3344"].id, "used_vehicle", 0.93, "toll_tag"),
            ("person", criminals["Venkat Reddy"].id, "phone", phones["+91-97777-66666"].id, "connected_to_phone", 0.96, "cdr_subscriber"),
            # Prakash Jadhav
            ("person", criminals["Prakash Jadhav"].id, "vehicle", vehicles["MH-09-CQ-6611"].id, "used_vehicle", 0.91, "driver_record"),
            ("person", criminals["Prakash Jadhav"].id, "phone", phones["+91-96666-55555"].id, "connected_to_phone", 0.94, "cdr_subscriber"),
        ]

        existing_rels = {
            (r.source_type, r.source_id, r.target_type, r.target_id)
            for r in db.query(EntityRelationship).all()
        }
        seeded_rels = []
        for stype, sid, ttype, tid, rtype, conf, inf in rel_specs:
            if (stype, sid, ttype, tid) not in existing_rels:
                rel = EntityRelationship(
                    source_type=stype,
                    source_id=sid,
                    target_type=ttype,
                    target_id=tid,
                    relationship_type=rtype,
                    confidence=conf,
                    weight=conf,
                    status="active",
                    provenance="DIRECT_RECORD",
                    inferred_from=inf,
                    first_seen=now - timedelta(days=30),
                    last_seen=now - timedelta(days=5),
                )
                db.add(rel)
                existing_rels.add((stype, sid, ttype, tid))
                seeded_rels.append(rel)

        # -------------------------------------------------------------
        # 10. RAW INGESTED DATA (CID-32-01 & OTHERS)
        # -------------------------------------------------------------
        print("Seeding Raw Ingested Data...")
        raw_reports = [
            {
                "external_ref": "CID-32-01",
                "source_type": "intelligence_report",
                "source_name": "Tamil Nadu Border Intelligence Bureau",
                "title": "Intelligence Report CID-32-01: Inter-State Smuggling Consignment Route",
                "raw_text": "Intelligence input received from Tamil Nadu border checkpost regarding illicit transit consignment. Vehicle KA-09-CD-7717, a dark grey truck registered in Mysuru, was observed multiple times crossing the Attibele-Hosur border along with associate vehicle MH-12-AB-4521. Suspect Suresh Verma (+91-98450-12345) coordinated transit with Mumbai contact Vikram Malhotra (+91-98200-98765) using shell entity Vanguard Logistics Ltd. Consignment valued at Rs. 4,50,000 destined for godown near Electronic City, Bengaluru.",
                "processing_status": "pending",
            },
            {
                "external_ref": "CYBER-INTEL-88",
                "source_type": "police_report",
                "source_name": "Special Cyber Cell Inter-State Taskforce",
                "title": "Cyber Threat Dossier: Syndicate Alpha Mule Financial Routing",
                "raw_text": "Surveillance on loan scam network indicates central coordination by Amit Shah (CyberDon) using contact +91-91111-22222. Technical operative Rahul Sharma (+91-94444-55555) deployed 120 cloned SIM cards at Tower B, Cyberabad using vehicle TS-09-ZZ-4040. Cash withdrawals totaling Rs. 32,00,000 channeled to Ahmedabad through Deepa Patel (+91-98980-12121) using Hyundai Creta GJ-01-MM-8899 on behalf of FinTech Global Solutions.",
                "processing_status": "pending",
            },
            {
                "external_ref": "BORDER-WATCH-09",
                "source_type": "surveillance",
                "source_name": "Western Ghats Corridor Border Post",
                "title": "Border Transit Flash: AP-KA-MH Contraband Movement",
                "raw_text": "Highway patrol flagged transit truck AP-16-TX-3344 heading towards Kolhapur checkpost. Intercepted driver Venkat Reddy (+91-97777-66666) confirmed consignments scheduled by Salim Khan (+91-98888-77777) under Apex Warehousing bills. Offload rendezvous point set with Prakash Jadhav in vehicle MH-09-CQ-6611 carrying Rs. 5,00,000 in transit cash.",
                "processing_status": "pending",
            },
        ]

        existing_raw = {r.external_ref: r for r in db.query(IngestionRecord).all()}
        seeded_raw = []
        for rep in raw_reports:
            r_obj = existing_raw.get(rep["external_ref"])
            if not r_obj:
                r_obj = IngestionRecord(
                    external_ref=rep["external_ref"],
                    source_type=rep["source_type"],
                    source_name=rep["source_name"],
                    title=rep["title"],
                    raw_text=rep["raw_text"],
                    processing_status=rep["processing_status"],
                    record_status="active",
                    is_demo_derived=True,
                    ingested_at=now - timedelta(days=2),
                )
                db.add(r_obj)
                existing_raw[rep["external_ref"]] = r_obj
            seeded_raw.append(r_obj)

        db.commit()
        print("Database commit successful!")

        # -------------------------------------------------------------
        # 11. EXPORT SYNTHETIC CSVS
        # -------------------------------------------------------------
        print("Exporting CSVs to backend/data/synthetic/...")
        
        # Cases CSV
        with open("data/synthetic/cases.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["case_number", "category", "location_address", "occurred_at", "status", "priority", "description"])
            for c in seeded_cases:
                writer.writerow([c.case_number, c.category.name if c.category else "", c.location.address if c.location else "", c.occurred_at, c.status, c.priority, c.description])

        # FIRs CSV
        with open("data/synthetic/firs.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["fir_number", "crime_case_id", "complainant_name", "sections", "filed_at", "narrative"])
            for fir in seeded_firs:
                writer.writerow([fir.fir_number, str(fir.crime_case_id), fir.complainant_name, fir.sections, fir.filed_at, fir.narrative])

        # Criminals CSV
        with open("data/synthetic/criminals.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["full_name", "aliases", "dob", "gender", "marks", "mo_summary", "status", "gang_affiliation"])
            for name, aliases, dob, gender, marks, mo, status, gang in criminal_data:
                writer.writerow([name, aliases, dob, gender, marks, mo, status, gang])

        # Vehicles CSV
        with open("data/synthetic/vehicles.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["registration_number", "vehicle_type", "make", "model", "color", "status", "notes"])
            for reg, vtype, make, model, col, status, notes in veh_data:
                writer.writerow([reg, vtype, make, model, col, status, notes])

        # Phones CSV
        with open("data/synthetic/phones.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["number", "carrier", "registered_name", "status"])
            for num, carrier, reg_name, status in phone_data:
                writer.writerow([num, carrier, reg_name, status])

        # Organizations CSV
        with open("data/synthetic/organizations.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["name", "org_type", "description", "address", "district", "risk_score"])
            for name, otype, desc, addr, dist, risk in org_data:
                writer.writerow([name, otype, desc, addr, dist, risk])

        # Relationships CSV
        with open("data/synthetic/relationships.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["source_type", "source_id", "target_type", "target_id", "relationship_type", "confidence", "inferred_from"])
            for r in seeded_rels:
                writer.writerow([r.source_type, str(r.source_id), r.target_type, str(r.target_id), r.relationship_type, r.confidence, r.inferred_from])

        # Raw Ingested CSV
        with open("data/synthetic/raw_ingested.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["external_ref", "source_type", "source_name", "title", "raw_text", "processing_status"])
            for rep in raw_reports:
                writer.writerow([rep["external_ref"], rep["source_type"], rep["source_name"], rep["title"], rep["raw_text"], rep["processing_status"]])

        print("Multi-state data generation & import complete!")

    except Exception as exc:
        db.rollback()
        print(f"Error seeding multi-state data: {exc}")
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed_multistate()
