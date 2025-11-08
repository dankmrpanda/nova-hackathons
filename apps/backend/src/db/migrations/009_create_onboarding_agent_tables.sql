-- Add GitHub integration fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_user_id INTEGER;

-- Create repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  github_url TEXT NOT NULL,
  description TEXT,
  language VARCHAR(100),
  is_private BOOLEAN DEFAULT false,
  stars INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, owner, name)
);

CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_repositories_owner_name ON repositories(owner, name);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  model_provider VARCHAR(255) NOT NULL,
  include_animation BOOLEAN DEFAULT false,
  selected_paths JSONB,
  options JSONB,
  results JSONB,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_repository_id ON analyses(repository_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

-- Create animations table
CREATE TABLE IF NOT EXISTS animations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  animation_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  animation_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  options JSONB,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_animations_user_id ON animations(user_id);
CREATE INDEX IF NOT EXISTS idx_animations_analysis_id ON animations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_animations_status ON animations(status);

-- Create model_providers table for available models
CREATE TABLE IF NOT EXISTS model_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  max_tokens INTEGER,
  cost_per_1k_tokens DECIMAL(10, 6),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default model providers
INSERT INTO model_providers (provider_key, display_name, description, max_tokens, cost_per_1k_tokens) VALUES
  ('openrouter/anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'Most intelligent model', 200000, 0.003),
  ('openrouter/anthropic/claude-3-opus', 'Claude 3 Opus', 'Best for complex analysis', 200000, 0.015),
  ('openrouter/anthropic/claude-3-haiku', 'Claude 3 Haiku', 'Fast and efficient', 200000, 0.00025),
  ('openrouter/openai/gpt-4-turbo', 'GPT-4 Turbo', 'Latest GPT-4', 128000, 0.01),
  ('openrouter/openai/gpt-4o', 'GPT-4o', 'Optimized GPT-4', 128000, 0.005),
  ('openrouter/meta-llama/llama-3.1-405b', 'Llama 3.1 405B', 'Open source large model', 128000, 0.003)
ON CONFLICT (provider_key) DO NOTHING;
