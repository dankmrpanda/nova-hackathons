-- Create session_queue table
CREATE TABLE IF NOT EXISTS session_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_config JSONB NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  CONSTRAINT unique_user_in_queue UNIQUE (user_id, tenant_id)
);

-- Create indexes
CREATE INDEX idx_session_queue_tenant_id ON session_queue(tenant_id);
CREATE INDEX idx_session_queue_user_id ON session_queue(user_id);
CREATE INDEX idx_session_queue_position ON session_queue(position);
CREATE INDEX idx_session_queue_expires_at ON session_queue(expires_at);
