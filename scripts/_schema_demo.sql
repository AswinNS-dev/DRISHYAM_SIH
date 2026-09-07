

-- ============================================================
-- SUPABASE GRANTS
-- The application connects with its own service credentials.
-- These statements make the schema usable in Supabase SQL Editor.
-- ============================================================
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ============================================================
-- DEMO / EXAMPLE DATA (realistic SIH26189 test population)
-- Deterministic UUIDs keep the rows referentially consistent.
-- Password hashes use DRISHYAM's sha256$<salt>$<hash> scheme.
-- Demo passwords: admin=564738  SCRB-7740=123456  IO-3921=456789  SP-0088=987654
-- ============================================================
BEGIN;

-- ── Roles ────────────────────────────────────────────────────────────────────
INSERT INTO roles (id, name, description) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin',         'Administrator — full control incl. data ingestion'),
    ('a0000000-0000-0000-0000-000000000002', 'crime_analyst', 'Analyst (SCRB) — analytics + network analysis'),
    ('a0000000-0000-0000-0000-000000000003', 'investigator',  'Investigator (IO) — case/FIR/evidence work'),
    ('a0000000-0000-0000-0000-000000000004', 'policymaker',   'Policymaker (SP) — read-only oversight'),
    ('a0000000-0000-0000-0000-000000000005', 'inspector',     'Inspector — extended investigation'),
    ('a0000000-0000-0000-0000-000000000006', 'forensic',      'Forensic analyst'),
    ('a0000000-0000-0000-0000-000000000007', 'viewer',        'Read-only viewer')
ON CONFLICT (id) DO NOTHING;

-- ── Users (ADMIN / ANALYST / INVESTIGATOR / VIEWER demo tiers) ──────────────
INSERT INTO users (id, username, email, full_name, hashed_password, is_active, role_id, district, station) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'admin',     'admin@drishyam.gov.in',     'Platform Administrator', 'sha256$826b1ece4b4fc23b1beb9253266f7f4e$0ed4b9dd7cb98842efd506ab042fe26a5319d3cc1065dd36f3c13a7c0f789bca', TRUE, 'a0000000-0000-0000-0000-000000000001', 'Bengaluru Urban', 'KSP HQ'),
    ('b0000000-0000-0000-0000-000000000002', 'SCRB-7740', 'scrb-7740@drishyam.gov.in', 'DCP Priya Sharma',       'sha256$ae618a1ff52d38bf6d109cc71495bad0$0e75ac02d2d8174217a9055272369cd5aef660231582e85388723cd3b816a0e1', TRUE, 'a0000000-0000-0000-0000-000000000002', 'Bengaluru Urban', 'SCRB HQ'),
    ('b0000000-0000-0000-0000-000000000003', 'IO-3921',   'io-3921@drishyam.gov.in',   'Inspector Ravi Kumar',   'sha256$360a587e137e92dbc7043661f63b2528$9e48cf9bca45d94a55495f53c18fd0ae35717975ab476663da13e6202a445ff7', TRUE, 'a0000000-0000-0000-0000-000000000003', 'Mysuru', 'Devaraja Police Station'),
    ('b0000000-0000-0000-0000-000000000004', 'SP-0088',   'sp-0088@drishyam.gov.in',   'SP Anil Kumble',         'sha256$62d62cb07eaed56d1ba2d32d25809ded$2cc7aa6eec58744c4e6148dce2885bb68b3a1a7ad8cef1423591084b33404068', TRUE, 'a0000000-0000-0000-0000-000000000004', 'State HQ', 'KSP HQ')
ON CONFLICT (id) DO NOTHING;

-- ── Locations ────────────────────────────────────────────────────────────────
INSERT INTO locations (id, district, station, latitude, longitude, state) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Bengaluru Urban', 'Whitefield', 12.9698, 77.7500, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000002', 'Bengaluru Urban', 'KR Puram',   13.0090, 77.6800, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000003', 'Mysuru',          'Devaraja',   12.3052, 76.6552, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000004', 'Mangaluru',       'Pandeshwar', 12.9141, 74.8560, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000005', 'Belagavi',        'Market PS',  15.8497, 74.4977, 'Karnataka')
ON CONFLICT (id) DO NOTHING;

