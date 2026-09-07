-- ============================================================
-- DRISHYAM â€” AI-Powered Criminal Network Intelligence & Analysis
-- SIH26189 | Complete Database Schema + Demo Data
-- ============================================================
-- Target: PostgreSQL 16 (Supabase-compatible). Paste this file into
-- Supabase Dashboard â†’ SQL Editor and run once, or apply with psql.
--
-- The schema mirrors the live application ORM (backend/app/models/):
--   * Core: users, roles, role_permissions, audit_logs, notifications
--   * Cases: crime_cases, firs (+ person links), evidence (+ custody),
--     investigation_notes, reports
--   * SIH26189 entity layer: organizations, vehicles, phone_numbers,
--     events, entity_relationships (unified graph edges), case_entities,
--     raw_ingested_data, data_sources, ingestion_jobs, suspicious_patterns,
--     anomalies, network_analysis, network_metrics
--
-- Data-ingestion model (SIH26189 Â§9): ADMIN-ONLY ingestion writes raw
-- rows into raw_ingested_data / import_staging_records with source,
-- timestamp and processing status (pending | validated | imported |
-- failed | archived). No NER/NLP is implemented; raw text is stored
-- verbatim with a processing_status extension point.
--
-- RBAC tiers: ADMIN > ANALYST (crime_analyst) > INVESTIGATOR >
-- VIEWER (+ support roles). ingestion:* permissions are granted to
-- admin only and enforced by backend route guards.
-- ============================================================

-- ============================================================
-- DRISHYAM â€” AI-Powered Criminal Network Intelligence & Analysis
-- SIH26189 â€” Complete Database Schema (PostgreSQL / Supabase)
-- ============================================================
-- Run in Supabase Dashboard > SQL Editor. Generates the full
-- application data model + realistic demo data.
-- ============================================================

BEGIN;


