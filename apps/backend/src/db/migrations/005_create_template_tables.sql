-- Migration: Create Template Management Tables
-- Requirements: 31.1, 31.3, 31.6, 31.7, 31.9

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    creator_id UUID NOT NULL,
    tenant_id UUID,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    shared_with UUID[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3, 2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT fk_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_creator ON templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_shared_with ON templates USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC);

-- Template metadata table
CREATE TABLE IF NOT EXISTS template_metadata (
    template_id UUID PRIMARY KEY,
    category VARCHAR(100),
    difficulty VARCHAR(50) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration INTEGER, -- minutes
    prerequisites TEXT[],
    learning_objectives TEXT[],
    
    CONSTRAINT fk_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- Template versions table (for version history)
CREATE TABLE IF NOT EXISTS template_versions (
    id SERIAL PRIMARY KEY,
    template_id UUID NOT NULL,
    version VARCHAR(50) NOT NULL,
    template_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_template_version FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    UNIQUE(template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON template_versions(created_at DESC);

-- Template usage tracking table
CREATE TABLE IF NOT EXISTS template_usage (
    id SERIAL PRIMARY KEY,
    template_id UUID NOT NULL,
    user_id UUID NOT NULL,
    used_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_template_usage FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_usage FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_user ON template_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_used_at ON template_usage(used_at DESC);

-- Template feedback table
CREATE TABLE IF NOT EXISTS template_feedback (
    id SERIAL PRIMARY KEY,
    template_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_template_feedback FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_feedback FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(template_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_template_feedback_template ON template_feedback(template_id);
CREATE INDEX IF NOT EXISTS idx_template_feedback_user ON template_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_template_feedback_rating ON template_feedback(rating);

-- Comments
COMMENT ON TABLE templates IS 'Stores template metadata and references to sanitized interactive scripts';
COMMENT ON TABLE template_metadata IS 'Additional metadata for templates including learning objectives';
COMMENT ON TABLE template_versions IS 'Version history for templates';
COMMENT ON TABLE template_usage IS 'Tracks template usage for analytics';
COMMENT ON TABLE template_feedback IS 'User feedback and ratings for templates';

COMMENT ON COLUMN templates.shared_with IS 'Array of tenant IDs that have access to this template';
COMMENT ON COLUMN templates.tags IS 'Tags for categorizing and searching templates';
COMMENT ON COLUMN templates.rating IS 'Average rating from user feedback';
