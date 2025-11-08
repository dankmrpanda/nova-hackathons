-- Migration: Create voice session tables
-- Requirements: 26, 27, 28

-- Voice sessions table
CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  retell_session_id VARCHAR(255) NOT NULL,
  tenant_id UUID,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'initializing',
  
  -- Configuration
  persona VARCHAR(255) NOT NULL DEFAULT 'helpful-guide',
  barge_in_enabled BOOLEAN NOT NULL DEFAULT true,
  turn_taking_mode VARCHAR(50) NOT NULL DEFAULT 'automatic',
  audio_retention_hours INTEGER NOT NULL DEFAULT 24,
  transcript_retention_hours INTEGER NOT NULL DEFAULT 8760, -- 1 year default
  voice_latency_target INTEGER NOT NULL DEFAULT 800,
  
  -- Metrics
  cost DECIMAL(10, 4) NOT NULL DEFAULT 0.00,
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes
  CONSTRAINT voice_sessions_status_check CHECK (status IN ('initializing', 'active', 'paused', 'ended', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_session_id ON voice_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_tenant_id ON voice_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_retell_session_id ON voice_sessions(retell_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started_at ON voice_sessions(started_at);

-- Voice participants table (for collaborative voice sessions)
CREATE TABLE IF NOT EXISTS voice_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'listener',
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  
  -- Unique constraint: one participant record per user per voice session
  CONSTRAINT voice_participants_unique UNIQUE (voice_session_id, user_id),
  CONSTRAINT voice_participants_role_check CHECK (role IN ('owner', 'collaborator', 'listener'))
);

CREATE INDEX IF NOT EXISTS idx_voice_participants_voice_session_id ON voice_participants(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_participants_user_id ON voice_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_participants_is_active ON voice_participants(is_active);

-- Voice transcripts table (sanitized only)
CREATE TABLE IF NOT EXISTS voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  sanitized BOOLEAN NOT NULL DEFAULT true, -- Always true
  
  -- Retention
  retention_hours INTEGER NOT NULL,
  expires_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint: only sanitized transcripts allowed
  CONSTRAINT voice_transcripts_sanitized_check CHECK (sanitized = true)
);

CREATE INDEX IF NOT EXISTS idx_voice_transcripts_voice_session_id ON voice_transcripts(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_expires_at ON voice_transcripts(expires_at);

-- Transcript segments table
CREATE TABLE IF NOT EXISTS transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES voice_transcripts(id) ON DELETE CASCADE,
  speaker VARCHAR(50) NOT NULL,
  text TEXT NOT NULL, -- Always sanitized
  timestamp_ms BIGINT NOT NULL, -- milliseconds from session start
  duration_ms INTEGER NOT NULL, -- milliseconds
  
  -- References (file paths and line numbers only, no raw code)
  references JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT transcript_segments_speaker_check CHECK (speaker IN ('agent', 'user'))
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_transcript_id ON transcript_segments(transcript_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_timestamp_ms ON transcript_segments(timestamp_ms);

-- Voice timeline events table
CREATE TABLE IF NOT EXISTS voice_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  timestamp_ms BIGINT NOT NULL, -- milliseconds from session start
  event_type VARCHAR(50) NOT NULL,
  speaker VARCHAR(50),
  content TEXT NOT NULL, -- Sanitized
  
  -- References (file paths and line numbers only)
  references JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT voice_timeline_events_type_check CHECK (event_type IN ('speech', 'navigation', 'diagram', 'code-reference')),
  CONSTRAINT voice_timeline_events_speaker_check CHECK (speaker IS NULL OR speaker IN ('agent', 'user'))
);

CREATE INDEX IF NOT EXISTS idx_voice_timeline_events_voice_session_id ON voice_timeline_events(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_timeline_events_timestamp_ms ON voice_timeline_events(timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_voice_timeline_events_event_type ON voice_timeline_events(event_type);

-- Voice quality metrics table
CREATE TABLE IF NOT EXISTS voice_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  
  -- Latency metrics
  average_latency_ms INTEGER NOT NULL,
  max_latency_ms INTEGER NOT NULL,
  
  -- Interaction metrics
  barge_in_count INTEGER NOT NULL DEFAULT 0,
  turn_count INTEGER NOT NULL DEFAULT 0,
  
  -- Quality scores (1-5)
  quality_score DECIMAL(3, 2),
  user_satisfaction DECIMAL(3, 2),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one metrics record per voice session
  CONSTRAINT voice_quality_metrics_unique UNIQUE (voice_session_id),
  CONSTRAINT voice_quality_metrics_quality_score_check CHECK (quality_score IS NULL OR (quality_score >= 1 AND quality_score <= 5)),
  CONSTRAINT voice_quality_metrics_user_satisfaction_check CHECK (user_satisfaction IS NULL OR (user_satisfaction >= 1 AND user_satisfaction <= 5))
);

CREATE INDEX IF NOT EXISTS idx_voice_quality_metrics_voice_session_id ON voice_quality_metrics(voice_session_id);

-- Voice UI synchronization events table
CREATE TABLE IF NOT EXISTS voice_ui_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  timestamp_ms BIGINT NOT NULL, -- milliseconds from session start
  transcript_segment_id UUID REFERENCES transcript_segments(id) ON DELETE SET NULL,
  
  -- UI state
  current_file VARCHAR(500),
  current_line INTEGER,
  highlighted_code JSONB DEFAULT '[]'::jsonb,
  active_diagram VARCHAR(255),
  scroll_position INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_ui_sync_events_voice_session_id ON voice_ui_sync_events(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_ui_sync_events_timestamp_ms ON voice_ui_sync_events(timestamp_ms);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_voice_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_sessions_updated_at
  BEFORE UPDATE ON voice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_sessions_updated_at();

CREATE TRIGGER voice_transcripts_updated_at
  BEFORE UPDATE ON voice_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_sessions_updated_at();

CREATE TRIGGER voice_quality_metrics_updated_at
  BEFORE UPDATE ON voice_quality_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_sessions_updated_at();

-- Comments
COMMENT ON TABLE voice_sessions IS 'Voice interaction sessions via Retell AI';
COMMENT ON TABLE voice_participants IS 'Participants in collaborative voice sessions';
COMMENT ON TABLE voice_transcripts IS 'Sanitized voice transcripts (no raw code, secrets, or PII)';
COMMENT ON TABLE transcript_segments IS 'Individual segments of sanitized voice transcripts';
COMMENT ON TABLE voice_timeline_events IS 'Timeline of events during voice sessions';
COMMENT ON TABLE voice_quality_metrics IS 'Quality metrics for voice sessions';
COMMENT ON TABLE voice_ui_sync_events IS 'UI synchronization events during voice sessions';
