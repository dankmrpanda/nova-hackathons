-- Create onboarding_sessions table
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('initializing', 'analyzing', 'paused', 'completed', 'terminated')) DEFAULT 'initializing',
  
  -- Configuration
  repository_url VARCHAR(500) NOT NULL,
  repository_name VARCHAR(255),
  repository_owner VARCHAR(255),
  repository_branch VARCHAR(255) DEFAULT 'main',
  repository_commit_sha VARCHAR(40),
  
  -- Analysis scope
  analysis_scope_type VARCHAR(50) CHECK (analysis_scope_type IN ('full', 'partial')),
  analysis_scope_paths JSONB,
  analysis_scope_size BIGINT,
  
  -- Model and output preferences
  model_preference VARCHAR(255),
  output_format VARCHAR(50) CHECK (output_format IN ('text', 'animation')),
  voice_enabled BOOLEAN DEFAULT FALSE,
  random_seed INTEGER,
  
  -- State tracking
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_cost DECIMAL(10, 4) DEFAULT 0.00,
  cost_limit DECIMAL(10, 2),
  
  -- Artifacts
  artifacts JSONB DEFAULT '[]'::jsonb,
  
  -- Learning profile updates
  learning_profile_updates JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  terminated_at TIMESTAMP WITH TIME ZONE,
  termination_reason TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create collaborators table
CREATE TABLE IF NOT EXISTS session_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Permissions
  can_view BOOLEAN DEFAULT TRUE,
  can_interact BOOLEAN DEFAULT FALSE,
  can_annotate BOOLEAN DEFAULT FALSE,
  
  -- Tracking
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Share link info
  share_link_token VARCHAR(255),
  share_link_expires_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT unique_session_collaborator UNIQUE (session_id, user_id)
);

-- Create indexes for onboarding_sessions
CREATE INDEX idx_onboarding_sessions_user_id ON onboarding_sessions(user_id);
CREATE INDEX idx_onboarding_sessions_tenant_id ON onboarding_sessions(tenant_id);
CREATE INDEX idx_onboarding_sessions_status ON onboarding_sessions(status);
CREATE INDEX idx_onboarding_sessions_created_at ON onboarding_sessions(created_at);

-- Create indexes for session_collaborators
CREATE INDEX idx_session_collaborators_session_id ON session_collaborators(session_id);
CREATE INDEX idx_session_collaborators_user_id ON session_collaborators(user_id);
CREATE INDEX idx_session_collaborators_share_link_token ON session_collaborators(share_link_token);

-- Create trigger for onboarding_sessions
CREATE TRIGGER update_onboarding_sessions_updated_at BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for session_collaborators
CREATE TRIGGER update_session_collaborators_last_active BEFORE UPDATE ON session_collaborators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