-- ── Crime categories ─────────────────────────────────────────────────────────
INSERT INTO crime_categories (id, name, section_code, severity) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'Theft & Burglaries', 'IPC 379', 'medium'),
    ('d0000000-0000-0000-0000-000000000002', 'Narcotics',          'NDPS 21', 'high'),
    ('d0000000-0000-0000-0000-000000000003', 'Assault',            'IPC 323', 'medium'),
    ('d0000000-0000-0000-0000-000000000004', 'Cyber Crime',        'IT 66',   'high'),
    ('d0000000-0000-0000-0000-000000000005', 'Smuggling',          'Customs 132', 'high')
ON CONFLICT (id) DO NOTHING;

-- ── Persons (criminals) — two linked networks + one isolated offender ────────
INSERT INTO criminals (id, full_name, aliases, gender, address, identifying_marks, mo_summary, status, gang_affiliation, dataset_provenance) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'Ramu Swamy',    'RS; Cement Ramu', 'Male', 'Whitefield, Bengaluru',  'Scar over left eyebrow',    'Hits warehouses after midnight, uses stolen trucks.',          'at_large',  'Southside Syndicate', 'demo'),
    ('e0000000-0000-0000-0000-000000000002', 'Vikram Yadav',  'Vicky',           'Male', 'KR Puram, Bengaluru',    'Tattoo on right forearm',   'Coordinates loading crews and fence contacts for stolen goods.', 'at_large', 'Southside Syndicate', 'demo'),
    ('e0000000-0000-0000-0000-000000000003', 'Sayed Ibrahim', 'S I',             'Male', 'Devaraja, Mysuru',       'Missing left little finger','Runs narcotics distribution through highway tea stalls.',      'at_large',  'Highway Ring', 'demo'),
    ('e0000000-0000-0000-0000-000000000004', 'Karthik Gowda', 'KG',              'Male', 'Pandeshwar, Mangaluru',  'None recorded',             'Driver and courier for the smuggling ring.',                   'arrested',  'Highway Ring', 'demo'),
    ('e0000000-0000-0000-0000-000000000005', 'Mohsin Pasha',  'MP',              'Male', 'Market PS, Belagavi',    'Burn scar on right hand',   'Financial handler; routes proceeds through cash couriers.',    'at_large',  'Highway Ring', 'demo'),
    ('e0000000-0000-0000-0000-000000000006', 'Suresh Naik',   '',                'Male', 'Belagavi rural',         'None recorded',             'Repeat burglar; targets isolated farmhouses.',                 'at_large',  NULL, 'demo')
ON CONFLICT (id) DO NOTHING;

-- ── Victims ──────────────────────────────────────────────────────────────────
INSERT INTO victims (id, full_name, gender, age, contact_number, address, statement, dataset_provenance) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'Lakshmi Devi', 'Female', 52, '9880000101', 'Whitefield, Bengaluru',  'Warehouse stock was lifted over two nights.',       'demo'),
    ('f0000000-0000-0000-0000-000000000002', 'Ramesh Bhat',  'Male',   38, '9880000102', 'Devaraja, Mysuru',       'Saw unknown cars near the stall after closing.',    'demo'),
    ('f0000000-0000-0000-0000-000000000003', 'Anita Shetty', 'Female', 29, '9880000103', 'Pandeshwar, Mangaluru',  'Noticed the same van twice near the port road.',    'demo')
ON CONFLICT (id) DO NOTHING;

