# KMS Key for Secrets Manager
resource "aws_kms_key" "secrets" {
  description             = "KMS key for Secrets Manager"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-secrets-kms"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.project_name}-${var.environment}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# Application Secrets
resource "aws_secretsmanager_secret" "app_secrets" {
  name       = "${var.project_name}-${var.environment}-app-secrets"
  kms_key_id = aws_kms_key.secrets.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-app-secrets"
  }
}

# Placeholder secret version (to be updated manually or via CI/CD)
resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    JWT_SECRET              = "CHANGE_ME"
    AIRIA_API_KEY          = "CHANGE_ME"
    GITHUB_CLIENT_ID       = "CHANGE_ME"
    GITHUB_CLIENT_SECRET   = "CHANGE_ME"
    RETELL_API_KEY         = "CHANGE_ME"
    OPENROUTER_API_KEY     = "CHANGE_ME"
    MODAL_TOKEN_ID         = "CHANGE_ME"
    MODAL_TOKEN_SECRET     = "CHANGE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name              = "${var.project_name}-${var.environment}-alerts"
  kms_master_key_id = aws_kms_key.secrets.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-alerts"
  }
}

# SNS Topic Subscription (email)
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "alerts@example.com" # Change this to actual email
}
