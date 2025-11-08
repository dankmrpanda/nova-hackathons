# Modal Setup Guide

Modal is used for serverless diagram generation in the Codebase Onboarding Agent.

## Getting Modal Credentials

1. Sign up at https://modal.com
2. Get your API credentials from the Modal dashboard
3. You'll receive a token ID and token secret

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
MODAL_TOKEN_ID=ak-jPpWkfPA1arSTLdmvkU1gT
MODAL_TOKEN_SECRET=as-u3HoOyjlCC9qVTVu7TkuMLth
```

### Using Modal CLI

If you have the Modal CLI installed, you can set credentials using:

```bash
modal token set --token-id ak-jPpWkfPA1arSTLdmvkU1gT --token-secret as-u3HoOyjlCC9qVTVu7TkuMLth
```

The CLI stores credentials in `~/.modal.toml`, but the application reads from environment variables.

## Docker Configuration

The Modal credentials are automatically passed to Docker containers via environment variables in:

- `docker-compose.yml` (full stack)
- `docker-compose.dev.yml` (infrastructure only)
- `docker-compose.prod.yml` (production)

Example from docker-compose.yml:
```yaml
environment:
  - MODAL_TOKEN_ID=${MODAL_TOKEN_ID}
  - MODAL_TOKEN_SECRET=${MODAL_TOKEN_SECRET}
```

## Usage in Application

The backend and worker services use Modal for:

1. **Architecture Diagram Generation** - Visual representation of codebase structure
2. **Data Flow Diagrams** - Showing how data moves through the system
3. **Dependency Graphs** - Visualizing package and module dependencies

### Backend Integration

```typescript
// Example usage in backend
import { generateDiagram } from './services/modal';

const diagram = await generateDiagram({
  type: 'architecture',
  data: repositoryAnalysis,
  options: {
    format: 'svg',
    theme: 'light'
  }
});
```

## Testing Modal Integration

### Check Credentials

```bash
# Verify environment variables are set
echo $MODAL_TOKEN_ID
echo $MODAL_TOKEN_SECRET
```

### Test API Connection

```bash
# From backend directory
cd apps/backend
npm run test:modal  # If test script exists
```

### Manual Test

```bash
# Start backend with Modal enabled
cd apps/backend
npm run dev

# Make API request to generate diagram
curl -X POST http://localhost:3000/api/diagrams/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "sessionId": "session-123",
    "type": "architecture"
  }'
```

## Troubleshooting

### Invalid Credentials

**Error**: `Modal authentication failed`

**Solution**: 
1. Verify token ID and secret in `.env`
2. Check for extra spaces or quotes
3. Ensure credentials are not expired
4. Regenerate credentials from Modal dashboard

### Connection Timeout

**Error**: `Modal API timeout`

**Solution**:
1. Check internet connection
2. Verify Modal service status
3. Check firewall settings
4. Increase timeout in configuration

### Rate Limiting

**Error**: `Modal rate limit exceeded`

**Solution**:
1. Implement request queuing
2. Add caching for generated diagrams
3. Upgrade Modal plan if needed
4. Implement exponential backoff

## Production Deployment

### AWS Secrets Manager

For production, Modal credentials are stored in AWS Secrets Manager:

```bash
aws secretsmanager update-secret \
  --secret-id codebase-onboarding-production-app-secrets \
  --secret-string '{
    "MODAL_TOKEN_ID": "your-token-id",
    "MODAL_TOKEN_SECRET": "your-token-secret"
  }'
```

### Terraform Configuration

Modal credentials are configured in `infrastructure/terraform/secrets.tf`:

```hcl
resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    MODAL_TOKEN_ID     = "CHANGE_ME"
    MODAL_TOKEN_SECRET = "CHANGE_ME"
  })
}
```

## Security Best Practices

1. **Never commit credentials** - Use `.env` files (gitignored)
2. **Rotate regularly** - Change credentials every 90 days
3. **Use separate credentials** - Different tokens for dev/staging/prod
4. **Monitor usage** - Track API calls in Modal dashboard
5. **Implement rate limiting** - Prevent abuse and unexpected costs

## Cost Management

Modal charges based on compute time:

1. **Cache diagrams** - Store generated diagrams in S3/MinIO
2. **Batch requests** - Generate multiple diagrams in one call
3. **Set timeouts** - Prevent runaway processes
4. **Monitor usage** - Set up alerts for high usage
5. **Optimize code** - Reduce diagram generation time

## Alternative: Fallback to Static Diagrams

If Modal is unavailable, the system can fall back to static diagram generation:

```typescript
// In backend configuration
const diagramConfig = {
  provider: 'modal',
  fallback: 'static',
  timeout: 30000
};
```

This uses local diagram generation libraries instead of Modal.

## Resources

- [Modal Documentation](https://modal.com/docs)
- [Modal Python SDK](https://github.com/modal-labs/modal-client)
- [Modal Pricing](https://modal.com/pricing)
- [Modal Status](https://status.modal.com)

## Support

For Modal-specific issues:
1. Check Modal documentation
2. Review Modal status page
3. Contact Modal support
4. Check application logs for detailed errors