-- ── Crime cases ──────────────────────────────────────────────────────────────
INSERT INTO crime_cases (id, case_number, category_id, location_id, occurred_at, description, mo_tags, status, priority, progress, dataset_provenance) VALUES
    ('10000000-0000-0000-0000-000000000001', 'CR-2026-DEM-001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-07-14 02:30:00+00', 'Warehouse theft of electronic stock at Whitefield.',       'night;warehouse;truck',      'under_investigation', 'high',     35, 'demo'),
    ('10000000-0000-0000-0000-000000000002', 'CR-2026-DEM-002', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', '2026-07-28 21:15:00+00', 'Narcotics recovery near highway tea stall, Mysuru.',       'highway;narcotics;stall',    'under_investigation', 'high',     50, 'demo'),
    ('10000000-0000-0000-0000-000000000003', 'CR-2026-DEM-003', 'd0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', '2026-08-09 03:00:00+00', 'Suspected smuggled goods moved via port road, Mangaluru.', 'port;van;night',             'under_investigation', 'critical', 20, 'demo'),
    ('10000000-0000-0000-0000-000000000004', 'CR-2026-DEM-004', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', '2026-08-19 23:40:00+00', 'Farmhouse burglary series, Belagavi rural.',               'farmhouse;night;lock-break', 'open',                'medium',   10, 'demo')
ON CONFLICT (id) DO NOTHING;

-- ── FIRs + person links (network edges) ──────────────────────────────────────
INSERT INTO firs (id, fir_number, crime_case_id, complainant_name, sections, filed_at, status, narrative, dataset_provenance) VALUES
    ('11000000-0000-0000-0000-000000000001', 'FIR-2026-DEM-001', '10000000-0000-0000-0000-000000000001', 'Lakshmi Devi', 'IPC 379',    '2026-07-14 10:00:00+00', 'open', 'Warehouse stock theft reported; truck marks at gate.', 'demo'),
    ('11000000-0000-0000-0000-000000000002', 'FIR-2026-DEM-002', '10000000-0000-0000-0000-000000000001', 'Lakshmi Devi', 'IPC 379',    '2026-07-16 09:30:00+00', 'open', 'Second night of lifting; same tyre pattern.',          'demo'),
    ('11000000-0000-0000-0000-000000000003', 'FIR-2026-DEM-003', '10000000-0000-0000-0000-000000000002', 'Ramesh Bhat',  'NDPS 21',    '2026-07-29 11:00:00+00', 'open', 'Recovery of contraband near tea stall.',               'demo'),
    ('11000000-0000-0000-0000-000000000004', 'FIR-2026-DEM-004', '10000000-0000-0000-0000-000000000003', 'Anita Shetty', 'Customs 132','2026-08-10 08:20:00+00', 'open', 'Van seen twice near port road before dawn.',           'demo'),
    ('11000000-0000-0000-0000-000000000005', 'FIR-2026-DEM-005', '10000000-0000-0000-0000-000000000004', 'Anita Shetty', 'IPC 379',    '2026-08-20 10:10:00+00', 'open', 'Farmhouse break-in reported by caretaker.',            'demo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO fir_criminal_links (fir_id, criminal_id, role) VALUES
    ('11000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'accused'),
    ('11000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'accused'),
    ('11000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'accused'),
    ('11000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'accused'),
    ('11000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'accused'),
    ('11000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004', 'accused'),
    ('11000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'accused'),
    ('11000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000005', 'accused'),
    ('11000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000006', 'accused')
ON CONFLICT DO NOTHING;

INSERT INTO fir_victim_links (fir_id, victim_id) VALUES
    ('11000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001'),
    ('11000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001'),
    ('11000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002'),
    ('11000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003'),
    ('11000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ── Evidence ─────────────────────────────────────────────────────────────────
INSERT INTO evidence (id, case_id, evidence_id, evidence_type, description, source, location_found, collected_at, storage_location, status, dataset_provenance) VALUES
    ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'EV-DEM-0001', 'digital',  'CCTV clip of truck at gate', 'scene',       'Whitefield warehouse gate', '2026-07-14 12:00:00+00', 'Evidence Locker 1', 'collected', 'demo'),
    ('12000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'EV-DEM-0002', 'physical', 'Sealed contraband packets',  'recovery',    'Highway tea stall',         '2026-07-29 12:00:00+00', 'Evidence Locker 2', 'collected', 'demo'),
    ('12000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'EV-DEM-0003', 'document', 'Port-gate toll records',     'third-party', 'Mangaluru toll office',     '2026-08-11 10:00:00+00', 'Evidence Locker 3', 'collected', 'demo')
ON CONFLICT (id) DO NOTHING;

-- ── SIH26189 intelligence entities: organizations, vehicles, phones, events ──
INSERT INTO organizations (id, name, org_type, description, district, status, risk_score, is_demo_derived) VALUES
    ('14000000-0000-0000-0000-000000000001', 'Southside Syndicate', 'syndicate',      'Stolen-goods distribution ring operating across Bengaluru.', 'Bengaluru Urban', 'active', 78.0, TRUE),
    ('14000000-0000-0000-0000-000000000002', 'Highway Ring',        'criminal_gang',  'Narcotics and smuggling corridor along NH-75.',              'Mysuru',          'active', 84.0, TRUE),
    ('14000000-0000-0000-0000-000000000003', 'Gowda Traders',       'front_business', 'Cash-and-carry trader suspected of laundering proceeds.',    'Belagavi',        'active', 41.0, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicles (id, registration_number, vehicle_type, make, model, color, status, notes, is_demo_derived) VALUES
    ('15000000-0000-0000-0000-000000000001', 'KA-01-AB-4242', 'truck', 'Tata',   '407',    'Blue',  'wanted', 'Truck recorded at warehouse gate on FIR-2026-DEM-001.', TRUE),
    ('15000000-0000-0000-0000-000000000002', 'KA-09-CD-7717', 'van',   'Maruti', 'Eeco',   'White', 'wanted', 'Van seen twice near port road on FIR-2026-DEM-004.',    TRUE),
    ('15000000-0000-0000-0000-000000000003', 'KA-05-EF-1102', 'bike',  'Bajaj',  'Pulsar', 'Black', 'normal', 'Registered to a suspect; used for local errands.',      TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO phone_numbers (id, number, carrier, registered_name, status, is_demo_derived) VALUES
    ('16000000-0000-0000-0000-000000000001', '9880000201', 'TelCo A', 'Ramu Swamy',    'surveilled', TRUE),
    ('16000000-0000-0000-0000-000000000002', '9880000202', 'TelCo A', 'Vikram Yadav',  'active',     TRUE),
    ('16000000-0000-0000-0000-000000000003', '9880000203', 'TelCo B', 'Karthik Gowda', 'surveilled', TRUE),
    ('16000000-0000-0000-0000-000000000004', '9880000204', 'TelCo B', 'Mohsin Pasha',  'active',     TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (id, title, event_type, description, occurred_at, location_id, district, is_demo_derived) VALUES
    ('17000000-0000-0000-0000-000000000001', 'Warehouse loading meeting',    'meeting',      'Crews seen loading stock after midnight.',      '2026-07-14 02:00:00+00', 'c0000000-0000-0000-0000-000000000001', 'Bengaluru Urban', TRUE),
    ('17000000-0000-0000-0000-000000000002', 'Highway handover (suspected)', 'transaction',  'Suspected contraband handover at tea stall.',   '2026-07-28 21:00:00+00', 'c0000000-0000-0000-0000-000000000003', 'Mysuru', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Unified entity relationships (graph edges; provenance-labelled) ──────────
INSERT INTO entity_relationships
    (id, source_type, source_id, target_type, target_id, relationship_type, weight, confidence, status, provenance, inferred_from, evidence_records, first_seen, last_seen, created_by_id) VALUES
    ('18000000-0000-0000-0000-000000000001', 'person', 'e0000000-0000-0000-0000-000000000001', 'person', 'e0000000-0000-0000-0000-000000000002', 'associated_with', 3.0, 1.0, 'active', 'DIRECT_RECORD', 'fir_criminal_links', '[{"record_type":"fir","record_id":"11000000-0000-0000-0000-000000000001","label":"FIR-2026-DEM-001"}]', '2026-07-14 10:00:00+00', '2026-07-16 09:30:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000002', 'person', 'e0000000-0000-0000-0000-000000000001', 'organization', '14000000-0000-0000-0000-000000000001', 'member_of', 2.0, 0.9, 'active', 'DIRECT_RECORD', 'case_intelligence', '[]', '2026-07-14 10:00:00+00', '2026-07-14 10:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000003', 'person', 'e0000000-0000-0000-0000-000000000002', 'organization', '14000000-0000-0000-0000-000000000001', 'member_of', 2.0, 0.9, 'active', 'DIRECT_RECORD', 'case_intelligence', '[]', '2026-07-14 10:00:00+00', '2026-07-14 10:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000004', 'person', 'e0000000-0000-0000-0000-000000000003', 'organization', '14000000-0000-0000-0000-000000000002', 'member_of', 2.0, 0.9, 'active', 'DIRECT_RECORD', 'case_intelligence', '[]', '2026-07-29 11:00:00+00', '2026-07-29 11:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000005', 'person', 'e0000000-0000-0000-0000-000000000004', 'organization', '14000000-0000-0000-0000-000000000002', 'member_of', 2.0, 0.9, 'active', 'DIRECT_RECORD', 'case_intelligence', '[]', '2026-07-29 11:00:00+00', '2026-07-29 11:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000006', 'person', 'e0000000-0000-0000-0000-000000000005', 'organization', '14000000-0000-0000-0000-000000000002', 'member_of', 2.0, 0.9, 'active', 'DIRECT_RECORD', 'case_intelligence', '[]', '2026-08-10 08:20:00+00', '2026-08-10 08:20:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000007', 'person', 'e0000000-0000-0000-0000-000000000005', 'organization', '14000000-0000-0000-0000-000000000003', 'financial_connection', 1.0, 0.6, 'active', 'ANALYTICAL_INFERENCE', 'financial_transaction_record', '[{"record_type":"evidence","record_id":"12000000-0000-0000-0000-000000000003","label":"Port-gate toll records"}]', '2026-08-10 08:20:00+00', '2026-08-10 08:20:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000008', 'person', 'e0000000-0000-0000-0000-000000000001', 'vehicle', '15000000-0000-0000-0000-000000000001', 'used_vehicle', 2.0, 1.0, 'active', 'DIRECT_RECORD', 'fir_evidence', '[{"record_type":"evidence","record_id":"12000000-0000-0000-0000-000000000001","label":"CCTV clip of truck at gate"}]', '2026-07-14 12:00:00+00', '2026-07-14 12:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000009', 'person', 'e0000000-0000-0000-0000-000000000004', 'vehicle', '15000000-0000-0000-0000-000000000002', 'used_vehicle', 2.0, 1.0, 'active', 'DIRECT_RECORD', 'fir_evidence', '[{"record_type":"evidence","record_id":"12000000-0000-0000-0000-000000000003","label":"Port-gate toll records"}]', '2026-08-11 10:00:00+00', '2026-08-11 10:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-00000000000a', 'person', 'e0000000-0000-0000-0000-000000000001', 'phone', '16000000-0000-0000-0000-000000000001', 'connected_to_phone', 1.0, 1.0, 'active', 'DIRECT_RECORD', 'subscriber_record', '[]', '2026-07-14 10:00:00+00', '2026-07-14 10:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-00000000000b', 'person', 'e0000000-0000-0000-0000-000000000002', 'phone', '16000000-0000-0000-0000-000000000002', 'connected_to_phone', 1.0, 1.0, 'active', 'DIRECT_RECORD', 'subscriber_record', '[]', '2026-07-14 10:00:00+00', '2026-07-14 10:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-00000000000c', 'person', 'e0000000-0000-0000-0000-000000000004', 'phone', '16000000-0000-0000-0000-000000000003', 'connected_to_phone', 1.0, 1.0, 'active', 'DIRECT_RECORD', 'subscriber_record', '[]', '2026-07-29 11:00:00+00', '2026-07-29 11:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-00000000000d', 'person', 'e0000000-0000-0000-0000-000000000005', 'phone', '16000000-0000-0000-0000-000000000004', 'connected_to_phone', 1.0, 1.0, 'active', 'DIRECT_RECORD', 'subscriber_record', '[]', '2026-08-10 08:20:00+00', '2026-08-10 08:20:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-00000000000e', 'phone', '16000000-0000-0000-0000-000000000003', 'phone', '16000000-0000-0000-0000-000000000004', 'communicated_with', 4.0, 1.0, 'active', 'DIRECT_RECORD', 'cdr_record', '[{"record_type":"cdr","record_id":"1c000000-0000-0000-0000-000000000001","label":"CDR 9880000203 → 9880000204"}]', '2026-08-05 18:00:00+00', '2026-08-09 03:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-00000000000f', 'person', 'e0000000-0000-0000-0000-000000000001', 'event', '17000000-0000-0000-0000-000000000001', 'appeared_in_event', 1.0, 0.9, 'active', 'DIRECT_RECORD', 'surveillance_record', '[]', '2026-07-14 02:00:00+00', '2026-07-14 02:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000010', 'person', 'e0000000-0000-0000-0000-000000000005', 'person', 'e0000000-0000-0000-0000-000000000002', 'financial_connection', 1.0, 0.55, 'active', 'ANALYTICAL_INFERENCE', 'financial_transaction_record', '[{"record_type":"ingestion_record","record_id":"16000000-0000-0000-0000-000000000004","label":"Cash courier register"}]', '2026-08-10 08:20:00+00', '2026-08-10 08:20:00+00', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ── Case ↔ entity links (Case → Entities → Relationships context) ───────────
INSERT INTO case_entities (id, case_id, entity_type, entity_id, role, confidence, notes) VALUES
    ('19000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'person',       'e0000000-0000-0000-0000-000000000001', 'accused', 1.0, NULL),
    ('19000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'person',       'e0000000-0000-0000-0000-000000000002', 'accused', 1.0, NULL),
    ('19000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'vehicle',      '15000000-0000-0000-0000-000000000001', 'vehicle_used', 1.0, 'Truck on CCTV'),
    ('19000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'organization', '14000000-0000-0000-0000-000000000001', 'associated', 0.8, 'Suspected benefiting syndicate'),
    ('19000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'person',       'e0000000-0000-0000-0000-000000000003', 'accused', 1.0, NULL),
    ('19000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'phone',        '16000000-0000-0000-0000-000000000003', 'connected_to_phone', 0.9, NULL)
ON CONFLICT DO NOTHING;

-- ── Data sources + ingestion jobs (admin pipeline demo) ─────────────────────
INSERT INTO data_sources (id, name, source_type, description, contact, is_active, created_by_id) VALUES
    ('1a000000-0000-0000-0000-000000000001', 'TelCo A CDR feed',           'cdr_record',          'Daily structured CDR extracts from TelCo A.',      'nodal@telcoa.example',   TRUE, 'b0000000-0000-0000-0000-000000000001'),
    ('1a000000-0000-0000-0000-000000000002', 'CID Intelligence Bulletins', 'intelligence_report', 'Weekly intelligence bulletins (raw text stored).', 'cid-int@police.example', TRUE, 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ingestion_jobs
    (id, data_source_id, source_type, source_name, status, total_records, valid_records, invalid_records, relationships_created, entities_created, error_summary, ingested_by_id, completed_at) VALUES
    ('1b000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'cdr_record',          'TelCo A July batch',   'imported',  120, 120, 0, 96, 2, '[]', 'b0000000-0000-0000-0000-000000000001', '2026-08-01 06:30:00+00'),
    ('1b000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000002', 'intelligence_report', 'CID bulletin week 32', 'validated', 8,   7,   1, 3,  1, '[{"row":5,"errors":["Missing required field ''title''"]}]', 'b0000000-0000-0000-0000-000000000001', '2026-08-08 07:00:00+00'),
    ('1b000000-0000-0000-0000-000000000003', NULL,                                    'surveillance',        'Night patrol log 09-10', 'pending', 0,   0,   0, 0,  0, '[]', 'b0000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO raw_ingested_data
    (id, source_type, source_name, external_ref, title, raw_text, structured_data, processing_status, record_status, linked_case_id, ingested_by_id, ingested_at, is_demo_derived) VALUES
    ('1c000000-0000-0000-0000-000000000001', 'cdr_record', 'TelCo A July batch', 'CDR-0001', 'CDR 9880000203 → 9880000204',
        NULL,
        '{"caller_number":"9880000203","callee_number":"9880000204","call_direction":"outgoing","duration_seconds":214,"call_timestamp":"2026-08-05T18:00:00Z"}',
        'imported', 'active', NULL, 'b0000000-0000-0000-0000-000000000001', '2026-08-01 06:30:00+00', TRUE),
    ('1c000000-0000-0000-0000-000000000002', 'intelligence_report', 'CID bulletin week 32', 'CID-32-01', 'Smuggling corridor update',
        'Corridor activity along NH-75 remains elevated. A white Maruti Eeco (KA-09-CD-7717) has been observed near the port road twice after midnight. Handlers may be using cash couriers via Belagavi. (Raw text stored verbatim; no NLP extraction performed.)',
        '{"title":"Smuggling corridor update","confidence":0.7}',
        'imported', 'active', '10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-08-08 07:00:00+00', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Suspicious patterns + anomalies (grounded detections) ────────────────────
INSERT INTO suspicious_patterns
    (id, pattern_type, title, description, entities, case_ids, supporting_records, confidence, severity, detection_method, status, is_demo_derived) VALUES
    ('1d000000-0000-0000-0000-000000000001', 'repeated_communication', 'Repeated communications 9880000203 → 9880000204',
        'Number 9880000203 appears in 4 imported CDR records contacting 9880000204. Repeated temporal interaction pattern — potential coordination channel. This is a detected pattern, not a confirmed criminal association.',
        '[{"type":"phone","id":"16000000-0000-0000-0000-000000000003","name":"9880000203"},{"type":"phone","id":"16000000-0000-0000-0000-000000000004","name":"9880000204"}]',
        '["10000000-0000-0000-0000-000000000003"]',
        '{"cdr_record_count":4}', 0.75, 'high', 'deterministic_rule', 'detected', TRUE),
    ('1d000000-0000-0000-0000-000000000002', 'cross_case_link', 'Karthik Gowda linked across 2 cases',
        'Person appears in FIR-2026-DEM-003 (narcotics) and FIR-2026-DEM-004 (smuggling) — candidate for cross-case network analysis.',
        '[{"type":"person","id":"e0000000-0000-0000-0000-000000000004","name":"Karthik Gowda"}]',
        '["10000000-0000-0000-0000-000000000002","10000000-0000-0000-0000-000000000003"]',
        '{"fir_numbers":["FIR-2026-DEM-003","FIR-2026-DEM-004"]}', 0.9, 'medium', 'deterministic_rule', 'detected', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO anomalies
    (id, anomaly_type, title, what_detected, why_unusual, severity, confidence, related_entity_type, related_entity_id, related_case_id, supporting_data, detected_at, status, is_demo_derived) VALUES
    ('1e000000-0000-0000-0000-000000000001', 'new_connection_to_high_risk', 'New ingestion link to high-risk person Ramu Swamy',
        'A newly ingested police report created a relationship to Ramu Swamy.',
        'Ramu Swamy is linked to 2 FIR record(s) (risk score 65/100); new connections to this entity warrant review.',
        'medium', 0.7, 'person', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '{"risk_score":65,"fir_count":2,"source_type":"police_report"}', '2026-08-09 03:00:00+00', 'open', TRUE),
    ('1e000000-0000-0000-0000-000000000002', 'sudden_network_expansion', 'Highway Ring connectivity spike',
        '4 new relationships involving Highway Ring members recorded within a single week.',
        'Growth exceeds 2x the trailing weekly average for this cluster, indicating possible coordinated expansion.',
        'high', 0.72, 'organization', '14000000-0000-0000-0000-000000000002', NULL,
        '{"new_relationships":4,"window_days":7}', '2026-08-10 08:20:00+00', 'open', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Notifications (intelligence alerts) ──────────────────────────────────────
INSERT INTO notifications (id, recipient_id, title, message, type, severity, created_at, is_read) VALUES
    ('1f000000-0000-0000-0000-000000000001', NULL, 'Suspicious pattern detected', 'Repeated communication channel detected between 9880000203 and 9880000204. Review on the Network page.', 'pattern_alert', 'high',   '2026-08-08 07:05:00+00', FALSE),
    ('1f000000-0000-0000-0000-000000000002', NULL, 'Cross-case connection found', 'Karthik Gowda appears in two active cases. Open the network graph for the shared-case view.',            'intel_alert',   'medium','2026-08-10 08:25:00+00', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── Role permissions (SIH26189 tiers; ingestion is admin-only) ──────────────
INSERT INTO role_permissions (id, role_id, permission, resource) VALUES
    ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ingestion:run',      'data_ingestion'),
    ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ingestion:promote',  'data_ingestion'),
    ('20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'ingestion:rollback', 'data_ingestion'),
    ('20000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'admin:users',        'administration'),
    ('20000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'network:analyze',    'network'),
    ('20000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'reports:generate',   'reports'),
    ('20000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'cases:update',       'cases'),
    ('20000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'firs:create',        'firs'),
    ('20000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', 'dashboard:view',     'dashboard')
ON CONFLICT (id) DO NOTHING;

COMMIT;