CREATE TABLE crime_categories (
	name VARCHAR(150) NOT NULL, 
	section_code VARCHAR(50), 
	severity VARCHAR(20), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE UNIQUE INDEX ix_crime_categories_name ON crime_categories (name);


CREATE TABLE face_identities (
	demo_id VARCHAR(20) NOT NULL, 
	display_name VARCHAR(120) NOT NULL, 
	image_ref VARCHAR(255) NOT NULL, 
	image_count INTEGER NOT NULL, 
	dataset_type VARCHAR(16) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_face_identities_dataset_type ON face_identities (dataset_type);
CREATE UNIQUE INDEX ix_face_identities_demo_id ON face_identities (demo_id);


CREATE TABLE identity_aliases (
	entity_type VARCHAR(20) NOT NULL, 
	entity_id UUID NOT NULL, 
	alias_name VARCHAR(255) NOT NULL, 
	name_type VARCHAR(30) NOT NULL, 
	confidence FLOAT NOT NULL, 
	source_type VARCHAR(30), 
	source_id VARCHAR(100), 
	source_label VARCHAR(255), 
	observed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_identity_aliases_entity_id ON identity_aliases (entity_id);
CREATE INDEX ix_identity_aliases_entity_type ON identity_aliases (entity_type);


CREATE TABLE identity_identifiers (
	entity_type VARCHAR(20) NOT NULL, 
	entity_id UUID NOT NULL, 
	identifier_type VARCHAR(30) NOT NULL, 
	value_hash VARCHAR(64) NOT NULL, 
	display_value VARCHAR(100), 
	valid_from TIMESTAMP WITH TIME ZONE, 
	valid_to TIMESTAMP WITH TIME ZONE, 
	observed_at TIMESTAMP WITH TIME ZONE, 
	source_type VARCHAR(30), 
	source_id VARCHAR(100), 
	source_label VARCHAR(255), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_identity_identifiers_entity_id ON identity_identifiers (entity_id);
CREATE INDEX ix_identity_identifiers_identifier_type ON identity_identifiers (identifier_type);
CREATE INDEX ix_identity_identifiers_entity_type ON identity_identifiers (entity_type);
CREATE INDEX ix_identity_identifiers_value_hash ON identity_identifiers (value_hash);


CREATE TABLE mo_tags (
	name VARCHAR(120) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE UNIQUE INDEX ix_mo_tags_name ON mo_tags (name);


CREATE TABLE model_update_jobs (
	model_name VARCHAR(50) NOT NULL, 
	trigger_type VARCHAR(50) NOT NULL, 
	reason TEXT, 
	triggered_by_id UUID, 
	status VARCHAR(20) NOT NULL, 
	previous_version VARCHAR(50), 
	new_version VARCHAR(50), 
	dataset_version VARCHAR(100), 
	training_records INTEGER NOT NULL, 
	evaluation_metrics TEXT, 
	deployment_status VARCHAR(20), 
	error_message TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_model_update_jobs_triggered_by_id ON model_update_jobs (triggered_by_id);
CREATE INDEX ix_model_update_jobs_status ON model_update_jobs (status);
CREATE INDEX ix_model_update_jobs_model_name ON model_update_jobs (model_name);


CREATE TABLE organizations (
	name VARCHAR(255) NOT NULL, 
	org_type VARCHAR(100), 
	description TEXT, 
	address VARCHAR(500), 
	district VARCHAR(100), 
	status VARCHAR(50) NOT NULL, 
	risk_score FLOAT NOT NULL, 
	is_demo_derived BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_organizations_district ON organizations (district);
CREATE INDEX ix_organizations_name ON organizations (name);


CREATE TABLE phone_numbers (
	number VARCHAR(30) NOT NULL, 
	carrier VARCHAR(100), 
	registered_name VARCHAR(255), 
	status VARCHAR(50) NOT NULL, 
	is_demo_derived BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE UNIQUE INDEX ix_phone_numbers_number ON phone_numbers (number);


CREATE TABLE revoked_tokens (
	jti VARCHAR(64) NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (jti)
)

;
CREATE INDEX ix_revoked_tokens_jti ON revoked_tokens (jti);


CREATE TABLE roles (
	name VARCHAR(50) NOT NULL, 
	description VARCHAR(255), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE UNIQUE INDEX ix_roles_name ON roles (name);


CREATE TABLE vehicles (
	registration_number VARCHAR(50) NOT NULL, 
	vehicle_type VARCHAR(100), 
	make VARCHAR(100), 
	model VARCHAR(100), 
	color VARCHAR(50), 
	status VARCHAR(50) NOT NULL, 
	notes TEXT, 
	is_demo_derived BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE UNIQUE INDEX ix_vehicles_registration_number ON vehicles (registration_number);


CREATE TABLE users (
	username VARCHAR(100) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	full_name VARCHAR(255) NOT NULL, 
	hashed_password VARCHAR(400) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	failed_login_attempts INTEGER DEFAULT '0' NOT NULL, 
	locked_until TIMESTAMP WITHOUT TIME ZONE, 
	role_id UUID NOT NULL, 
	district VARCHAR(100), 
	station VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(role_id) REFERENCES roles (id) ON DELETE RESTRICT
)

;
CREATE UNIQUE INDEX ix_users_username ON users (username);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_role_id ON users (role_id);


CREATE TABLE audit_logs (
	user_id UUID NOT NULL, 
	action VARCHAR(50) NOT NULL, 
	resource_type VARCHAR(100) NOT NULL, 
	resource_id VARCHAR(100), 
	details VARCHAR(1000), 
	ip_address VARCHAR(50), 
	result VARCHAR(20) NOT NULL, 
	metadata TEXT, 
	timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT
)

;
CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);


CREATE TABLE chat_conversations (
	user_id UUID NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	is_temporary BOOLEAN NOT NULL, 
	message_count INTEGER NOT NULL, 
	last_message_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_chat_conversations_user_updated ON chat_conversations (user_id, updated_at);
CREATE INDEX ix_chat_conversations_user_id ON chat_conversations (user_id);


CREATE TABLE data_sources (
	name VARCHAR(255) NOT NULL, 
	source_type VARCHAR(50) NOT NULL, 
	description TEXT, 
	contact VARCHAR(255), 
	is_active BOOLEAN NOT NULL, 
	created_by_id UUID, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_data_sources_source_type ON data_sources (source_type);


CREATE TABLE entity_relationships (
	source_type VARCHAR(50) NOT NULL, 
	source_id UUID NOT NULL, 
	target_type VARCHAR(50) NOT NULL, 
	target_id UUID NOT NULL, 
	relationship_type VARCHAR(100) NOT NULL, 
	weight FLOAT NOT NULL, 
	confidence FLOAT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	provenance VARCHAR(30) NOT NULL, 
	inferred_from VARCHAR(100), 
	evidence_records TEXT, 
	first_seen TIMESTAMP WITH TIME ZONE, 
	last_seen TIMESTAMP WITH TIME ZONE, 
	created_by_id UUID, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_entity_relationships_relationship_type ON entity_relationships (relationship_type);
CREATE INDEX ix_entity_relationships_pair ON entity_relationships (source_type, source_id, target_type, target_id);
CREATE INDEX ix_entity_relationships_target_type ON entity_relationships (target_type);
CREATE INDEX ix_entity_relationships_source_type ON entity_relationships (source_type);
CREATE INDEX ix_entity_relationships_target_id ON entity_relationships (target_id);
CREATE INDEX ix_entity_relationships_source_id ON entity_relationships (source_id);


CREATE TABLE identity_relationships (
	source_entity_type VARCHAR(20) NOT NULL, 
	source_entity_id UUID NOT NULL, 
	target_entity_type VARCHAR(20) NOT NULL, 
	target_entity_id UUID NOT NULL, 
	relationship_type VARCHAR(50) NOT NULL, 
	assessment VARCHAR(60) NOT NULL, 
	confidence FLOAT NOT NULL, 
	confidence_breakdown JSON, 
	evidence_summary JSON, 
	status VARCHAR(30) NOT NULL, 
	valid_from TIMESTAMP WITH TIME ZONE, 
	valid_to TIMESTAMP WITH TIME ZONE, 
	reviewed_by_id UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	review_decision VARCHAR(50), 
	review_note TEXT, 
	created_by_id UUID, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_identity_relationship_pair UNIQUE (source_entity_type, source_entity_id, target_entity_type, target_entity_id), 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id), 
	FOREIGN KEY(created_by_id) REFERENCES users (id)
)

;
CREATE INDEX ix_identity_relationships_target_entity_id ON identity_relationships (target_entity_id);
CREATE INDEX ix_identity_relationships_status ON identity_relationships (status);
CREATE INDEX ix_identity_relationships_source_entity_id ON identity_relationships (source_entity_id);
CREATE INDEX ix_identity_relationships_relationship_type ON identity_relationships (relationship_type);
CREATE INDEX ix_identity_relationships_target_entity_type ON identity_relationships (target_entity_type);
CREATE INDEX ix_identity_relationships_source_entity_type ON identity_relationships (source_entity_type);


CREATE TABLE import_jobs (
	entity_type VARCHAR(50) NOT NULL, 
	source_format VARCHAR(10) NOT NULL, 
	mapping_profile VARCHAR(50) NOT NULL, 
	source_system VARCHAR(100) NOT NULL, 
	filename VARCHAR(500), 
	status VARCHAR(30) NOT NULL, 
	total_rows INTEGER NOT NULL, 
	imported_rows INTEGER NOT NULL, 
	failed_rows INTEGER NOT NULL, 
	valid_rows INTEGER NOT NULL, 
	invalid_rows INTEGER NOT NULL, 
	warning_rows INTEGER NOT NULL, 
	exact_duplicate_rows INTEGER NOT NULL, 
	potential_duplicate_rows INTEGER NOT NULL, 
	conflict_rows INTEGER NOT NULL, 
	new_record_rows INTEGER NOT NULL, 
	matched_record_rows INTEGER NOT NULL, 
	updated_record_rows INTEGER NOT NULL, 
	rejected_rows INTEGER NOT NULL, 
	review_rows INTEGER NOT NULL, 
	error_count INTEGER NOT NULL, 
	promoted_rows INTEGER NOT NULL, 
	quality_grade VARCHAR(10), 
	processing_started_at TIMESTAMP WITH TIME ZONE, 
	processing_completed_at TIMESTAMP WITH TIME ZONE, 
	promoted_at TIMESTAMP WITH TIME ZONE, 
	rolled_back_at TIMESTAMP WITH TIME ZONE, 
	validation_report TEXT, 
	created_by_id UUID, 
	promoted_by_id UUID, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(promoted_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_import_jobs_status ON import_jobs (status);
CREATE INDEX ix_import_jobs_entity_type ON import_jobs (entity_type);
CREATE INDEX ix_import_jobs_created_by_id ON import_jobs (created_by_id);


CREATE TABLE integrity_alerts (
	alert_type VARCHAR(40) NOT NULL, 
	severity VARCHAR(20) NOT NULL, 
	entity_a_type VARCHAR(20), 
	entity_a_id UUID, 
	entity_b_type VARCHAR(20), 
	entity_b_id UUID, 
	identifier_type VARCHAR(30), 
	value_hash VARCHAR(64), 
	display_value VARCHAR(100), 
	confidence FLOAT NOT NULL, 
	description TEXT NOT NULL, 
	grouping_key VARCHAR(255), 
	observation_count INTEGER NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	source_summary JSON, 
	reviewed_by_id UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id)
)

;
CREATE INDEX ix_integrity_alerts_entity_a_type ON integrity_alerts (entity_a_type);
CREATE INDEX ix_integrity_alerts_status ON integrity_alerts (status);
CREATE INDEX ix_integrity_alerts_entity_a_id ON integrity_alerts (entity_a_id);
CREATE INDEX ix_integrity_alerts_entity_b_id ON integrity_alerts (entity_b_id);
CREATE INDEX ix_integrity_alerts_entity_b_type ON integrity_alerts (entity_b_type);
CREATE INDEX ix_integrity_alerts_alert_type ON integrity_alerts (alert_type);
CREATE INDEX ix_integrity_alerts_value_hash ON integrity_alerts (value_hash);
CREATE INDEX ix_integrity_alerts_grouping_key ON integrity_alerts (grouping_key);


CREATE TABLE intelligence_report_runs (
	id UUID NOT NULL, 
	entity_type VARCHAR(20) NOT NULL, 
	entity_id VARCHAR(64) NOT NULL, 
	entity_label VARCHAR(300), 
	summary TEXT, 
	connections INTEGER NOT NULL, 
	leads INTEGER NOT NULL, 
	threads INTEGER NOT NULL, 
	timeline_events INTEGER NOT NULL, 
	confirmed INTEGER NOT NULL, 
	probable INTEGER NOT NULL, 
	possible INTEGER NOT NULL, 
	created_by_id UUID, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_intel_report_entity ON intelligence_report_runs (entity_type, entity_id);
CREATE INDEX ix_intel_report_user_ts ON intelligence_report_runs (created_by_id, created_at);
CREATE INDEX ix_intelligence_report_runs_entity_id ON intelligence_report_runs (entity_id);
CREATE INDEX ix_intelligence_report_runs_created_by_id ON intelligence_report_runs (created_by_id);


CREATE TABLE interventions (
	district VARCHAR(100) NOT NULL, 
	intervention_type VARCHAR(50) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(20) NOT NULL, 
	workflow_stage VARCHAR(30) NOT NULL, 
	intelligence_id VARCHAR(100), 
	pattern_type VARCHAR(100), 
	affected_h3_cells TEXT, 
	relevant_time_period VARCHAR(100), 
	reason TEXT, 
	supporting_intelligence TEXT, 
	estimated_coverage FLOAT, 
	assumptions TEXT, 
	simulation_data TEXT, 
	supervisor_notes TEXT, 
	subsequent_crime_count INTEGER, 
	pattern_persisted VARCHAR(50), 
	observed_outcome TEXT, 
	review_notes TEXT, 
	created_by_id UUID, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_interventions_started_at ON interventions (started_at);
CREATE INDEX ix_interventions_created_by_id ON interventions (created_by_id);
CREATE INDEX ix_interventions_status ON interventions (status);
CREATE INDEX ix_interventions_district ON interventions (district);
CREATE INDEX ix_interventions_workflow_stage ON interventions (workflow_stage);
CREATE INDEX ix_interventions_intelligence_id ON interventions (intelligence_id);


CREATE TABLE network_analysis (
	analysis_type VARCHAR(50) NOT NULL, 
	node_count INTEGER NOT NULL, 
	edge_count INTEGER NOT NULL, 
	graph_density FLOAT NOT NULL, 
	connected_components INTEGER NOT NULL, 
	params TEXT, 
	computed_by_id UUID, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(computed_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;


CREATE TABLE notifications (
	user_id UUID, 
	sender_id UUID, 
	subject VARCHAR(500) NOT NULL, 
	notification_type VARCHAR(50) NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	message TEXT NOT NULL, 
	severity VARCHAR(20) NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	resource_type VARCHAR(50), 
	resource_id VARCHAR(100), 
	related_case_number VARCHAR(50), 
	related_fir_number VARCHAR(50), 
	is_read BOOLEAN NOT NULL, 
	is_dismissed BOOLEAN NOT NULL, 
	is_broadcast BOOLEAN NOT NULL, 
	parent_id UUID, 
	attachment_url VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	read_at TIMESTAMP WITH TIME ZONE, 
	acknowledged_at TIMESTAMP WITH TIME ZONE, 
	resolved_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(sender_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(parent_id) REFERENCES notifications (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_notifications_category ON notifications (category);
CREATE INDEX ix_notifications_related_case_number ON notifications (related_case_number);
CREATE INDEX ix_notifications_priority ON notifications (priority);
CREATE INDEX ix_notifications_notification_type ON notifications (notification_type);
CREATE INDEX ix_notifications_created_at ON notifications (created_at);
CREATE INDEX ix_notifications_status ON notifications (status);
CREATE INDEX ix_notifications_is_read ON notifications (is_read);
CREATE INDEX ix_notifications_user_id ON notifications (user_id);
CREATE INDEX ix_notifications_sender_id ON notifications (sender_id);


CREATE TABLE proxy_patterns (
	rule_id VARCHAR(20) NOT NULL, 
	rule_version VARCHAR(20) NOT NULL, 
	pattern VARCHAR(50) NOT NULL, 
	severity VARCHAR(20) NOT NULL, 
	confidence FLOAT NOT NULL, 
	assessment VARCHAR(60) NOT NULL, 
	entities JSON NOT NULL, 
	evidence JSON NOT NULL, 
	counter_evidence JSON NOT NULL, 
	time_window JSON, 
	explanation TEXT NOT NULL, 
	possible_explanations JSON NOT NULL, 
	grouping_key VARCHAR(255), 
	observation_count INTEGER NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	reviewed_by_id UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	review_decision VARCHAR(50), 
	review_note TEXT, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id)
)

;
CREATE INDEX ix_proxy_patterns_status ON proxy_patterns (status);
CREATE INDEX ix_proxy_patterns_rule_id ON proxy_patterns (rule_id);
CREATE INDEX ix_proxy_patterns_pattern ON proxy_patterns (pattern);
CREATE INDEX ix_proxy_patterns_grouping_key ON proxy_patterns (grouping_key);


CREATE TABLE suspicious_patterns (
	pattern_type VARCHAR(100) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	entities TEXT, 
	case_ids TEXT, 
	supporting_records TEXT, 
	confidence FLOAT NOT NULL, 
	severity VARCHAR(20) NOT NULL, 
	detection_method VARCHAR(100), 
	status VARCHAR(20) NOT NULL, 
	reviewed_by_id UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	is_demo_derived BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_suspicious_patterns_pattern_type ON suspicious_patterns (pattern_type);
CREATE INDEX ix_suspicious_patterns_status ON suspicious_patterns (status);


CREATE TABLE chat_messages (
	conversation_id UUID NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	content TEXT NOT NULL, 
	classification VARCHAR(50), 
	sources_json JSON, 
	citations_json JSON, 
	seq INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(conversation_id) REFERENCES chat_conversations (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_chat_messages_conversation_id ON chat_messages (conversation_id);
CREATE UNIQUE INDEX ux_chat_messages_conv_seq ON chat_messages (conversation_id, seq);


CREATE TABLE criminals (
	full_name VARCHAR(255) NOT NULL, 
	aliases VARCHAR(500), 
	date_of_birth DATE, 
	gender VARCHAR(20), 
	address VARCHAR(500), 
	identifying_marks TEXT, 
	mo_summary TEXT, 
	status VARCHAR(30) NOT NULL, 
	gang_affiliation VARCHAR(255), 
	neo4j_node_id VARCHAR(100), 
	image_url VARCHAR(1000), 
	dataset_provenance VARCHAR(20) NOT NULL, 
	source_import_job_id UUID, 
	source_file VARCHAR(500), 
	source_row_ref VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(source_import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_criminals_dataset_provenance ON criminals (dataset_provenance);
CREATE INDEX ix_criminals_full_name ON criminals (full_name);
CREATE INDEX ix_criminals_neo4j_node_id ON criminals (neo4j_node_id);
CREATE INDEX ix_criminals_source_import_job_id ON criminals (source_import_job_id);


CREATE TABLE identity_conflicts (
	relationship_id UUID, 
	source_entity_type VARCHAR(20) NOT NULL, 
	source_entity_id UUID NOT NULL, 
	target_entity_type VARCHAR(20) NOT NULL, 
	target_entity_id UUID NOT NULL, 
	attribute VARCHAR(30) NOT NULL, 
	value_a TEXT NOT NULL, 
	value_b TEXT NOT NULL, 
	severity VARCHAR(20) NOT NULL, 
	explanation TEXT NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	reviewed_by_id UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(relationship_id) REFERENCES identity_relationships (id) ON DELETE CASCADE, 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id)
)

;
CREATE INDEX ix_identity_conflicts_source_entity_id ON identity_conflicts (source_entity_id);
CREATE INDEX ix_identity_conflicts_target_entity_type ON identity_conflicts (target_entity_type);
CREATE INDEX ix_identity_conflicts_status ON identity_conflicts (status);
CREATE INDEX ix_identity_conflicts_relationship_id ON identity_conflicts (relationship_id);
CREATE INDEX ix_identity_conflicts_source_entity_type ON identity_conflicts (source_entity_type);
CREATE INDEX ix_identity_conflicts_target_entity_id ON identity_conflicts (target_entity_id);


CREATE TABLE identity_evidence (
	relationship_id UUID NOT NULL, 
	evidence_group VARCHAR(30) NOT NULL, 
	signal_type VARCHAR(50) NOT NULL, 
	weight_delta FLOAT NOT NULL, 
	confidence FLOAT, 
	severity VARCHAR(20), 
	source_type VARCHAR(30), 
	source_id VARCHAR(100), 
	source_label VARCHAR(255), 
	description TEXT NOT NULL, 
	observed_at TIMESTAMP WITH TIME ZONE, 
	time_range VARCHAR(50), 
	is_counter_evidence BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(relationship_id) REFERENCES identity_relationships (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_identity_evidence_relationship_id ON identity_evidence (relationship_id);
CREATE INDEX ix_identity_evidence_evidence_group ON identity_evidence (evidence_group);


CREATE TABLE import_staging_records (
	job_id UUID NOT NULL, 
	row_number INTEGER NOT NULL, 
	source_row_ref VARCHAR(100), 
	raw_data TEXT, 
	mapped_data TEXT, 
	validation_status VARCHAR(20) NOT NULL, 
	validation_errors TEXT, 
	validation_warnings TEXT, 
	duplicate_status VARCHAR(30) NOT NULL, 
	duplicate_of TEXT, 
	reconciliation_status VARCHAR(30) NOT NULL, 
	reconciliation_details TEXT, 
	trust_level VARCHAR(30) NOT NULL, 
	promoted BOOLEAN NOT NULL, 
	promoted_record_id UUID, 
	promoted_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(job_id) REFERENCES import_jobs (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_import_staging_records_trust_level ON import_staging_records (trust_level);
CREATE INDEX ix_staging_job_row ON import_staging_records (job_id, row_number);
CREATE INDEX ix_import_staging_records_job_id ON import_staging_records (job_id);
CREATE INDEX ix_staging_reconciliation ON import_staging_records (reconciliation_status);
CREATE INDEX ix_import_staging_records_duplicate_status ON import_staging_records (duplicate_status);
CREATE INDEX ix_import_staging_records_promoted_record_id ON import_staging_records (promoted_record_id);
CREATE INDEX ix_import_staging_records_validation_status ON import_staging_records (validation_status);
CREATE INDEX ix_import_staging_records_reconciliation_status ON import_staging_records (reconciliation_status);


CREATE TABLE ingestion_jobs (
	data_source_id UUID, 
	source_type VARCHAR(50) NOT NULL, 
	source_name VARCHAR(255), 
	status VARCHAR(20) NOT NULL, 
	total_records INTEGER NOT NULL, 
	valid_records INTEGER NOT NULL, 
	invalid_records INTEGER NOT NULL, 
	relationships_created INTEGER NOT NULL, 
	entities_created INTEGER NOT NULL, 
	error_summary TEXT, 
	ingested_by_id UUID, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(data_source_id) REFERENCES data_sources (id) ON DELETE SET NULL, 
	FOREIGN KEY(ingested_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_ingestion_jobs_source_type ON ingestion_jobs (source_type);
CREATE INDEX ix_ingestion_jobs_status ON ingestion_jobs (status);


CREATE TABLE locations (
	address VARCHAR(500), 
	district VARCHAR(100) NOT NULL, 
	station VARCHAR(100), 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	pincode VARCHAR(10), 
	dataset_provenance VARCHAR(20) NOT NULL, 
	source_import_job_id UUID, 
	source_file VARCHAR(500), 
	source_row_ref VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_location_station_address UNIQUE (station, address), 
	FOREIGN KEY(source_import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_locations_station ON locations (station);
CREATE INDEX ix_locations_district ON locations (district);
CREATE INDEX ix_locations_dataset_provenance ON locations (dataset_provenance);
CREATE INDEX ix_locations_source_import_job_id ON locations (source_import_job_id);


CREATE TABLE network_metrics (
	run_id UUID NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id UUID NOT NULL, 
	entity_name VARCHAR(255) NOT NULL, 
	degree_centrality FLOAT NOT NULL, 
	betweenness_centrality FLOAT NOT NULL, 
	closeness_centrality FLOAT NOT NULL, 
	pagerank FLOAT NOT NULL, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(run_id) REFERENCES network_analysis (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_network_metrics_run_entity ON network_metrics (run_id, entity_type, entity_id);
CREATE INDEX ix_network_metrics_run_id ON network_metrics (run_id);


CREATE TABLE officers (
	supabase_user_id UUID, 
	user_id UUID, 
	badge_number VARCHAR(50) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	rank VARCHAR(100), 
	station VARCHAR(100) NOT NULL, 
	district VARCHAR(100), 
	designation VARCHAR(100), 
	phone VARCHAR(20), 
	email VARCHAR(255), 
	status VARCHAR(50) NOT NULL, 
	image_url VARCHAR(1000), 
	dataset_provenance VARCHAR(20) NOT NULL, 
	source_import_job_id UUID, 
	source_file VARCHAR(500), 
	source_row_ref VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (email), 
	FOREIGN KEY(source_import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_officers_district ON officers (district);
CREATE UNIQUE INDEX ix_officers_badge_number ON officers (badge_number);
CREATE INDEX ix_officers_dataset_provenance ON officers (dataset_provenance);
CREATE INDEX ix_officers_source_import_job_id ON officers (source_import_job_id);
CREATE INDEX ix_officers_station ON officers (station);


CREATE TABLE proxy_pattern_evidence (
	pattern_id UUID NOT NULL, 
	evidence_category VARCHAR(40) NOT NULL, 
	description TEXT NOT NULL, 
	source_type VARCHAR(30), 
	source_id VARCHAR(100), 
	source_label VARCHAR(255), 
	observed_at TIMESTAMP WITH TIME ZONE, 
	weight FLOAT NOT NULL, 
	support BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(pattern_id) REFERENCES proxy_patterns (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_proxy_pattern_evidence_pattern_id ON proxy_pattern_evidence (pattern_id);


CREATE TABLE victims (
	full_name VARCHAR(255) NOT NULL, 
	contact_number VARCHAR(20), 
	address VARCHAR(500), 
	gender VARCHAR(20), 
	age INTEGER, 
	statement TEXT, 
	neo4j_node_id VARCHAR(100), 
	image_url VARCHAR(1000), 
	dataset_provenance VARCHAR(20) NOT NULL, 
	source_import_job_id UUID, 
	source_file VARCHAR(500), 
	source_row_ref VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(source_import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_victims_full_name ON victims (full_name);
CREATE INDEX ix_victims_dataset_provenance ON victims (dataset_provenance);
CREATE INDEX ix_victims_neo4j_node_id ON victims (neo4j_node_id);
CREATE INDEX ix_victims_source_import_job_id ON victims (source_import_job_id);


CREATE TABLE crime_cases (
	case_number VARCHAR(50) NOT NULL, 
	category_id UUID NOT NULL, 
	location_id UUID NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	reported_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	description TEXT, 
	mo_tags VARCHAR(500), 
	status VARCHAR(30) NOT NULL, 
	priority VARCHAR(30), 
	progress INTEGER, 
	assigned_officer_id UUID, 
	dataset_provenance VARCHAR(20) NOT NULL, 
	source_import_job_id UUID, 
	source_file VARCHAR(500), 
	source_row_ref VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(category_id) REFERENCES crime_categories (id) ON DELETE RESTRICT, 
	FOREIGN KEY(location_id) REFERENCES locations (id) ON DELETE RESTRICT, 
	FOREIGN KEY(assigned_officer_id) REFERENCES officers (id) ON DELETE SET NULL, 
	FOREIGN KEY(source_import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_crime_cases_occurred_at ON crime_cases (occurred_at);
CREATE UNIQUE INDEX ix_crime_cases_case_number ON crime_cases (case_number);
CREATE INDEX ix_crime_cases_location_id ON crime_cases (location_id);
CREATE INDEX ix_crime_cases_dataset_provenance ON crime_cases (dataset_provenance);
CREATE INDEX ix_crime_cases_status ON crime_cases (status);
CREATE INDEX ix_crime_cases_category_id ON crime_cases (category_id);
CREATE INDEX ix_crime_cases_assigned_officer_id ON crime_cases (assigned_officer_id);
CREATE INDEX ix_crime_cases_source_import_job_id ON crime_cases (source_import_job_id);
CREATE INDEX ix_crime_cases_created_at ON crime_cases (created_at);


CREATE TABLE criminal_mo_tags (
	criminal_id UUID NOT NULL, 
	mo_tag_id UUID NOT NULL, 
	PRIMARY KEY (criminal_id, mo_tag_id), 
	CONSTRAINT uq_criminal_mo_tag UNIQUE (criminal_id, mo_tag_id), 
	FOREIGN KEY(criminal_id) REFERENCES criminals (id) ON DELETE CASCADE, 
	FOREIGN KEY(mo_tag_id) REFERENCES mo_tags (id) ON DELETE CASCADE
)

;


CREATE TABLE events (
	title VARCHAR(255) NOT NULL, 
	event_type VARCHAR(100), 
	description TEXT, 
	occurred_at TIMESTAMP WITH TIME ZONE, 
	location_id UUID, 
	district VARCHAR(100), 
	is_demo_derived BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_events_district ON events (district);
CREATE INDEX ix_events_occurred_at ON events (occurred_at);
CREATE INDEX ix_events_title ON events (title);


CREATE TABLE anomalies (
	anomaly_type VARCHAR(100) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	what_detected TEXT, 
	why_unusual TEXT, 
	severity VARCHAR(20) NOT NULL, 
	confidence FLOAT NOT NULL, 
	related_entity_type VARCHAR(50), 
	related_entity_id UUID, 
	related_case_id UUID, 
	supporting_data TEXT, 
	detected_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(20) NOT NULL, 
	reviewed_by_id UUID, 
	is_demo_derived BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(related_case_id) REFERENCES crime_cases (id) ON DELETE SET NULL, 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_anomalies_anomaly_type ON anomalies (anomaly_type);
CREATE INDEX ix_anomalies_status ON anomalies (status);
CREATE INDEX ix_anomalies_related_entity_id ON anomalies (related_entity_id);
CREATE INDEX ix_anomalies_severity ON anomalies (severity);
CREATE INDEX ix_anomalies_detected_at ON anomalies (detected_at);


CREATE TABLE case_entities (
	case_id UUID NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id UUID NOT NULL, 
	role VARCHAR(100) NOT NULL, 
	confidence FLOAT NOT NULL, 
	notes TEXT, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(case_id) REFERENCES crime_cases (id) ON DELETE CASCADE
)

;
CREATE UNIQUE INDEX ix_case_entities_unique ON case_entities (case_id, entity_type, entity_id, role);
CREATE INDEX ix_case_entities_entity_type ON case_entities (entity_type);
CREATE INDEX ix_case_entities_entity_id ON case_entities (entity_id);
CREATE INDEX ix_case_entities_case_id ON case_entities (case_id);


CREATE TABLE case_mo_tags (
	case_id UUID NOT NULL, 
	mo_tag_id UUID NOT NULL, 
	PRIMARY KEY (case_id, mo_tag_id), 
	CONSTRAINT uq_case_mo_tag UNIQUE (case_id, mo_tag_id), 
	FOREIGN KEY(case_id) REFERENCES crime_cases (id) ON DELETE CASCADE, 
	FOREIGN KEY(mo_tag_id) REFERENCES mo_tags (id) ON DELETE CASCADE
)

;


CREATE TABLE evidence (
	case_id UUID NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	evidence_type VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	created_by VARCHAR(255), 
	assigned_to UUID, 
	storage_path VARCHAR(500), 
	dataset_provenance VARCHAR(20) NOT NULL, 
	source_import_job_id UUID, 
	source_file VARCHAR(500), 
	source_row_ref VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(case_id) REFERENCES crime_cases (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_to) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(source_import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_evidence_case_id ON evidence (case_id);
CREATE INDEX ix_evidence_source_import_job_id ON evidence (source_import_job_id);
CREATE INDEX ix_evidence_assigned_to ON evidence (assigned_to);
CREATE INDEX ix_evidence_dataset_provenance ON evidence (dataset_provenance);


CREATE TABLE firs (
	fir_number VARCHAR(50) NOT NULL, 
	crime_case_id UUID NOT NULL, 
	investigating_officer_id UUID, 
	complainant_name VARCHAR(255) NOT NULL, 
	complainant_contact VARCHAR(20), 
	sections VARCHAR(255), 
	filed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	narrative TEXT, 
	attachments TEXT, 
	dataset_provenance VARCHAR(20) NOT NULL, 
	source_import_job_id UUID, 
	source_file VARCHAR(500), 
	source_row_ref VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(crime_case_id) REFERENCES crime_cases (id) ON DELETE CASCADE, 
	FOREIGN KEY(investigating_officer_id) REFERENCES officers (id) ON DELETE SET NULL, 
	FOREIGN KEY(source_import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL
)

;
CREATE UNIQUE INDEX ix_firs_fir_number ON firs (fir_number);
CREATE INDEX ix_firs_source_import_job_id ON firs (source_import_job_id);
CREATE INDEX ix_firs_investigating_officer_id ON firs (investigating_officer_id);
CREATE INDEX ix_firs_status ON firs (status);
CREATE INDEX ix_firs_crime_case_id ON firs (crime_case_id);
CREATE INDEX ix_firs_dataset_provenance ON firs (dataset_provenance);


CREATE TABLE investigation_notes (
	case_id UUID NOT NULL, 
	officer_id UUID, 
	officer_name VARCHAR(255) NOT NULL, 
	officer_badge VARCHAR(50) NOT NULL, 
	content TEXT NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(case_id) REFERENCES crime_cases (id) ON DELETE CASCADE, 
	FOREIGN KEY(officer_id) REFERENCES officers (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_investigation_notes_officer_id ON investigation_notes (officer_id);
CREATE INDEX ix_investigation_notes_case_id ON investigation_notes (case_id);


CREATE TABLE raw_ingested_data (
	source_type VARCHAR(50) NOT NULL, 
	source_name VARCHAR(255), 
	external_ref VARCHAR(255), 
	title VARCHAR(500), 
	raw_text TEXT, 
	structured_data TEXT, 
	processing_status VARCHAR(30) NOT NULL, 
	record_status VARCHAR(20) NOT NULL, 
	linked_case_id UUID, 
	ingested_by_id UUID, 
	ingested_at TIMESTAMP WITH TIME ZONE, 
	is_demo_derived BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(linked_case_id) REFERENCES crime_cases (id) ON DELETE SET NULL, 
	FOREIGN KEY(ingested_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_raw_ingested_data_source_type ON raw_ingested_data (source_type);
CREATE INDEX ix_raw_ingested_data_processing_status ON raw_ingested_data (processing_status);
CREATE INDEX ix_raw_ingested_data_external_ref ON raw_ingested_data (external_ref);


CREATE TABLE reports (
	template VARCHAR(100) NOT NULL, 
	report_type VARCHAR(50) NOT NULL, 
	title VARCHAR(255), 
	requested_by_id UUID NOT NULL, 
	district VARCHAR(100), 
	date_from TIMESTAMP WITH TIME ZONE, 
	date_to TIMESTAMP WITH TIME ZONE, 
	format VARCHAR(10) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	file_url VARCHAR(500), 
	version INTEGER NOT NULL, 
	case_id UUID, 
	provenance VARCHAR(20) NOT NULL, 
	integrity_hash VARCHAR(64), 
	generation_method VARCHAR(50), 
	analysis_fingerprint VARCHAR(200), 
	failure_reason VARCHAR(500), 
	source_record_count INTEGER NOT NULL, 
	evidence_count INTEGER NOT NULL, 
	generated_at TIMESTAMP WITH TIME ZONE, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	finalized_at TIMESTAMP WITH TIME ZONE, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	reviewed_by_id UUID, 
	finalized_by_id UUID, 
	content_snapshot TEXT, 
	ai_reported BOOLEAN NOT NULL, 
	ai_metadata TEXT, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(requested_by_id) REFERENCES users (id) ON DELETE RESTRICT, 
	FOREIGN KEY(case_id) REFERENCES crime_cases (id) ON DELETE SET NULL, 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(finalized_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_reports_case_id ON reports (case_id);
CREATE INDEX ix_reports_status ON reports (status);
CREATE INDEX ix_reports_provenance ON reports (provenance);
CREATE INDEX ix_reports_requested_by_id ON reports (requested_by_id);
CREATE INDEX ix_reports_status_type ON reports (status, report_type);
CREATE INDEX ix_reports_report_type ON reports (report_type);


CREATE TABLE chain_of_custody (
	evidence_id UUID NOT NULL, 
	from_user UUID, 
	to_user UUID, 
	action VARCHAR(100) NOT NULL, 
	location VARCHAR(255), 
	remarks TEXT, 
	timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id) ON DELETE CASCADE, 
	FOREIGN KEY(from_user) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(to_user) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_chain_of_custody_evidence_id ON chain_of_custody (evidence_id);
CREATE INDEX ix_chain_of_custody_from_user ON chain_of_custody (from_user);
CREATE INDEX ix_chain_of_custody_to_user ON chain_of_custody (to_user);


CREATE TABLE evidence_ai_summary (
	evidence_id UUID NOT NULL, 
	summary TEXT NOT NULL, 
	model VARCHAR(100) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_evidence_ai_summary_evidence_id ON evidence_ai_summary (evidence_id);


CREATE TABLE evidence_assignments (
	evidence_id UUID NOT NULL, 
	assigned_by UUID NOT NULL, 
	assigned_to UUID NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	accepted_at TIMESTAMP WITH TIME ZONE, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_by) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_to) REFERENCES users (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_evidence_assignments_evidence_id ON evidence_assignments (evidence_id);
CREATE INDEX ix_evidence_assignments_assigned_by ON evidence_assignments (assigned_by);
CREATE INDEX ix_evidence_assignments_assigned_to ON evidence_assignments (assigned_to);


CREATE TABLE evidence_metadata (
	evidence_id UUID NOT NULL, 
	filename VARCHAR(255) NOT NULL, 
	filepath VARCHAR(500) NOT NULL, 
	filesize INTEGER NOT NULL, 
	mime_type VARCHAR(100) NOT NULL, 
	uploaded_by VARCHAR(255), 
	storage_url VARCHAR(1000), 
	extracted_data JSON, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id) ON DELETE CASCADE
)

;
CREATE UNIQUE INDEX ix_evidence_metadata_evidence_id ON evidence_metadata (evidence_id);


CREATE TABLE evidence_timeline (
	evidence_id UUID NOT NULL, 
	action VARCHAR(100) NOT NULL, 
	performed_by VARCHAR(255) NOT NULL, 
	role VARCHAR(100) NOT NULL, 
	description TEXT, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_evidence_timeline_evidence_id ON evidence_timeline (evidence_id);


CREATE TABLE fir_criminal_links (
	fir_id UUID NOT NULL, 
	criminal_id UUID NOT NULL, 
	role VARCHAR(50), 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_fir_criminal UNIQUE (fir_id, criminal_id), 
	FOREIGN KEY(fir_id) REFERENCES firs (id) ON DELETE CASCADE, 
	FOREIGN KEY(criminal_id) REFERENCES criminals (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_fir_criminal_links_fir_id ON fir_criminal_links (fir_id);
CREATE INDEX ix_fir_criminal_links_criminal_id ON fir_criminal_links (criminal_id);


CREATE TABLE fir_victim_links (
	fir_id UUID NOT NULL, 
	victim_id UUID NOT NULL, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_fir_victim UNIQUE (fir_id, victim_id), 
	FOREIGN KEY(fir_id) REFERENCES firs (id) ON DELETE CASCADE, 
	FOREIGN KEY(victim_id) REFERENCES victims (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_fir_victim_links_victim_id ON fir_victim_links (victim_id);
CREATE INDEX ix_fir_victim_links_fir_id ON fir_victim_links (fir_id);


CREATE TABLE report_evidence_links (
	report_id UUID NOT NULL, 
	evidence_id UUID NOT NULL, 
	role VARCHAR(30) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(report_id) REFERENCES reports (id) ON DELETE CASCADE, 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_report_evidence_links_report_id ON report_evidence_links (report_id);
CREATE INDEX ix_report_evidence_links_evidence_id ON report_evidence_links (evidence_id);


CREATE TABLE report_source_links (
	report_id UUID NOT NULL, 
	source_type VARCHAR(50) NOT NULL, 
	source_id VARCHAR(100) NOT NULL, 
	source_label VARCHAR(255), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(report_id) REFERENCES reports (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_report_source_link_type_id ON report_source_links (source_type, source_id);
CREATE INDEX ix_report_source_links_report_id ON report_source_links (report_id);


CREATE TABLE report_versions (
	report_id UUID NOT NULL, 
	version_number INTEGER NOT NULL, 
	created_by_id UUID, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	reason VARCHAR(500), 
	status VARCHAR(30) NOT NULL, 
	integrity_hash VARCHAR(64), 
	content_snapshot TEXT, 
	ai_metadata TEXT, 
	id UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(report_id) REFERENCES reports (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_report_versions_report_id ON report_versions (report_id);
CREATE UNIQUE INDEX ix_report_versions_report_num ON report_versions (report_id, version_number);


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

-- â”€â”€ Roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO roles (id, name, description) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin',         'Administrator â€” full control incl. data ingestion'),
    ('a0000000-0000-0000-0000-000000000002', 'crime_analyst', 'Analyst (SCRB) â€” analytics + network analysis'),
    ('a0000000-0000-0000-0000-000000000003', 'investigator',  'Investigator (IO) â€” case/FIR/evidence work'),
    ('a0000000-0000-0000-0000-000000000004', 'policymaker',   'Policymaker (SP) â€” read-only oversight'),
    ('a0000000-0000-0000-0000-000000000005', 'inspector',     'Inspector â€” extended investigation'),
    ('a0000000-0000-0000-0000-000000000006', 'forensic',      'Forensic analyst'),
    ('a0000000-0000-0000-0000-000000000007', 'viewer',        'Read-only viewer')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Users (ADMIN / ANALYST / INVESTIGATOR / VIEWER demo tiers) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO users (id, username, email, full_name, hashed_password, is_active, role_id, district, station) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'admin',     'admin@drishyam.gov.in',     'Platform Administrator', 'sha256$826b1ece4b4fc23b1beb9253266f7f4e$0ed4b9dd7cb98842efd506ab042fe26a5319d3cc1065dd36f3c13a7c0f789bca', TRUE, 'a0000000-0000-0000-0000-000000000001', 'Bengaluru Urban', 'KSP HQ'),
    ('b0000000-0000-0000-0000-000000000002', 'SCRB-7740', 'scrb-7740@drishyam.gov.in', 'DCP Priya Sharma',       'sha256$ae618a1ff52d38bf6d109cc71495bad0$0e75ac02d2d8174217a9055272369cd5aef660231582e85388723cd3b816a0e1', TRUE, 'a0000000-0000-0000-0000-000000000002', 'Bengaluru Urban', 'SCRB HQ'),
    ('b0000000-0000-0000-0000-000000000003', 'IO-3921',   'io-3921@drishyam.gov.in',   'Inspector Ravi Kumar',   'sha256$360a587e137e92dbc7043661f63b2528$9e48cf9bca45d94a55495f53c18fd0ae35717975ab476663da13e6202a445ff7', TRUE, 'a0000000-0000-0000-0000-000000000003', 'Mysuru', 'Devaraja Police Station'),
    ('b0000000-0000-0000-0000-000000000004', 'SP-0088',   'sp-0088@drishyam.gov.in',   'SP Anil Kumble',         'sha256$62d62cb07eaed56d1ba2d32d25809ded$2cc7aa6eec58744c4e6148dce2885bb68b3a1a7ad8cef1423591084b33404068', TRUE, 'a0000000-0000-0000-0000-000000000004', 'State HQ', 'KSP HQ')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO locations (id, district, station, latitude, longitude, state) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Bengaluru Urban', 'Whitefield', 12.9698, 77.7500, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000002', 'Bengaluru Urban', 'KR Puram',   13.0090, 77.6800, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000003', 'Mysuru',          'Devaraja',   12.3052, 76.6552, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000004', 'Mangaluru',       'Pandeshwar', 12.9141, 74.8560, 'Karnataka'),
    ('c0000000-0000-0000-0000-000000000005', 'Belagavi',        'Market PS',  15.8497, 74.4977, 'Karnataka')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Crime categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO crime_categories (id, name, section_code, severity) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'Theft & Burglaries', 'IPC 379', 'medium'),
    ('d0000000-0000-0000-0000-000000000002', 'Narcotics',          'NDPS 21', 'high'),
    ('d0000000-0000-0000-0000-000000000003', 'Assault',            'IPC 323', 'medium'),
    ('d0000000-0000-0000-0000-000000000004', 'Cyber Crime',        'IT 66',   'high'),
    ('d0000000-0000-0000-0000-000000000005', 'Smuggling',          'Customs 132', 'high')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Persons (criminals) â€” two linked networks + one isolated offender â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO criminals (id, full_name, aliases, gender, address, identifying_marks, mo_summary, status, gang_affiliation, dataset_provenance) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'Ramu Swamy',    'RS; Cement Ramu', 'Male', 'Whitefield, Bengaluru',  'Scar over left eyebrow',    'Hits warehouses after midnight, uses stolen trucks.',          'at_large',  'Southside Syndicate', 'demo'),
    ('e0000000-0000-0000-0000-000000000002', 'Vikram Yadav',  'Vicky',           'Male', 'KR Puram, Bengaluru',    'Tattoo on right forearm',   'Coordinates loading crews and fence contacts for stolen goods.', 'at_large', 'Southside Syndicate', 'demo'),
    ('e0000000-0000-0000-0000-000000000003', 'Sayed Ibrahim', 'S I',             'Male', 'Devaraja, Mysuru',       'Missing left little finger','Runs narcotics distribution through highway tea stalls.',      'at_large',  'Highway Ring', 'demo'),
    ('e0000000-0000-0000-0000-000000000004', 'Karthik Gowda', 'KG',              'Male', 'Pandeshwar, Mangaluru',  'None recorded',             'Driver and courier for the smuggling ring.',                   'arrested',  'Highway Ring', 'demo'),
    ('e0000000-0000-0000-0000-000000000005', 'Mohsin Pasha',  'MP',              'Male', 'Market PS, Belagavi',    'Burn scar on right hand',   'Financial handler; routes proceeds through cash couriers.',    'at_large',  'Highway Ring', 'demo'),
    ('e0000000-0000-0000-0000-000000000006', 'Suresh Naik',   '',                'Male', 'Belagavi rural',         'None recorded',             'Repeat burglar; targets isolated farmhouses.',                 'at_large',  NULL, 'demo')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Victims â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO victims (id, full_name, gender, age, contact_number, address, statement, dataset_provenance) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'Lakshmi Devi', 'Female', 52, '9880000101', 'Whitefield, Bengaluru',  'Warehouse stock was lifted over two nights.',       'demo'),
    ('f0000000-0000-0000-0000-000000000002', 'Ramesh Bhat',  'Male',   38, '9880000102', 'Devaraja, Mysuru',       'Saw unknown cars near the stall after closing.',    'demo'),
    ('f0000000-0000-0000-0000-000000000003', 'Anita Shetty', 'Female', 29, '9880000103', 'Pandeshwar, Mangaluru',  'Noticed the same van twice near the port road.',    'demo')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Crime cases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO crime_cases (id, case_number, category_id, location_id, occurred_at, description, mo_tags, status, priority, progress, dataset_provenance) VALUES
    ('10000000-0000-0000-0000-000000000001', 'CR-2026-DEM-001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-07-14 02:30:00+00', 'Warehouse theft of electronic stock at Whitefield.',       'night;warehouse;truck',      'under_investigation', 'high',     35, 'demo'),
    ('10000000-0000-0000-0000-000000000002', 'CR-2026-DEM-002', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', '2026-07-28 21:15:00+00', 'Narcotics recovery near highway tea stall, Mysuru.',       'highway;narcotics;stall',    'under_investigation', 'high',     50, 'demo'),
    ('10000000-0000-0000-0000-000000000003', 'CR-2026-DEM-003', 'd0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', '2026-08-09 03:00:00+00', 'Suspected smuggled goods moved via port road, Mangaluru.', 'port;van;night',             'under_investigation', 'critical', 20, 'demo'),
    ('10000000-0000-0000-0000-000000000004', 'CR-2026-DEM-004', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', '2026-08-19 23:40:00+00', 'Farmhouse burglary series, Belagavi rural.',               'farmhouse;night;lock-break', 'open',                'medium',   10, 'demo')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ FIRs + person links (network edges) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ Evidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO evidence (id, case_id, title, description, evidence_type, status, storage_path, dataset_provenance) VALUES
    ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'EV-DEM-0001', 'digital', 'CCTV clip of truck at gate — Whitefield warehouse gate (scene, 2026-07-14)', 'collected', 'Evidence Locker 1', 'demo'),
    ('12000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'EV-DEM-0002', 'physical', 'Sealed contraband packets — Highway tea stall (recovery, 2026-07-29)', 'collected', 'Evidence Locker 2', 'demo'),
    ('12000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'EV-DEM-0003', 'document', 'Port-gate toll records — Mangaluru toll office (2026-08-11)', 'collected', 'Evidence Locker 3', 'demo')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ SIH26189 intelligence entities: organizations, vehicles, phones, events â”€â”€
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

-- â”€â”€ Unified entity relationships (graph edges; provenance-labelled) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    ('18000000-0000-0000-0000-00000000000e', 'phone', '16000000-0000-0000-0000-000000000003', 'phone', '16000000-0000-0000-0000-000000000004', 'communicated_with', 4.0, 1.0, 'active', 'DIRECT_RECORD', 'cdr_record', '[{"record_type":"cdr","record_id":"1c000000-0000-0000-0000-000000000001","label":"CDR 9880000203 â†’ 9880000204"}]', '2026-08-05 18:00:00+00', '2026-08-09 03:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-00000000000f', 'person', 'e0000000-0000-0000-0000-000000000001', 'event', '17000000-0000-0000-0000-000000000001', 'appeared_in_event', 1.0, 0.9, 'active', 'DIRECT_RECORD', 'surveillance_record', '[]', '2026-07-14 02:00:00+00', '2026-07-14 02:00:00+00', 'b0000000-0000-0000-0000-000000000001'),
    ('18000000-0000-0000-0000-000000000010', 'person', 'e0000000-0000-0000-0000-000000000005', 'person', 'e0000000-0000-0000-0000-000000000002', 'financial_connection', 1.0, 0.55, 'active', 'ANALYTICAL_INFERENCE', 'financial_transaction_record', '[{"record_type":"ingestion_record","record_id":"16000000-0000-0000-0000-000000000004","label":"Cash courier register"}]', '2026-08-10 08:20:00+00', '2026-08-10 08:20:00+00', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Case â†” entity links (Case â†’ Entities â†’ Relationships context) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO case_entities (id, case_id, entity_type, entity_id, role, confidence, notes) VALUES
    ('19000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'person',       'e0000000-0000-0000-0000-000000000001', 'accused', 1.0, NULL),
    ('19000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'person',       'e0000000-0000-0000-0000-000000000002', 'accused', 1.0, NULL),
    ('19000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'vehicle',      '15000000-0000-0000-0000-000000000001', 'vehicle_used', 1.0, 'Truck on CCTV'),
    ('19000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'organization', '14000000-0000-0000-0000-000000000001', 'associated', 0.8, 'Suspected benefiting syndicate'),
    ('19000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'person',       'e0000000-0000-0000-0000-000000000003', 'accused', 1.0, NULL),
    ('19000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'phone',        '16000000-0000-0000-0000-000000000003', 'connected_to_phone', 0.9, NULL)
ON CONFLICT DO NOTHING;

-- â”€â”€ Data sources + ingestion jobs (admin pipeline demo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    ('1c000000-0000-0000-0000-000000000001', 'cdr_record', 'TelCo A July batch', 'CDR-0001', 'CDR 9880000203 â†’ 9880000204',
        NULL,
        '{"caller_number":"9880000203","callee_number":"9880000204","call_direction":"outgoing","duration_seconds":214,"call_timestamp":"2026-08-05T18:00:00Z"}',
        'imported', 'active', NULL, 'b0000000-0000-0000-0000-000000000001', '2026-08-01 06:30:00+00', TRUE),
    ('1c000000-0000-0000-0000-000000000002', 'intelligence_report', 'CID bulletin week 32', 'CID-32-01', 'Smuggling corridor update',
        'Corridor activity along NH-75 remains elevated. A white Maruti Eeco (KA-09-CD-7717) has been observed near the port road twice after midnight. Handlers may be using cash couriers via Belagavi. (Raw text stored verbatim; no NLP extraction performed.)',
        '{"title":"Smuggling corridor update","confidence":0.7}',
        'imported', 'active', '10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-08-08 07:00:00+00', TRUE)
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Suspicious patterns + anomalies (grounded detections) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO suspicious_patterns
    (id, pattern_type, title, description, entities, case_ids, supporting_records, confidence, severity, detection_method, status, is_demo_derived) VALUES
    ('1d000000-0000-0000-0000-000000000001', 'repeated_communication', 'Repeated communications 9880000203 â†’ 9880000204',
        'Number 9880000203 appears in 4 imported CDR records contacting 9880000204. Repeated temporal interaction pattern â€” potential coordination channel. This is a detected pattern, not a confirmed criminal association.',
        '[{"type":"phone","id":"16000000-0000-0000-0000-000000000003","name":"9880000203"},{"type":"phone","id":"16000000-0000-0000-0000-000000000004","name":"9880000204"}]',
        '["10000000-0000-0000-0000-000000000003"]',
        '{"cdr_record_count":4}', 0.75, 'high', 'deterministic_rule', 'detected', TRUE),
    ('1d000000-0000-0000-0000-000000000002', 'cross_case_link', 'Karthik Gowda linked across 2 cases',
        'Person appears in FIR-2026-DEM-003 (narcotics) and FIR-2026-DEM-004 (smuggling) â€” candidate for cross-case network analysis.',
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

-- â”€â”€ Notifications (intelligence alerts) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO notifications (id, recipient_id, title, message, type, severity, created_at, is_read) VALUES
    ('1f000000-0000-0000-0000-000000000001', NULL, 'Suspicious pattern detected', 'Repeated communication channel detected between 9880000203 and 9880000204. Review on the Network page.', 'pattern_alert', 'high',   '2026-08-08 07:05:00+00', FALSE),
    ('1f000000-0000-0000-0000-000000000002', NULL, 'Cross-case connection found', 'Karthik Gowda appears in two active cases. Open the network graph for the shared-case view.',            'intel_alert',   'medium','2026-08-10 08:25:00+00', FALSE)
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Role permissions (SIH26189 tiers; ingestion is admin-only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
