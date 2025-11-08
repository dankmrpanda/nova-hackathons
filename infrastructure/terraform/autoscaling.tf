# Auto Scaling Target for Backend Service
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 10
  min_capacity       = var.backend_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policy - CPU Based for Backend
resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${var.project_name}-${var.environment}-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Policy - Memory Based for Backend
resource "aws_appautoscaling_policy" "backend_memory" {
  name               = "${var.project_name}-${var.environment}-backend-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Policy - ALB Request Count for Backend
resource "aws_appautoscaling_policy" "backend_requests" {
  name               = "${var.project_name}-${var.environment}-backend-request-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.backend.arn_suffix}"
    }
    target_value       = 1000.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Target for Worker Service
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = 10
  min_capacity       = var.worker_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policy - CPU Based for Worker
resource "aws_appautoscaling_policy" "worker_cpu" {
  name               = "${var.project_name}-${var.environment}-worker-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Policy - Memory Based for Worker
resource "aws_appautoscaling_policy" "worker_memory" {
  name               = "${var.project_name}-${var.environment}-worker-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Custom CloudWatch Metric for Active Sessions
resource "aws_cloudwatch_log_metric_filter" "active_sessions" {
  name           = "${var.project_name}-${var.environment}-active-sessions"
  log_group_name = aws_cloudwatch_log_group.backend.name
  pattern        = "[time, request_id, level=INFO, msg=\"Active sessions\", count]"

  metric_transformation {
    name      = "ActiveSessions"
    namespace = "${var.project_name}/${var.environment}"
    value     = "$count"
  }
}

# Auto Scaling Policy - Session Based for Worker
resource "aws_appautoscaling_policy" "worker_sessions" {
  name               = "${var.project_name}-${var.environment}-worker-session-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "ActiveSessions"
      namespace   = "${var.project_name}/${var.environment}"
      statistic   = "Average"
    }
    target_value       = 50.0 # 50 active sessions per worker
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Scheduled Scaling for Predictable Load Patterns
resource "aws_appautoscaling_scheduled_action" "backend_scale_up_morning" {
  name               = "${var.project_name}-${var.environment}-backend-scale-up-morning"
  service_namespace  = aws_appautoscaling_target.backend.service_namespace
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  schedule           = "cron(0 8 * * MON-FRI *)" # 8 AM UTC on weekdays

  scalable_target_action {
    min_capacity = var.backend_desired_count * 2
    max_capacity = 10
  }
}

resource "aws_appautoscaling_scheduled_action" "backend_scale_down_evening" {
  name               = "${var.project_name}-${var.environment}-backend-scale-down-evening"
  service_namespace  = aws_appautoscaling_target.backend.service_namespace
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  schedule           = "cron(0 20 * * MON-FRI *)" # 8 PM UTC on weekdays

  scalable_target_action {
    min_capacity = var.backend_desired_count
    max_capacity = 10
  }
}

# CloudWatch Alarms for Scaling Events
resource "aws_cloudwatch_metric_alarm" "backend_scale_out" {
  alarm_name          = "${var.project_name}-${var.environment}-backend-scale-out"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DesiredTaskCount"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = var.backend_desired_count * 2
  alarm_description   = "Alert when backend scales beyond 2x desired count"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.backend.name
    ClusterName = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "worker_scale_out" {
  alarm_name          = "${var.project_name}-${var.environment}-worker-scale-out"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DesiredTaskCount"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = var.worker_desired_count * 2
  alarm_description   = "Alert when worker scales beyond 2x desired count"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.worker.name
    ClusterName = aws_ecs_cluster.main.name
  }
}
