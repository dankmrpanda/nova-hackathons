-- Create cost_entries table for detailed cost tracking
CREATE TABLE IF NOT EXISTS cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Cost details
  service VARCHAR(50) NOT NULL CHECK (service IN ('openrouter', 'retell', 'modal', 'github')),
  operation VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 6) NOT NULL CHECK (amount >= 0),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tenant_cost_config table for per-tenant cost limits
CREATE TABLE IF NOT EXISTS tenant_cost_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  default_cost_limit DECIMAL(10, 2) NOT NULL DEFAULT 5.00 CHECK (default_cost_limit > 0),
  max_cost_limit DECIMAL(10, 2) NOT NULL DEFAULT 50.00 CHECK (max_cost_limit >= default_cost_limit),
  warning_threshold INTEGER NOT NULL DEFAULT 90 CHECK (warning_threshold > 0 AND warning_threshold <= 100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for cost_entries
CREATE INDEX idx_cost_entries_session_id ON cost_entries(session_id);
CREATE INDEX idx_cost_entries_tenant_id ON cost_entries(tenant_id);
CREATE INDEX idx_cost_entries_user_id ON cost_entries(user_id);
CREATE INDEX idx_cost_entries_service ON cost_entries(service);
CREATE INDEX idx_cost_entries_created_at ON cost_entries(created_at);
CREATE INDEX idx_cost_entries_tenant_created ON cost_entries(tenant_id, created_at);

-- Create trigger for tenant_cost_config
CREATE TRIGGER update_tenant_cost_config_updated_at BEFORE UPDATE ON tenant_cost_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default cost config for existing tenants
INSERT INTO tenant_cost_config (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
