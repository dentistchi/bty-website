-- Production schema subset for the reward-fence PostgREST harness. GENERATED; do not edit.
-- Captured read-only from production (PostgreSQL 17.6, PostgREST 14.5) on 2026-11-01.
-- Source: scripts/qa/reward-fence-prod-schema-export.sql (pg_catalog only; no table rows).
-- Statements: 356; body sha256: 61b8b5d4b0e578862bf8bf0b05d7d2f7e0a256632a5c269892a50cae56e3fe55
create sequence if not exists public.activity_xp_events_id_seq;
create sequence if not exists public.core_xp_ledger_id_seq;
create sequence if not exists public.weekly_xp_id_seq;
create table public.activity_xp_events (id bigint default nextval('activity_xp_events_id_seq'::regclass) not null, user_id uuid not null, activity_type text not null, xp integer default 0 not null, created_at timestamp with time zone default now() not null);
create table public.arena_events (event_id uuid default gen_random_uuid() not null, run_id uuid not null, user_id uuid not null, step integer not null, event_type text not null, scenario_id text not null, choice_id text, follow_up_index integer, xp integer default 0 not null, deltas jsonb, meta jsonb, created_at timestamp with time zone default now() not null);
create table public.arena_leagues (league_id uuid default gen_random_uuid() not null, name text not null, min_lifetime_xp integer default 0 not null, created_at timestamp with time zone default now() not null, start_at timestamp with time zone, end_at timestamp with time zone, season_id uuid, status text);
create table public.arena_profiles (user_id uuid not null, lifetime_xp integer default 0 not null, weekly_xp integer default 0 not null, streak integer default 0 not null, league_id uuid, updated_at timestamp with time zone default now() not null, created_at timestamp with time zone default now() not null, core_xp_total integer default 0 not null, stage integer default 1 not null, code_name text, code_hidden boolean default false not null, core_xp_buffer numeric default 0 not null, tier integer default 0 not null, code_index integer default 0 not null, sub_name text, sub_name_renamed_in_code boolean default false not null, l4_access boolean default false not null, avatar_url text, avatar_character_id text, avatar_outfit_theme text, avatar_character_locked boolean default false not null, sub_name_renamed_at_code_index smallint, avatar_selected_outfit_id text, avatar_accessory_ids text[] default '{}'::text[] not null, avatar_outfit_updated_at timestamp with time zone, avatar_accessories_updated_at timestamp with time zone, display_name text, account_status text default 'ACTIVE'::text not null, lockout_start timestamp with time zone, arena_status text default 'ACTIVE'::text not null, consent_version text, consent_accepted_at timestamp with time zone, consent_locale text default 'en-US'::text, display_name_changed_at_code_index smallint, full_name text, timezone text);
create table public.arena_runs (run_id uuid default gen_random_uuid() not null, user_id uuid not null, scenario_id text not null, locale text, status text default 'IN_PROGRESS'::text not null, started_at timestamp with time zone default now() not null, completed_at timestamp with time zone, total_xp integer default 0 not null, run_type text default 'scenario'::text not null, beginner_maturity_score integer, difficulty text, meta jsonb, acknowledgment_timestamp timestamp with time zone, completion_state text default 'in_progress'::text, pipeline text default 'legacy'::text, current_step integer default 0, reached_step_2_at timestamp with time zone);
create table public.arena_weekly_quest_claims (user_id uuid not null, week_start date not null, quest_type text default 'reflection'::text not null, created_at timestamp with time zone default now() not null);
create table public.bty_action_contracts (id uuid default gen_random_uuid() not null, user_id uuid not null, action_id text not null, required boolean default true not null, action_type text not null, le_activation_type text not null, deadline_at timestamp with time zone not null, verification_type text not null, weight numeric(4,2) not null, reset_eligible boolean default false not null, mode text not null, scenario_id text, session_id text, status text not null, routing_engine_version text default 'bty-routing-v1'::text not null, le_activation_id uuid, chosen_at timestamp with time zone not null, completed_at timestamp with time zone, created_at timestamp with time zone default now() not null, nba_log_id uuid, verification_mode text default 'hybrid'::text not null, completion_method text, qr_token_ref text, secure_link_token text, contract_description text, verified_at timestamp with time zone, submitted_at timestamp with time zone, escalated_at timestamp with time zone, validation_approved_at timestamp with time zone, who text, what text, how text, step_when text, raw_text text, pattern_state_snapshot jsonb, pattern_family text, arena_scenario_id text, primary_choice_id text, committed_at timestamp with time zone, run_id uuid, details jsonb, source text, verification_tier text, verification_status text, verification_confidence text, self_scan_suspected boolean default false, actor_device_fingerprint_hash text, last_reminder_sent_at timestamp with time zone, revision_note text, reviewed_at timestamp with time zone);
create table public.bty_org_memberships (id uuid default gen_random_uuid() not null, user_id uuid not null, organization_id uuid not null, status text default 'active'::text not null, is_primary boolean default false not null, joined_at timestamp with time zone, job_family_key text, primary_role_key text, role_started_at timestamp with time zone, identity_source text not null, source_membership_request_id bigint, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, role_started_on date);
create table public.bty_organizations (id uuid default gen_random_uuid() not null, enterprise_id uuid not null, organization_key text not null, display_name text not null, status text default 'active'::text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.core_xp_ledger (id bigint default nextval('core_xp_ledger_id_seq'::regclass) not null, user_id uuid not null, delta_xp integer not null, source_type text not null, source_id text, created_at timestamp with time zone default now() not null);
create table public.foundry_event_assignment_audit (id uuid default gen_random_uuid() not null, assignment_id uuid, event_id uuid, changed_by uuid, assignment_id_snapshot uuid not null, event_id_snapshot uuid not null, membership_id_snapshot uuid not null, changed_by_snapshot uuid not null, action text not null, prev_status text, new_status text, changed_at timestamp with time zone default now() not null);
create table public.foundry_event_assignments (id uuid default gen_random_uuid() not null, event_id uuid not null, organization_id uuid not null, membership_id uuid, user_id uuid, membership_id_snapshot uuid not null, user_id_snapshot uuid not null, status text default 'assigned'::text not null, assigned_at timestamp with time zone default now() not null, assigned_by uuid, assigned_by_snapshot uuid not null, participant_id uuid, claimed_at timestamp with time zone, completed_at timestamp with time zone, revoked_at timestamp with time zone, updated_at timestamp with time zone default now() not null);
create table public.foundry_event_participants (id uuid default gen_random_uuid() not null, event_id uuid not null, display_name text not null, participant_session_token_hash text not null, status text default 'joined'::text not null, joined_at timestamp with time zone default now() not null, last_seen_at timestamp with time zone default now() not null, removed_at timestamp with time zone, user_id uuid, microsoft_tenant_id text, microsoft_aad_object_id text);
create table public.foundry_event_participation_mode (event_id uuid not null, mode text not null, set_by uuid, set_at timestamp with time zone default now() not null);
create table public.foundry_event_quiz_attempts (id uuid default gen_random_uuid() not null, event_id uuid not null, participant_id uuid not null, answers jsonb not null, correct_count integer not null, total_count integer not null, submitted_at timestamp with time zone default now() not null, created_at timestamp with time zone default now() not null);
create table public.foundry_event_training_progress (id uuid default gen_random_uuid() not null, event_id uuid not null, participant_id uuid not null, video_started_at timestamp with time zone, video_completed_at timestamp with time zone, response_text text, completed_at timestamp with time zone, linked_user_id uuid, xp_awarded_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, completion_state text, reflection jsonb, reflection_version text, reflection_generated_at timestamp with time zone, document_last_page integer, document_pages_viewed jsonb default '[]'::jsonb not null, document_active_read_ms bigint default 0 not null, document_read_completed_at timestamp with time zone, shared_understanding_response text, shared_response_submitted_at timestamp with time zone, host_review_status text, host_reviewed_at timestamp with time zone, host_reviewed_by uuid, host_reviewed_by_snapshot uuid, host_review_note text, decision_response_text text, decision_submitted_at timestamp with time zone, learner_reflection_text text, learner_reflection_submitted_at timestamp with time zone, written_guidance_read_at timestamp with time zone, discussion_self_reported_at timestamp with time zone, claim_secret_hash text, claim_secret_expires_at timestamp with time zone, claim_consumed_at timestamp with time zone, quiz_attempt_id uuid);
create table public.foundry_events (id uuid default gen_random_uuid() not null, owner_user_id uuid not null, title text not null, status text default 'open'::text not null, join_version integer default 1 not null, created_at timestamp with time zone default now() not null, closed_at timestamp with time zone, content_type text default 'youtube'::text not null, program_id uuid);
create table public.foundry_participant_apply_windows (id uuid default gen_random_uuid() not null, organization_id uuid, event_id uuid, progress_id uuid, assignment_id uuid, user_id_snapshot uuid not null, source_training_title text not null, apply_days integer default 7 not null, completed_at timestamp with time zone not null, timezone_snapshot text not null, completion_bty_day date not null, due_bty_day date not null, due_at timestamp with time zone not null, created_at timestamp with time zone default now() not null, action_bty_day date);
create table public.foundry_participant_followup_audit (id uuid default gen_random_uuid() not null, followup_id uuid not null, event_id uuid, user_id_snapshot uuid not null, event_type text not null, previous_status text, new_status text not null, outcome text, actor_user_id uuid, created_at timestamp with time zone default now() not null);
create table public.foundry_participant_followups (id uuid default gen_random_uuid() not null, organization_id uuid, event_id uuid, progress_id uuid, assignment_id uuid, user_id_snapshot uuid not null, source_training_title text not null, follow_up_days integer not null, completed_at timestamp with time zone not null, timezone_snapshot text not null, completion_bty_day date not null, due_bty_day date not null, due_at timestamp with time zone not null, status text default 'PENDING'::text not null, outcome text, responded_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.train_day_completions (user_id uuid not null, day integer not null, completed_at timestamp with time zone default now() not null);
create table public.user_advanced_unlocks (user_id uuid not null, advanced_stat_name text not null, unlocked_at timestamp with time zone default now() not null);
create table public.user_healing_awakening_acts (user_id uuid not null, act_id smallint not null, completed_at timestamp with time zone default now() not null);
create table public.user_healing_milestones (user_id uuid not null, second_awakening_completed_at timestamp with time zone, starter_unlock_granted text);
create table public.weekly_xp (id bigint default nextval('weekly_xp_id_seq'::regclass) not null, user_id uuid not null, league_id uuid, xp_total integer default 0 not null, updated_at timestamp with time zone default now() not null, created_at timestamp with time zone default now() not null);
alter table public.activity_xp_events add constraint activity_xp_events_pkey PRIMARY KEY (id);
alter table public.arena_events add constraint arena_events_pkey PRIMARY KEY (event_id);
alter table public.arena_leagues add constraint arena_leagues_name_key UNIQUE (name);
alter table public.arena_leagues add constraint arena_leagues_pkey PRIMARY KEY (league_id);
alter table public.arena_leagues add constraint arena_leagues_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['active'::text, 'closed'::text]))));
alter table public.arena_profiles add constraint arena_profiles_account_status_check CHECK ((account_status = ANY (ARRAY['ACTIVE'::text, 'LOCKED'::text])));
alter table public.arena_profiles add constraint arena_profiles_arena_status_check CHECK ((arena_status = ANY (ARRAY['ACTIVE'::text, 'EJECTED'::text])));
alter table public.arena_profiles add constraint arena_profiles_pkey PRIMARY KEY (user_id);
alter table public.arena_runs add constraint arena_runs_completion_state_check CHECK ((completion_state = ANY (ARRAY['in_progress'::text, 'locked_step7_abandoned'::text, 'complete_verified'::text])));
alter table public.arena_runs add constraint arena_runs_pipeline_check CHECK ((pipeline = ANY (ARRAY['legacy'::text, 'new'::text])));
alter table public.arena_runs add constraint arena_runs_pkey PRIMARY KEY (run_id);
alter table public.arena_weekly_quest_claims add constraint arena_weekly_quest_claims_pkey PRIMARY KEY (user_id, week_start, quest_type);
alter table public.bty_action_contracts add constraint bty_action_contracts_approved_requires_validation_or_verify CHECK (((status <> 'approved'::text) OR ((verified_at IS NOT NULL) OR (validation_approved_at IS NOT NULL))));
alter table public.bty_action_contracts add constraint bty_action_contracts_approved_requires_verified_at CHECK (((status <> 'approved'::text) OR (verified_at IS NOT NULL)));
alter table public.bty_action_contracts add constraint bty_action_contracts_completion_method_check CHECK (((completion_method IS NULL) OR (completion_method = ANY (ARRAY['qr'::text, 'link'::text]))));
alter table public.bty_action_contracts add constraint bty_action_contracts_le_activation_type_check CHECK ((le_activation_type = ANY (ARRAY['micro_win'::text, 'reset'::text])));
alter table public.bty_action_contracts add constraint bty_action_contracts_mode_check CHECK ((mode = ANY (ARRAY['arena'::text, 'center'::text, 'foundry'::text])));
alter table public.bty_action_contracts add constraint bty_action_contracts_pkey PRIMARY KEY (id);
alter table public.bty_action_contracts add constraint bty_action_contracts_revision_note_check CHECK (((revision_note IS NULL) OR ((btrim(revision_note) <> ''::text) AND (char_length(revision_note) <= 500))));
alter table public.bty_action_contracts add constraint bty_action_contracts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'escalated'::text, 'missed'::text])));
alter table public.bty_action_contracts add constraint bty_action_contracts_user_id_action_id_key UNIQUE (user_id, action_id);
alter table public.bty_action_contracts add constraint bty_action_contracts_verification_mode_check CHECK ((verification_mode = ANY (ARRAY['qr'::text, 'link'::text, 'hybrid'::text])));
alter table public.bty_action_contracts add constraint bty_action_contracts_weight_check CHECK ((weight > (0)::numeric));
alter table public.bty_action_contracts add constraint verification_confidence_check CHECK (((verification_confidence IS NULL) OR (verification_confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'legacy'::text]))));
alter table public.bty_action_contracts add constraint verification_status_check CHECK (((verification_status IS NULL) OR (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]))));
alter table public.bty_action_contracts add constraint verification_tier_check CHECK (((verification_tier IS NULL) OR (verification_tier = ANY (ARRAY['mvp_open'::text, 'member_only'::text, 'manager_only'::text, 'legacy_self_attest'::text]))));
alter table public.bty_action_contracts add constraint verification_type_check CHECK ((verification_type = ANY (ARRAY['action_completed'::text, 'non_event_confirmed'::text, 'manager_reviewed'::text, 'self_attest'::text, 'qr'::text, 'link'::text, 'hybrid'::text, 'qr_peer'::text, 'qr_system'::text, 'qr_location'::text, 'none'::text])));
alter table public.bty_org_memberships add constraint bty_org_membership_family_role_compat CHECK (((job_family_key IS NULL) OR (primary_role_key IS NULL) OR ((((((((((((primary_role_key = 'GENERAL_DENTIST'::text) AND (job_family_key = 'CLINICAL_PROVIDER'::text)) OR ((primary_role_key = 'ORTHODONTIST'::text) AND (job_family_key = 'CLINICAL_PROVIDER'::text))) OR ((primary_role_key = 'DENTAL_ASSISTANT'::text) AND (job_family_key = 'CLINICAL_SUPPORT'::text))) OR ((primary_role_key = 'OFFICE_ADMIN'::text) AND (job_family_key = 'FRONT_OFFICE_ADMIN'::text))) OR ((primary_role_key = 'OFFICE_MANAGER'::text) AND (job_family_key = 'OFFICE_MANAGEMENT'::text))) OR ((primary_role_key = 'AREA_MANAGER'::text) AND (job_family_key = 'REGIONAL_OPERATIONS'::text))) OR ((primary_role_key = 'STATE_REGIONAL_DIRECTOR'::text) AND (job_family_key = 'REGIONAL_OPERATIONS'::text))) OR ((primary_role_key = 'DSO_OPERATIONS_MEMBER'::text) AND (job_family_key = 'ENTERPRISE_OPERATIONS'::text))) OR ((primary_role_key = 'SSO_SUPPORT_SPECIALIST'::text) AND (job_family_key = 'SHARED_SERVICES'::text))) OR ((primary_role_key = 'SSO_IT'::text) AND (job_family_key = 'SHARED_SERVICES'::text))) OR ((primary_role_key = 'SSO_HR'::text) AND (job_family_key = 'SHARED_SERVICES'::text)))));
alter table public.bty_org_memberships add constraint bty_org_membership_identity_source_check CHECK ((identity_source = ANY (ARRAY['legacy_approved_request'::text, 'membership_approval'::text, 'admin_curated'::text])));
alter table public.bty_org_memberships add constraint bty_org_membership_job_family_check CHECK (((job_family_key IS NULL) OR (job_family_key = ANY (ARRAY['CLINICAL_PROVIDER'::text, 'CLINICAL_SUPPORT'::text, 'FRONT_OFFICE_ADMIN'::text, 'OFFICE_MANAGEMENT'::text, 'REGIONAL_OPERATIONS'::text, 'ENTERPRISE_OPERATIONS'::text, 'SHARED_SERVICES'::text]))));
alter table public.bty_org_memberships add constraint bty_org_membership_primary_role_check CHECK (((primary_role_key IS NULL) OR (primary_role_key = ANY (ARRAY['GENERAL_DENTIST'::text, 'ORTHODONTIST'::text, 'DENTAL_ASSISTANT'::text, 'OFFICE_ADMIN'::text, 'OFFICE_MANAGER'::text, 'AREA_MANAGER'::text, 'STATE_REGIONAL_DIRECTOR'::text, 'DSO_OPERATIONS_MEMBER'::text, 'SSO_SUPPORT_SPECIALIST'::text, 'SSO_IT'::text, 'SSO_HR'::text]))));
alter table public.bty_org_memberships add constraint bty_org_membership_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
alter table public.bty_org_memberships add constraint bty_org_membership_user_org_unique UNIQUE (user_id, organization_id);
alter table public.bty_org_memberships add constraint bty_org_memberships_pkey PRIMARY KEY (id);
alter table public.bty_organizations add constraint bty_organizations_ent_key_unique UNIQUE (enterprise_id, organization_key);
alter table public.bty_organizations add constraint bty_organizations_pkey PRIMARY KEY (id);
alter table public.bty_organizations add constraint bty_organizations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
alter table public.core_xp_ledger add constraint core_xp_ledger_pkey PRIMARY KEY (id);
alter table public.foundry_event_assignment_audit add constraint foundry_event_assignment_audit_action_check CHECK ((action = ANY (ARRAY['assign'::text, 'claim'::text, 'complete'::text, 'revoke'::text])));
alter table public.foundry_event_assignment_audit add constraint foundry_event_assignment_audit_pkey PRIMARY KEY (id);
alter table public.foundry_event_assignments add constraint foundry_event_assignment_event_membership_unique UNIQUE (event_id, membership_id_snapshot);
alter table public.foundry_event_assignments add constraint foundry_event_assignment_status_check CHECK ((status = ANY (ARRAY['assigned'::text, 'claimed'::text, 'completed'::text, 'revoked'::text])));
alter table public.foundry_event_assignments add constraint foundry_event_assignments_pkey PRIMARY KEY (id);
alter table public.foundry_event_participants add constraint foundry_event_participants_display_name_len_check CHECK (((char_length(btrim(display_name)) >= 1) AND (char_length(btrim(display_name)) <= 60)));
alter table public.foundry_event_participants add constraint foundry_event_participants_event_id_unique UNIQUE (event_id, id);
alter table public.foundry_event_participants add constraint foundry_event_participants_pkey PRIMARY KEY (id);
alter table public.foundry_event_participants add constraint foundry_event_participants_session_hash_unique UNIQUE (participant_session_token_hash);
alter table public.foundry_event_participants add constraint foundry_event_participants_status_check CHECK ((status = ANY (ARRAY['joined'::text, 'removed'::text])));
alter table public.foundry_event_participation_mode add constraint foundry_event_participation_mode_pkey PRIMARY KEY (event_id);
alter table public.foundry_event_participation_mode add constraint foundry_event_participation_mode_check CHECK ((mode = ANY (ARRAY['open_link'::text, 'assigned_overlay'::text])));
alter table public.foundry_event_quiz_attempts add constraint foundry_event_quiz_attempts_check CHECK ((((total_count >= 1) AND (total_count <= 20)) AND (correct_count <= total_count)));
alter table public.foundry_event_quiz_attempts add constraint foundry_event_quiz_attempts_correct_count_check CHECK ((correct_count >= 0));
alter table public.foundry_event_quiz_attempts add constraint foundry_event_quiz_attempts_event_id_participant_id_key UNIQUE (event_id, participant_id);
alter table public.foundry_event_quiz_attempts add constraint foundry_event_quiz_attempts_id_event_id_participant_id_key UNIQUE (id, event_id, participant_id);
alter table public.foundry_event_quiz_attempts add constraint foundry_event_quiz_attempts_pkey PRIMARY KEY (id);
alter table public.foundry_event_training_progress add constraint foundry_event_training_progress_pkey PRIMARY KEY (id);
alter table public.foundry_event_training_progress add constraint foundry_progress_decision_pair_chk CHECK (((decision_response_text IS NULL) = (decision_submitted_at IS NULL)));
alter table public.foundry_event_training_progress add constraint foundry_progress_learner_reflection_len_chk CHECK (((learner_reflection_text IS NULL) OR ((char_length(btrim(learner_reflection_text)) >= 1) AND (char_length(btrim(learner_reflection_text)) <= 1000))));
alter table public.foundry_event_training_progress add constraint foundry_progress_learner_reflection_pair_chk CHECK (((learner_reflection_text IS NULL) = (learner_reflection_submitted_at IS NULL)));
alter table public.foundry_event_training_progress add constraint foundry_progress_review_needs_shared_check CHECK (((host_review_status IS NULL) OR (shared_understanding_response IS NOT NULL)));
alter table public.foundry_event_training_progress add constraint foundry_progress_review_note_check CHECK (((host_review_note IS NULL) OR ((shared_understanding_response IS NOT NULL) AND ((char_length(btrim(host_review_note)) >= 1) AND (char_length(btrim(host_review_note)) <= 500)))));
alter table public.foundry_event_training_progress add constraint foundry_progress_review_status_shape_check CHECK (((host_review_status IS NULL) OR ((host_review_status = 'NOT_REVIEWED'::text) AND (host_reviewed_at IS NULL) AND (host_reviewed_by IS NULL) AND (host_reviewed_by_snapshot IS NULL)) OR ((host_review_status = ANY (ARRAY['ALIGNED'::text, 'PARTIALLY_CLEAR'::text, 'FOLLOW_UP_NEEDED'::text])) AND (host_reviewed_at IS NOT NULL) AND (host_reviewed_by_snapshot IS NOT NULL))));
alter table public.foundry_event_training_progress add constraint foundry_progress_shared_resp_len_check CHECK (((shared_understanding_response IS NULL) OR ((char_length(btrim(shared_understanding_response)) >= 1) AND (char_length(btrim(shared_understanding_response)) <= 1000))));
alter table public.foundry_event_training_progress add constraint foundry_progress_shared_resp_submitted_check CHECK (((shared_understanding_response IS NULL) = (shared_response_submitted_at IS NULL)));
alter table public.foundry_event_training_progress add constraint foundry_training_progress_completed_needs_evidence_or_quiz_atte CHECK (((completed_at IS NULL) OR (((video_completed_at IS NOT NULL) OR (document_read_completed_at IS NOT NULL) OR (written_guidance_read_at IS NOT NULL) OR (discussion_self_reported_at IS NOT NULL)) AND (((response_text IS NOT NULL) AND ((char_length(btrim(response_text)) >= 1) AND (char_length(btrim(response_text)) <= 1000))) OR (quiz_attempt_id IS NOT NULL)))));
alter table public.foundry_event_training_progress add constraint foundry_training_progress_completion_state_check CHECK (((completion_state IS NULL) OR (completion_state = ANY (ARRAY['pass'::text, 'review'::text, 'incomplete'::text]))));
alter table public.foundry_event_training_progress add constraint foundry_training_progress_document_active_read_ms_check CHECK ((document_active_read_ms >= 0));
alter table public.foundry_event_training_progress add constraint foundry_training_progress_document_last_page_check CHECK (((document_last_page IS NULL) OR ((document_last_page >= 1) AND (document_last_page <= 2000))));
alter table public.foundry_event_training_progress add constraint foundry_training_progress_response_len_check CHECK (((response_text IS NULL) OR ((char_length(btrim(response_text)) >= 1) AND (char_length(btrim(response_text)) <= 1000))));
alter table public.foundry_event_training_progress add constraint foundry_training_progress_unique UNIQUE (event_id, participant_id);
alter table public.foundry_event_training_progress add constraint foundry_training_progress_xp_needs_complete_check CHECK (((xp_awarded_at IS NULL) OR (completed_at IS NOT NULL)));
alter table public.foundry_events add constraint foundry_events_content_type_check CHECK ((content_type = ANY (ARRAY['youtube'::text, 'document'::text, 'written_guidance'::text, 'live_discussion'::text])));
alter table public.foundry_events add constraint foundry_events_join_version_check CHECK ((join_version >= 1));
alter table public.foundry_events add constraint foundry_events_pkey PRIMARY KEY (id);
alter table public.foundry_events add constraint foundry_events_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));
alter table public.foundry_events add constraint foundry_events_title_len_check CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 80)));
alter table public.foundry_participant_apply_windows add constraint foundry_apply_window_action_day_check CHECK (((action_bty_day IS NULL) OR ((action_bty_day >= completion_bty_day) AND (action_bty_day < due_bty_day))));
alter table public.foundry_participant_apply_windows add constraint foundry_apply_window_days_check CHECK ((apply_days = 7));
alter table public.foundry_participant_apply_windows add constraint foundry_apply_window_order_check CHECK ((due_bty_day > completion_bty_day));
alter table public.foundry_participant_apply_windows add constraint foundry_apply_window_title_len_check CHECK (((char_length(btrim(source_training_title)) >= 1) AND (char_length(btrim(source_training_title)) <= 300)));
alter table public.foundry_participant_apply_windows add constraint foundry_apply_window_unique_progress UNIQUE (progress_id);
alter table public.foundry_participant_apply_windows add constraint foundry_participant_apply_windows_pkey PRIMARY KEY (id);
alter table public.foundry_participant_followup_audit add constraint foundry_followup_audit_event_type_check CHECK ((event_type = ANY (ARRAY['CREATED'::text, 'RESPONDED'::text])));
alter table public.foundry_participant_followup_audit add constraint foundry_participant_followup_audit_pkey PRIMARY KEY (id);
alter table public.foundry_participant_followups add constraint foundry_followup_days_check CHECK ((follow_up_days = ANY (ARRAY[7, 30])));
alter table public.foundry_participant_followups add constraint foundry_followup_outcome_shape_check CHECK ((((status = 'PENDING'::text) AND (outcome IS NULL)) OR ((status = 'RESPONDED'::text) AND (outcome = ANY (ARRAY['APPLIED'::text, 'PARTLY_APPLIED'::text, 'NOT_YET'::text, 'BLOCKED'::text])))));
alter table public.foundry_participant_followups add constraint foundry_followup_responded_at_shape_check CHECK ((((status = 'PENDING'::text) AND (responded_at IS NULL)) OR ((status = 'RESPONDED'::text) AND (responded_at IS NOT NULL))));
alter table public.foundry_participant_followups add constraint foundry_followup_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'RESPONDED'::text])));
alter table public.foundry_participant_followups add constraint foundry_followup_title_len_check CHECK (((char_length(btrim(source_training_title)) >= 1) AND (char_length(btrim(source_training_title)) <= 300)));
alter table public.foundry_participant_followups add constraint foundry_followup_unique_progress_checkpoint UNIQUE (progress_id, follow_up_days);
alter table public.foundry_participant_followups add constraint foundry_participant_followups_pkey PRIMARY KEY (id);
alter table public.train_day_completions add constraint train_day_completions_day_check CHECK (((day >= 1) AND (day <= 28)));
alter table public.train_day_completions add constraint train_day_completions_pkey PRIMARY KEY (user_id, day);
alter table public.user_advanced_unlocks add constraint user_advanced_unlocks_advanced_stat_name_check CHECK ((advanced_stat_name = ANY (ARRAY['PRM'::text, 'SAG'::text, 'EL'::text, 'CNS'::text, 'CD'::text, 'IS'::text])));
alter table public.user_advanced_unlocks add constraint user_advanced_unlocks_pkey PRIMARY KEY (user_id, advanced_stat_name);
alter table public.user_healing_awakening_acts add constraint user_healing_awakening_acts_act_id_check CHECK (((act_id >= 1) AND (act_id <= 3)));
alter table public.user_healing_awakening_acts add constraint user_healing_awakening_acts_pkey PRIMARY KEY (user_id, act_id);
alter table public.user_healing_milestones add constraint user_healing_milestones_pkey PRIMARY KEY (user_id);
alter table public.user_healing_milestones add constraint user_healing_milestones_starter_unlock_granted_check CHECK (((starter_unlock_granted IS NULL) OR (starter_unlock_granted = ANY (ARRAY['PRM'::text, 'SAG'::text]))));
alter table public.weekly_xp add constraint weekly_xp_pkey PRIMARY KEY (id);
alter table public.activity_xp_events add constraint activity_xp_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.arena_events add constraint arena_events_run_id_fkey FOREIGN KEY (run_id) REFERENCES arena_runs(run_id) ON DELETE CASCADE;
alter table public.arena_events add constraint arena_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.arena_profiles add constraint arena_profiles_league_id_fkey FOREIGN KEY (league_id) REFERENCES arena_leagues(league_id);
alter table public.arena_profiles add constraint arena_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.arena_runs add constraint arena_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.arena_weekly_quest_claims add constraint arena_weekly_quest_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.bty_action_contracts add constraint bty_action_contracts_run_id_fkey FOREIGN KEY (run_id) REFERENCES arena_runs(run_id) ON DELETE SET NULL;
alter table public.bty_action_contracts add constraint bty_action_contracts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.bty_org_memberships add constraint bty_org_memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES bty_organizations(id) ON DELETE RESTRICT;
alter table public.bty_org_memberships add constraint bty_org_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.core_xp_ledger add constraint core_xp_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.foundry_event_assignment_audit add constraint foundry_event_assignment_audit_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES foundry_event_assignments(id) ON DELETE SET NULL;
alter table public.foundry_event_assignment_audit add constraint foundry_event_assignment_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.foundry_event_assignment_audit add constraint foundry_event_assignment_audit_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE SET NULL;
alter table public.foundry_event_assignments add constraint foundry_event_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.foundry_event_assignments add constraint foundry_event_assignments_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE CASCADE;
alter table public.foundry_event_assignments add constraint foundry_event_assignments_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES bty_org_memberships(id) ON DELETE SET NULL;
alter table public.foundry_event_assignments add constraint foundry_event_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES bty_organizations(id) ON DELETE RESTRICT;
alter table public.foundry_event_assignments add constraint foundry_event_assignments_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES foundry_event_participants(id) ON DELETE SET NULL;
alter table public.foundry_event_assignments add constraint foundry_event_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.foundry_event_participants add constraint foundry_event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE CASCADE;
alter table public.foundry_event_participants add constraint foundry_event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.foundry_event_participation_mode add constraint foundry_event_participation_mode_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE CASCADE;
alter table public.foundry_event_participation_mode add constraint foundry_event_participation_mode_set_by_fkey FOREIGN KEY (set_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.foundry_event_quiz_attempts add constraint foundry_event_quiz_attempts_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE RESTRICT;
alter table public.foundry_event_quiz_attempts add constraint foundry_event_quiz_attempts_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES foundry_event_participants(id) ON DELETE RESTRICT;
alter table public.foundry_event_training_progress add constraint foundry_event_training_progress_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE CASCADE;
alter table public.foundry_event_training_progress add constraint foundry_event_training_progress_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.foundry_event_training_progress add constraint foundry_event_training_progress_host_reviewed_by_fkey FOREIGN KEY (host_reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.foundry_event_training_progress add constraint foundry_training_progress_participant_fk FOREIGN KEY (event_id, participant_id) REFERENCES foundry_event_participants(event_id, id) ON DELETE CASCADE;
alter table public.foundry_event_training_progress add constraint foundry_training_progress_quiz_attempt_fk FOREIGN KEY (quiz_attempt_id, event_id, participant_id) REFERENCES foundry_event_quiz_attempts(id, event_id, participant_id) ON DELETE RESTRICT;
alter table public.foundry_events add constraint foundry_events_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.foundry_participant_apply_windows add constraint foundry_participant_apply_windows_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE SET NULL;
alter table public.foundry_participant_apply_windows add constraint foundry_participant_apply_windows_progress_id_fkey FOREIGN KEY (progress_id) REFERENCES foundry_event_training_progress(id) ON DELETE SET NULL;
alter table public.foundry_participant_apply_windows add constraint foundry_participant_apply_windows_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES foundry_event_assignments(id) ON DELETE SET NULL;
alter table public.foundry_participant_followups add constraint foundry_participant_followups_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES foundry_event_assignments(id) ON DELETE SET NULL;
alter table public.foundry_participant_followups add constraint foundry_participant_followups_event_id_fkey FOREIGN KEY (event_id) REFERENCES foundry_events(id) ON DELETE SET NULL;
alter table public.foundry_participant_followups add constraint foundry_participant_followups_progress_id_fkey FOREIGN KEY (progress_id) REFERENCES foundry_event_training_progress(id) ON DELETE SET NULL;
alter table public.train_day_completions add constraint train_day_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_advanced_unlocks add constraint user_advanced_unlocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_healing_awakening_acts add constraint user_healing_awakening_acts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_healing_milestones add constraint user_healing_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.weekly_xp add constraint weekly_xp_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- omitted FK outside export: FOREIGN KEY (season_id) REFERENCES arena_seasons(season_id) ON DELETE SET NULL
-- omitted FK outside export: FOREIGN KEY (le_activation_id) REFERENCES le_activation_log(activation_id) ON DELETE SET NULL
-- omitted FK outside export: FOREIGN KEY (source_membership_request_id) REFERENCES arena_membership_requests(id) ON DELETE SET NULL
-- omitted FK outside export: FOREIGN KEY (enterprise_id) REFERENCES bty_enterprises(id) ON DELETE RESTRICT
-- omitted FK outside export: FOREIGN KEY (program_id) REFERENCES foundry_programs(id) ON DELETE SET NULL
CREATE INDEX activity_xp_events_user_created_idx ON public.activity_xp_events USING btree (user_id, created_at DESC);
CREATE INDEX arena_events_run_created_idx ON public.arena_events USING btree (run_id, created_at);
CREATE UNIQUE INDEX arena_events_run_level_verified_uq ON public.arena_events USING btree (user_id, run_id) WHERE (event_type = 'RUN_LEVEL_VERIFIED_APPLIED'::text);
CREATE INDEX arena_events_user_created_idx ON public.arena_events USING btree (user_id, created_at DESC);
CREATE INDEX arena_leagues_season_id_idx ON public.arena_leagues USING btree (season_id) WHERE (season_id IS NOT NULL);
CREATE INDEX arena_leagues_status_idx ON public.arena_leagues USING btree (status) WHERE (status = 'active'::text);
CREATE INDEX arena_leagues_window_idx ON public.arena_leagues USING btree (start_at, end_at) WHERE ((start_at IS NOT NULL) AND (end_at IS NOT NULL));
CREATE INDEX arena_runs_user_started_idx ON public.arena_runs USING btree (user_id, started_at DESC);
CREATE INDEX arena_weekly_quest_claims_user_week_idx ON public.arena_weekly_quest_claims USING btree (user_id, week_start);
CREATE INDEX bty_action_contracts_activation_idx ON public.bty_action_contracts USING btree (le_activation_id) WHERE (le_activation_id IS NOT NULL);
CREATE INDEX bty_action_contracts_nba_log_id_idx ON public.bty_action_contracts USING btree (nba_log_id) WHERE (nba_log_id IS NOT NULL);
CREATE INDEX bty_action_contracts_run_id_idx ON public.bty_action_contracts USING btree (run_id);
CREATE INDEX bty_action_contracts_source_idx ON public.bty_action_contracts USING btree (source);
CREATE UNIQUE INDEX bty_action_contracts_user_family_open_unique ON public.bty_action_contracts USING btree (user_id, pattern_family) WHERE ((pattern_family IS NOT NULL) AND (status = ANY (ARRAY['draft'::text, 'committed'::text, 'pending'::text, 'submitted'::text, 'escalated'::text])));
CREATE INDEX bty_action_contracts_user_status_deadline_idx ON public.bty_action_contracts USING btree (user_id, status, deadline_at DESC);
CREATE INDEX bty_action_contracts_user_status_idx ON public.bty_action_contracts USING btree (user_id, status, deadline_at DESC);
CREATE UNIQUE INDEX bty_org_membership_one_active_primary ON public.bty_org_memberships USING btree (user_id) WHERE ((status = 'active'::text) AND (is_primary = true));
CREATE INDEX bty_org_membership_org_idx ON public.bty_org_memberships USING btree (organization_id);
CREATE INDEX bty_org_membership_user_idx ON public.bty_org_memberships USING btree (user_id);
CREATE INDEX bty_organizations_enterprise_idx ON public.bty_organizations USING btree (enterprise_id);
CREATE UNIQUE INDEX core_xp_ledger_source_idempotent_uq ON public.core_xp_ledger USING btree (source_type, source_id) WHERE (source_id IS NOT NULL);
CREATE INDEX core_xp_ledger_user_created_idx ON public.core_xp_ledger USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX core_xp_ledger_user_source_uq ON public.core_xp_ledger USING btree (user_id, source_type, source_id) WHERE (source_id IS NOT NULL);
CREATE INDEX foundry_apply_windows_event_idx ON public.foundry_participant_apply_windows USING btree (event_id);
CREATE INDEX foundry_apply_windows_owner_due_idx ON public.foundry_participant_apply_windows USING btree (user_id_snapshot, due_at);
CREATE INDEX foundry_event_assignment_audit_assignment_idx ON public.foundry_event_assignment_audit USING btree (assignment_id_snapshot, changed_at DESC);
CREATE INDEX foundry_event_assignment_event_idx ON public.foundry_event_assignments USING btree (event_id);
CREATE UNIQUE INDEX foundry_event_assignment_one_claim_per_participant ON public.foundry_event_assignments USING btree (event_id, participant_id) WHERE (participant_id IS NOT NULL);
CREATE INDEX foundry_event_assignment_user_idx ON public.foundry_event_assignments USING btree (user_id_snapshot);
CREATE INDEX foundry_event_participants_event_joined_idx ON public.foundry_event_participants USING btree (event_id, joined_at);
CREATE INDEX foundry_event_participants_event_user_idx ON public.foundry_event_participants USING btree (event_id, user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX foundry_event_participants_microsoft_identity_uidx ON public.foundry_event_participants USING btree (event_id, microsoft_tenant_id, microsoft_aad_object_id) WHERE ((microsoft_tenant_id IS NOT NULL) AND (microsoft_aad_object_id IS NOT NULL));
CREATE INDEX foundry_event_quiz_attempts_event_idx ON public.foundry_event_quiz_attempts USING btree (event_id);
CREATE INDEX foundry_events_owner_created_idx ON public.foundry_events USING btree (owner_user_id, created_at DESC);
CREATE INDEX foundry_events_program_idx ON public.foundry_events USING btree (program_id) WHERE (program_id IS NOT NULL);
CREATE INDEX foundry_events_status_idx ON public.foundry_events USING btree (status);
CREATE INDEX foundry_followup_audit_followup_idx ON public.foundry_participant_followup_audit USING btree (followup_id, created_at DESC);
CREATE INDEX foundry_followups_event_idx ON public.foundry_participant_followups USING btree (event_id);
CREATE INDEX foundry_followups_owner_due_idx ON public.foundry_participant_followups USING btree (user_id_snapshot, status, due_at);
CREATE UNIQUE INDEX foundry_progress_active_claim_hash_uidx ON public.foundry_event_training_progress USING btree (claim_secret_hash) WHERE ((claim_secret_hash IS NOT NULL) AND (claim_consumed_at IS NULL));
CREATE INDEX foundry_training_progress_event_idx ON public.foundry_event_training_progress USING btree (event_id);
CREATE UNIQUE INDEX foundry_training_progress_event_user_unique_idx ON public.foundry_event_training_progress USING btree (event_id, linked_user_id) WHERE (linked_user_id IS NOT NULL);
CREATE INDEX foundry_training_progress_participant_idx ON public.foundry_event_training_progress USING btree (participant_id);
CREATE INDEX idx_bty_action_contracts_verification_status ON public.bty_action_contracts USING btree (verification_status) WHERE (verification_status IS NOT NULL);
CREATE INDEX idx_bty_action_contracts_verification_tier ON public.bty_action_contracts USING btree (verification_tier) WHERE (verification_tier IS NOT NULL);
CREATE INDEX train_day_completions_user_idx ON public.train_day_completions USING btree (user_id);
CREATE INDEX user_advanced_unlocks_user_idx ON public.user_advanced_unlocks USING btree (user_id);
CREATE INDEX weekly_xp_league_xp_desc_idx ON public.weekly_xp USING btree (league_id, xp_total DESC) WHERE (league_id IS NOT NULL);
CREATE INDEX weekly_xp_user_league_idx ON public.weekly_xp USING btree (user_id, league_id);
CREATE UNIQUE INDEX weekly_xp_user_league_uq ON public.weekly_xp USING btree (user_id, league_id) WHERE (league_id IS NOT NULL);
CREATE UNIQUE INDEX weekly_xp_user_null_league_uq ON public.weekly_xp USING btree (user_id) WHERE (league_id IS NULL);
CREATE OR REPLACE FUNCTION public.bty_foundry_award_daily_capped(p_user_id uuid, p_event_id uuid, p_source_id text, p_xp integer, p_day_start timestamp with time zone, p_day_end timestamp with time zone, p_max_per_day integer DEFAULT 3)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int;
begin
  -- Serialize this (user, BTY-day) so the count+insert below is race-safe.
  -- Single 64-bit key form: hashtextextended returns bigint, matching
  -- pg_advisory_xact_lock(bigint) (the two-arg form takes int4, int4).
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || to_char(p_day_start at time zone 'UTC', 'YYYY-MM-DD'), 0)
  );

  -- (1) Idempotency per completion.
  if exists (
    select 1 from public.core_xp_ledger
    where source_type = 'foundry_training_completion' and source_id = p_source_id
  ) then
    return 'already_awarded';
  end if;

  -- (2) One award per (user, event) — a user cannot re-earn the same event's XP
  -- via a second participant/session.
  if exists (
    select 1
    from public.core_xp_ledger l
    join public.foundry_event_training_progress pr on pr.id::text = l.source_id
    where l.source_type = 'foundry_training_completion'
      and l.user_id = p_user_id
      and pr.event_id = p_event_id
  ) then
    return 'event_already_awarded';
  end if;

  -- (3) Per-canonical-BTY-day cap.
  select count(*) into v_count
  from public.core_xp_ledger
  where user_id = p_user_id
    and source_type = 'foundry_training_completion'
    and created_at >= p_day_start
    and created_at < p_day_end;

  if v_count >= p_max_per_day then
    return 'daily_limit';
  end if;

  insert into public.core_xp_ledger (user_id, delta_xp, source_type, source_id)
  values (p_user_id, p_xp, 'foundry_training_completion', p_source_id);

  return 'awarded';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.bty_foundry_claim_assignment(p_event_id uuid, p_participant_id uuid, p_auth_user_id uuid)
 RETURNS TABLE(result text, assignment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_row public.foundry_event_assignments%rowtype;
  v_is_assigned boolean;
begin
  select * into v_row
    from public.foundry_event_assignments a
   where a.event_id = p_event_id
     and a.user_id_snapshot = p_auth_user_id
     and a.status <> 'revoked'
   for update;

  if not found then
    -- Distinguish "assigned event, wrong account" from "open-link room".
    select exists (
      select 1 from public.foundry_event_participation_mode m
       where m.event_id = p_event_id and m.mode = 'assigned_overlay'
    ) into v_is_assigned;
    result := case when v_is_assigned then 'no_matching_assignment' else 'not_applicable' end;
    assignment_id := null;
    return next;
    return;
  end if;

  if v_row.participant_id is not null then
    if v_row.participant_id = p_participant_id then
      result := 'already_claimed';
      assignment_id := v_row.id;
      return next;
      return;
    else
      result := 'claim_conflict';
      assignment_id := v_row.id;
      return next;
      return;
    end if;
  end if;

  update public.foundry_event_assignments
     set participant_id = p_participant_id,
         claimed_at = now(),
         completed_at = now(),
         status = 'completed',
         updated_at = now()
   where id = v_row.id;

  insert into public.foundry_event_assignment_audit (
    assignment_id, event_id, changed_by,
    assignment_id_snapshot, event_id_snapshot, membership_id_snapshot, changed_by_snapshot,
    action, prev_status, new_status
  ) values (
    v_row.id, p_event_id, p_auth_user_id,
    v_row.id, p_event_id, v_row.membership_id_snapshot, p_auth_user_id,
    'complete', v_row.status, 'completed'
  );

  result := 'claimed';
  assignment_id := v_row.id;
  return next;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.bty_foundry_materialize_apply_window(p_event_id uuid, p_progress_id uuid, p_assignment_id uuid, p_organization_id uuid, p_user_id_snapshot uuid, p_source_training_title text, p_apply_days integer, p_completed_at timestamp with time zone, p_timezone_snapshot text, p_completion_bty_day date, p_due_bty_day date, p_due_at timestamp with time zone, p_action_bty_day date DEFAULT NULL::date)
 RETURNS TABLE(result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_new_id uuid;
begin
  if p_apply_days is distinct from 7 then
    return query select 'skipped'::text;
    return;
  end if;
  if p_user_id_snapshot is null or p_progress_id is null then
    return query select 'skipped'::text;
    return;
  end if;
  if p_due_bty_day is null or p_completion_bty_day is null or p_due_bty_day <= p_completion_bty_day then
    return query select 'skipped'::text;
    return;
  end if;
  -- The caller resolves the day; a day outside the window is a caller bug, never a silent clamp.
  if p_action_bty_day is not null
     and (p_action_bty_day < p_completion_bty_day or p_action_bty_day >= p_due_bty_day) then
    raise exception 'invalid_action_day' using errcode = '22023';
  end if;

  insert into public.foundry_participant_apply_windows (
    organization_id, event_id, progress_id, assignment_id, user_id_snapshot,
    source_training_title, apply_days, completed_at,
    timezone_snapshot, completion_bty_day, due_bty_day, due_at, action_bty_day
  )
  values (
    p_organization_id, p_event_id, p_progress_id, p_assignment_id, p_user_id_snapshot,
    btrim(p_source_training_title), p_apply_days, p_completed_at,
    p_timezone_snapshot, p_completion_bty_day, p_due_bty_day, p_due_at, p_action_bty_day
  )
  on conflict (progress_id) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    return query select 'exists'::text;
    return;
  end if;

  return query select 'created'::text;
end
$function$
;
CREATE OR REPLACE FUNCTION public.bty_foundry_materialize_followup(p_event_id uuid, p_progress_id uuid, p_assignment_id uuid, p_organization_id uuid, p_user_id_snapshot uuid, p_source_training_title text, p_follow_up_days integer, p_completed_at timestamp with time zone, p_timezone_snapshot text, p_completion_bty_day date, p_due_bty_day date, p_due_at timestamp with time zone)
 RETURNS TABLE(result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_new_id uuid;
begin
  if p_follow_up_days not in (7, 30) then
    return query select 'skipped'::text;
    return;
  end if;
  if p_user_id_snapshot is null or p_progress_id is null then
    return query select 'skipped'::text;
    return;
  end if;

  insert into public.foundry_participant_followups (
    organization_id, event_id, progress_id, assignment_id, user_id_snapshot,
    source_training_title, follow_up_days, completed_at,
    timezone_snapshot, completion_bty_day, due_bty_day, due_at,
    status
  )
  values (
    p_organization_id, p_event_id, p_progress_id, p_assignment_id, p_user_id_snapshot,
    btrim(p_source_training_title), p_follow_up_days, p_completed_at,
    p_timezone_snapshot, p_completion_bty_day, p_due_bty_day, p_due_at,
    'PENDING'
  )
  on conflict (progress_id, follow_up_days) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    return query select 'exists'::text;
    return;
  end if;

  insert into public.foundry_participant_followup_audit
    (followup_id, event_id, user_id_snapshot, event_type, previous_status, new_status, outcome, actor_user_id)
  values
    (v_new_id, p_event_id, p_user_id_snapshot, 'CREATED', null, 'PENDING', null, p_user_id_snapshot);

  return query select 'created'::text;
end
$function$
;
CREATE OR REPLACE FUNCTION public.bty_foundry_redeem_completion_claim(p_claim_hash text, p_user_id uuid, p_timezone text, p_source_training_title text, p_assignment_id uuid, p_organization_id uuid, p_follow_up_days integer, p_fu_completion_bty_day date, p_fu_due_bty_day date, p_fu_due_at timestamp with time zone, p_apply_days integer, p_ap_completion_bty_day date, p_ap_due_bty_day date, p_ap_due_at timestamp with time zone, p_xp integer, p_xp_eligible boolean, p_day_start timestamp with time zone, p_day_end timestamp with time zone)
 RETURNS TABLE(progress_id uuid, event_id uuid, xp_result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
#variable_conflict use_column
declare
  v_progress_id uuid;
  v_event_id uuid;
  v_participant_id uuid;
  v_completed_at timestamptz;
  v_xp_awarded_at timestamptz;
  v_participant_user uuid;
  v_result text;
  v_xp_result text := 'not_attempted';
begin
  /*
    1. LOCATE AND LOCK. Every precondition is in this predicate, so a concurrent redemption is
       decided by the row lock: one caller holds it, the other finds nothing and is refused.
  */
  select p.id, p.event_id, p.participant_id, p.completed_at, p.xp_awarded_at
    into v_progress_id, v_event_id, v_participant_id, v_completed_at, v_xp_awarded_at
    from public.foundry_event_training_progress p
   where p.claim_secret_hash = p_claim_hash
     and p.completed_at is not null
     and p.linked_user_id is null
     and p.claim_consumed_at is null
     and p.claim_secret_expires_at is not null
     and p.claim_secret_expires_at > now()
   for update;

  if v_progress_id is null then
    return;  -- no row, nothing locked, nothing written
  end if;

  /*
    2. ACCOUNT ATTRIBUTION, unchanged from `mayAttributeToAccount`: an anonymous participant is
       never a conflict, the same account is allowed, a different account is refused. No Host
       override exists here and none is added. Refusal happens before any mutation.
  */
  select fp.user_id into v_participant_user
    from public.foundry_event_participants fp
   where fp.id = v_participant_id;

  if v_participant_user is not null and v_participant_user <> p_user_id then
    return;
  end if;

  -- 3. OWNERSHIP.
  update public.foundry_event_training_progress
     set linked_user_id = p_user_id, updated_at = now()
   where id = v_progress_id;

  -- 4. ASSIGNMENT. `not_applicable` is a truthful outcome for open-link learning, not a failure.
  perform public.bty_foundry_claim_assignment(v_event_id, v_participant_id, p_user_id);

  -- 5. FOLLOW-UP, when this training owes one.
  if p_follow_up_days is not null then
    select result into v_result from public.bty_foundry_materialize_followup(
      v_event_id, v_progress_id, p_assignment_id, p_organization_id, p_user_id,
      p_source_training_title, p_follow_up_days, v_completed_at, p_timezone,
      p_fu_completion_bty_day, p_fu_due_bty_day, p_fu_due_at
    );
    if v_result is distinct from 'created' and v_result is distinct from 'exists' then
      raise exception 'claim_followup_unexpected: %', coalesce(v_result, 'null');
    end if;
  end if;

  -- 6. APPLY WINDOW, when this training owes one.
  if p_apply_days is not null then
    select result into v_result from public.bty_foundry_materialize_apply_window(
      v_event_id, v_progress_id, p_assignment_id, p_organization_id, p_user_id,
      p_source_training_title, p_apply_days, v_completed_at, p_timezone,
      p_ap_completion_bty_day, p_ap_due_bty_day, p_ap_due_at
    );
    if v_result is distinct from 'created' and v_result is distinct from 'exists' then
      raise exception 'claim_apply_unexpected: %', coalesce(v_result, 'null');
    end if;
  end if;

  /*
    7. XP, ONCE. The existing daily-capped ledger function is the only authority; `daily_limit`,
       `already_awarded` and `event_already_awarded` are all truthful non-awards under the shipped
       contract and must not fail the claim. `xp_awarded_at` is stamped only on a real award, by
       the same predicate the room path uses.
  */
  if p_xp_eligible and v_xp_awarded_at is null then
    v_xp_result := public.bty_foundry_award_daily_capped(
      p_user_id, v_event_id, v_progress_id::text, p_xp, p_day_start, p_day_end
    );
    if v_xp_result = 'awarded' then
      update public.foundry_event_training_progress
         set xp_awarded_at = now()
       where id = v_progress_id and xp_awarded_at is null;
    end if;
  elsif v_xp_awarded_at is not null then
    v_xp_result := 'already_awarded';
  else
    v_xp_result := 'owner_ineligible';
  end if;

  /*
    8. CONSUME LAST. A code is terminally spent if and only if the claim has fully converged —
       every statement above committed, or this one never runs.
  */
  update public.foundry_event_training_progress
     set claim_consumed_at = now()
   where id = v_progress_id;

  return query select v_progress_id, v_event_id, v_xp_result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_avatar_character_lock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (old.avatar_character_locked = true) then
    if (new.avatar_character_id is distinct from old.avatar_character_id) then
      raise exception 'avatar_character_id is locked';
    end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.ensure_arena_profile()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.arena_profiles(user_id) values (auth.uid())
  on conflict (user_id) do nothing;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_arena_xp(p_user_id uuid, p_run_id uuid, p_xp integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_xp is null or p_xp <= 0 then return; end if;
  update public.arena_profiles set lifetime_xp = lifetime_xp + p_xp, weekly_xp = weekly_xp + p_xp, updated_at = now() where user_id = p_user_id;
  update public.arena_runs set total_xp = total_xp + p_xp where run_id = p_run_id and user_id = p_user_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_weekly_xp(p_user_id uuid, p_league_id uuid, p_delta integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total int;
begin
  if p_user_id is null then
    raise exception 'increment_weekly_xp: p_user_id is required';
  end if;

  -- No-op deltas: return the current total without writing.
  if p_delta is null or p_delta = 0 then
    select xp_total into v_total
      from public.weekly_xp
     where user_id = p_user_id
       and league_id is not distinct from p_league_id;
    return coalesce(v_total, 0);
  end if;

  -- league_id NULL = global pool; matches partial unique index
  -- weekly_xp_user_null_league_uq (user_id) WHERE league_id IS NULL.
  if p_league_id is null then
    insert into public.weekly_xp (user_id, league_id, xp_total)
    values (p_user_id, null, p_delta)
    on conflict (user_id) where league_id is null
    do update set xp_total   = weekly_xp.xp_total + excluded.xp_total,
                  updated_at = now()
    returning xp_total into v_total;
  else
    -- Non-NULL league; matches weekly_xp_user_league_uq (user_id, league_id)
    -- WHERE league_id IS NOT NULL.
    insert into public.weekly_xp (user_id, league_id, xp_total)
    values (p_user_id, p_league_id, p_delta)
    on conflict (user_id, league_id) where league_id is not null
    do update set xp_total   = weekly_xp.xp_total + excluded.xp_total,
                  updated_at = now()
    returning xp_total into v_total;
  end if;

  return v_total;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.run_season_carryover()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.weekly_xp
  set xp_total = floor(greatest(0, xp_total) * 0.1)
  where league_id is null;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function bty_foundry_award_daily_capped(uuid,uuid,text,integer,timestamp with time zone,timestamp with time zone,integer) from public; grant execute on function bty_foundry_award_daily_capped(uuid,uuid,text,integer,timestamp with time zone,timestamp with time zone,integer) to service_role;
revoke all on function bty_foundry_claim_assignment(uuid,uuid,uuid) from public; grant execute on function bty_foundry_claim_assignment(uuid,uuid,uuid) to service_role;
revoke all on function bty_foundry_materialize_apply_window(uuid,uuid,uuid,uuid,uuid,text,integer,timestamp with time zone,text,date,date,timestamp with time zone,date) from public; grant execute on function bty_foundry_materialize_apply_window(uuid,uuid,uuid,uuid,uuid,text,integer,timestamp with time zone,text,date,date,timestamp with time zone,date) to service_role;
revoke all on function bty_foundry_materialize_followup(uuid,uuid,uuid,uuid,uuid,text,integer,timestamp with time zone,text,date,date,timestamp with time zone) from public; grant execute on function bty_foundry_materialize_followup(uuid,uuid,uuid,uuid,uuid,text,integer,timestamp with time zone,text,date,date,timestamp with time zone) to service_role;
revoke all on function bty_foundry_redeem_completion_claim(text,uuid,text,text,uuid,uuid,integer,date,date,timestamp with time zone,integer,date,date,timestamp with time zone,integer,boolean,timestamp with time zone,timestamp with time zone) from public; grant execute on function bty_foundry_redeem_completion_claim(text,uuid,text,text,uuid,uuid,integer,date,date,timestamp with time zone,integer,date,date,timestamp with time zone,integer,boolean,timestamp with time zone,timestamp with time zone) to service_role;
revoke all on function enforce_avatar_character_lock() from public; grant execute on function enforce_avatar_character_lock() to anon; grant execute on function enforce_avatar_character_lock() to authenticated; grant execute on function enforce_avatar_character_lock() to service_role;
revoke all on function ensure_arena_profile() from public; grant execute on function ensure_arena_profile() to authenticated; grant execute on function ensure_arena_profile() to service_role;
revoke all on function increment_arena_xp(uuid,uuid,integer) from public; grant execute on function increment_arena_xp(uuid,uuid,integer) to service_role;
revoke all on function increment_weekly_xp(uuid,uuid,integer) from public; grant execute on function increment_weekly_xp(uuid,uuid,integer) to service_role;
revoke all on function run_season_carryover() from public; grant execute on function run_season_carryover() to service_role;
revoke all on function set_updated_at() from public; grant execute on function set_updated_at() to anon; grant execute on function set_updated_at() to authenticated; grant execute on function set_updated_at() to service_role;
alter table public.activity_xp_events enable row level security;
alter table public.arena_events enable row level security;
alter table public.arena_leagues enable row level security;
alter table public.arena_profiles enable row level security;
alter table public.arena_runs enable row level security;
alter table public.arena_weekly_quest_claims enable row level security;
alter table public.bty_action_contracts enable row level security;
alter table public.bty_org_memberships enable row level security;
alter table public.bty_organizations enable row level security;
alter table public.core_xp_ledger enable row level security;
alter table public.foundry_event_assignment_audit enable row level security;
alter table public.foundry_event_assignments enable row level security;
alter table public.foundry_event_participants enable row level security;
alter table public.foundry_event_participation_mode enable row level security;
alter table public.foundry_event_quiz_attempts enable row level security;
alter table public.foundry_event_training_progress enable row level security;
alter table public.foundry_events enable row level security;
alter table public.foundry_participant_apply_windows enable row level security;
alter table public.foundry_participant_followup_audit enable row level security;
alter table public.foundry_participant_followups enable row level security;
alter table public.train_day_completions enable row level security;
alter table public.user_advanced_unlocks enable row level security;
alter table public.user_healing_awakening_acts enable row level security;
alter table public.user_healing_milestones enable row level security;
alter table public.weekly_xp enable row level security;
create policy activity_xp_events_insert_own on public.activity_xp_events as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy activity_xp_events_select_own on public.activity_xp_events as permissive for select to authenticated using ((auth.uid() = user_id));
create policy events_insert_own on public.arena_events as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy events_select_own on public.arena_events as permissive for select to authenticated using ((auth.uid() = user_id));
create policy leagues_read_all on public.arena_leagues as permissive for select to authenticated using (true);
create policy arena_profiles_insert_own on public.arena_profiles as permissive for insert to authenticated with check ((user_id = auth.uid()));
create policy arena_profiles_select_own on public.arena_profiles as permissive for select to authenticated using ((user_id = auth.uid()));
create policy arena_profiles_update_own on public.arena_profiles as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy profiles_select_own on public.arena_profiles as permissive for select to authenticated using ((auth.uid() = user_id));
create policy profiles_update_own on public.arena_profiles as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy profiles_upsert_own on public.arena_profiles as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy runs_insert_own on public.arena_runs as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy runs_select_own on public.arena_runs as permissive for select to authenticated using ((auth.uid() = user_id));
create policy runs_update_own on public.arena_runs as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy weekly_quest_claims_insert_own on public.arena_weekly_quest_claims as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy weekly_quest_claims_select_own on public.arena_weekly_quest_claims as permissive for select to authenticated using ((auth.uid() = user_id));
create policy bty_action_contracts_insert_own on public.bty_action_contracts as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy bty_action_contracts_select_own on public.bty_action_contracts as permissive for select to authenticated using ((auth.uid() = user_id));
create policy bty_action_contracts_update_own on public.bty_action_contracts as permissive for update to authenticated using ((auth.uid() = user_id));
create policy core_xp_ledger_insert_own on public.core_xp_ledger as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy core_xp_ledger_select_own on public.core_xp_ledger as permissive for select to authenticated using ((auth.uid() = user_id));
create policy foundry_event_participants_select_owner on public.foundry_event_participants as permissive for select to authenticated using ((event_id IN ( SELECT foundry_events.id
   FROM foundry_events
  WHERE (foundry_events.owner_user_id = auth.uid()))));
create policy foundry_events_select_own on public.foundry_events as permissive for select to authenticated using ((owner_user_id = auth.uid()));
create policy train_day_completions_own on public.train_day_completions as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy user_advanced_unlocks_insert_own on public.user_advanced_unlocks as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy user_advanced_unlocks_select_own on public.user_advanced_unlocks as permissive for select to authenticated using ((auth.uid() = user_id));
create policy user_healing_awakening_acts_insert_own on public.user_healing_awakening_acts as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy user_healing_awakening_acts_select_own on public.user_healing_awakening_acts as permissive for select to authenticated using ((auth.uid() = user_id));
create policy user_healing_milestones_insert_own on public.user_healing_milestones as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy user_healing_milestones_select_own on public.user_healing_milestones as permissive for select to authenticated using ((auth.uid() = user_id));
create policy user_healing_milestones_update_own on public.user_healing_milestones as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy weekly_xp_insert_own on public.weekly_xp as permissive for insert to authenticated with check ((user_id = auth.uid()));
create policy weekly_xp_select_leaderboard on public.weekly_xp as permissive for select to authenticated using (true);
create policy weekly_xp_select_own on public.weekly_xp as permissive for select to authenticated using ((user_id = auth.uid()));
create policy weekly_xp_update_own on public.weekly_xp as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.activity_xp_events to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.activity_xp_events to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.activity_xp_events to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_events to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_events to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_events to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_leagues to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_leagues to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_leagues to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_profiles to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_profiles to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_profiles to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_runs to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_runs to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_runs to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_weekly_quest_claims to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_weekly_quest_claims to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.arena_weekly_quest_claims to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.bty_action_contracts to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.bty_action_contracts to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.bty_action_contracts to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.bty_org_memberships to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.bty_organizations to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.core_xp_ledger to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.core_xp_ledger to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.core_xp_ledger to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_assignment_audit to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_assignments to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_participants to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_participants to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_participation_mode to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_quiz_attempts to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_training_progress to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_event_training_progress to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_events to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_events to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_participant_apply_windows to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_participant_followup_audit to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.foundry_participant_followups to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.train_day_completions to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.train_day_completions to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.train_day_completions to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_advanced_unlocks to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_advanced_unlocks to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_advanced_unlocks to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_healing_awakening_acts to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_healing_awakening_acts to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_healing_awakening_acts to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_healing_milestones to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_healing_milestones to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.user_healing_milestones to service_role;
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.weekly_xp to anon; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.weekly_xp to authenticated; grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.weekly_xp to service_role;
grant SELECT (avatar_character_id) on public.arena_profiles to authenticated;
grant SELECT (avatar_outfit_theme) on public.arena_profiles to authenticated;
grant SELECT (avatar_url) on public.arena_profiles to authenticated;
grant SELECT (code_index) on public.arena_profiles to authenticated;
grant SELECT (code_name) on public.arena_profiles to authenticated;
grant SELECT (consent_accepted_at) on public.arena_profiles to authenticated;
grant SELECT (consent_locale) on public.arena_profiles to authenticated;
grant SELECT (consent_version) on public.arena_profiles to authenticated;
grant SELECT (display_name) on public.arena_profiles to authenticated;
grant SELECT (league_id) on public.arena_profiles to authenticated;
grant SELECT (lifetime_xp) on public.arena_profiles to authenticated;
grant SELECT (streak) on public.arena_profiles to authenticated;
grant SELECT (tier) on public.arena_profiles to authenticated;
grant SELECT (user_id) on public.arena_profiles to authenticated;
grant SELECT (weekly_xp) on public.arena_profiles to authenticated;
grant usage, select on sequence public.activity_xp_events_id_seq to authenticated, service_role;
grant usage, select on sequence public.core_xp_ledger_id_seq to authenticated, service_role;
grant usage, select on sequence public.weekly_xp_id_seq to authenticated, service_role;
CREATE TRIGGER trg_arena_profiles_updated_at BEFORE UPDATE ON public.arena_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enforce_avatar_character_lock BEFORE UPDATE ON public.arena_profiles FOR EACH ROW EXECUTE FUNCTION enforce_avatar_character_lock();
CREATE TRIGGER trg_weekly_xp_updated_at BEFORE UPDATE ON public.weekly_xp FOR EACH ROW EXECUTE FUNCTION set_updated_at();
