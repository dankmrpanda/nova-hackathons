# Template Management Quick Start Guide

## For Team Leads and Administrators

### Creating a Template

1. **Complete an onboarding session** and generate an interactive script
2. **Navigate to template creation** in the UI
3. **Fill in template details**:
   - Name: Descriptive name for the template
   - Description: What the template covers
   - Tags: Keywords for searchability
   - Category: Frontend, Backend, DevOps, etc.
   - Difficulty: Beginner, Intermediate, or Advanced
   - Duration: Estimated time in minutes

4. **Validate the script** to ensure it's sanitized
5. **Create the template** - it will be available in your tenant's library

### Sharing a Template

1. **Open the template** you want to share
2. **Click "Share"** and enter target tenant IDs
3. **System validates** the template automatically
4. **Confirm sharing** - template appears in target tenants' libraries

### Versioning a Template

1. **Make changes** to the interactive script
2. **Create a new version** from the updated script
3. **Choose version type**:
   - Major: Breaking changes
   - Minor: New features
   - Patch: Bug fixes
4. **Version is created** with incremented number

## For All Users

### Using a Template

1. **Browse the template library**
2. **Search by tags** to find relevant templates
3. **Click on a template** to view details
4. **Click "Use Template"** to start an onboarding session
5. **Provide feedback** after using the template

### Customizing a Template

1. **Find a template** you want to customize
2. **Click "Customize"**
3. **Modify** name, description, or script sections
4. **Save as new template** in your tenant

## API Examples

### Create Template

```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": "script-123",
    "name": "React Onboarding",
    "description": "Learn React architecture",
    "tags": ["react", "frontend"],
    "metadata": {
      "category": "Frontend",
      "difficulty": "intermediate",
      "estimatedDuration": 45
    }
  }'
```

### Get Template Library

```bash
curl -X GET "http://localhost:3000/api/templates?tags=react&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Share Template

```bash
curl -X POST http://localhost:3000/api/templates/template-123/share \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetTenants": ["tenant-456", "tenant-789"],
    "validateBeforeShare": true
  }'
```

### Submit Feedback

```bash
curl -X POST http://localhost:3000/api/templates/template-123/feedback \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Excellent template!"
  }'
```

## Common Issues

### Validation Fails

**Problem**: "Template contains unsanitized content"

**Solution**: 
- Check for code blocks with actual code instead of references
- Remove any passwords, API keys, or secrets
- Ensure email addresses and PII are removed
- Verify voice timeline is marked as sanitized

### Cannot Share Template

**Problem**: "Access denied" when sharing

**Solution**:
- Verify you have TeamLead or Administrator role
- Ensure you own the template (creator)
- Check target tenant IDs are valid

### Template Not Appearing

**Problem**: Template not showing in library

**Solution**:
- Check you're searching in the correct tenant
- Verify template is shared with your tenant
- Clear cache and refresh
- Check template hasn't been deleted

## Best Practices

### Creating Quality Templates

1. ✅ Use clear, descriptive names
2. ✅ Write comprehensive descriptions
3. ✅ Add relevant tags for discoverability
4. ✅ Set appropriate difficulty level
5. ✅ Include learning objectives
6. ✅ Test template before sharing
7. ✅ Gather feedback and iterate

### Managing Templates

1. ✅ Version templates when making changes
2. ✅ Document what changed in each version
3. ✅ Monitor usage statistics
4. ✅ Respond to user feedback
5. ✅ Archive outdated templates
6. ✅ Keep templates up to date

### Sharing Templates

1. ✅ Always validate before sharing
2. ✅ Review sanitization results
3. ✅ Share with appropriate tenants
4. ✅ Provide context in description
5. ✅ Monitor cross-tenant usage

## Support

For issues or questions:
- Check the full documentation: `template-management.md`
- Review implementation details: `task-8.4-implementation-summary.md`
- Contact your system administrator
