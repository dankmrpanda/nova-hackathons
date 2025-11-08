// @ts-nocheck
/**
 * Template Management Routes
 * API endpoints for template creation, validation, versioning, and sharing
 * Requirements: 31.1, 31.3, 31.4, 31.6, 31.7, 31.8, 31.9
 */

import { Router, Response } from 'express';
import { templateService } from '../services/template.service';
import { artifactStorageService } from '../services/artifact-storage.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/templates
 * Create template from interactive script
 * Requirement 31.1: Save interactive scripts as templates
 */
router.post('/', requireRole('TeamLead', 'Administrator'), async (req: AuthRequest, res: Response) => {
  try {
    const { scriptId, name, description, tags, metadata } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!scriptId || !name || !description) {
      return res.status(400).json({
        error: 'Missing required fields: scriptId, name, description',
      });
    }

    // Retrieve interactive script
    const script = await artifactStorageService.retrieveInteractiveScript(scriptId);
    if (!script) {
      return res.status(404).json({
        error: `Interactive script ${scriptId} not found`,
      });
    }

    // Create template
    const template = await templateService.createTemplate(script, userId, {
      name,
      description,
      tags,
      metadata,
    });

    res.status(201).json({
      message: 'Template created successfully',
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        version: template.version,
        createdAt: template.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(500).json({
      error: error.message || 'Failed to create template',
    });
  }
});

/**
 * POST /api/templates/:id/validate
 * Validate template for cross-tenant sharing
 * Requirement 31.3, 31.10, 31.11: Validate sanitization
 */
router.post('/:id/validate', requireRole('TeamLead', 'Administrator'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Retrieve template
    const template = await artifactStorageService.retrieveTemplate(id);
    if (!template) {
      return res.status(404).json({
        error: `Template ${id} not found`,
      });
    }

    // Validate template
    const validation = await templateService.validateTemplate(template);

    res.json({
      validation,
    });
  } catch (error: any) {
    console.error('Error validating template:', error);
    res.status(500).json({
      error: error.message || 'Failed to validate template',
    });
  }
});

/**
 * POST /api/templates/:id/share
 * Share template across tenants
 * Requirement 31.4: Share templates with permission
 */
router.post('/:id/share', requireRole('TeamLead', 'Administrator'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetTenants, validateBeforeShare } = req.body;

    if (!targetTenants || !Array.isArray(targetTenants)) {
      return res.status(400).json({
        error: 'targetTenants must be an array of tenant IDs',
      });
    }

    // Share template
    const template = await templateService.shareTemplate(id, {
      targetTenants,
      validateBeforeShare,
    });

    res.json({
      message: 'Template shared successfully',
      template: {
        id: template.id,
        name: template.name,
        sharedWith: template.sharedWith,
      },
    });
  } catch (error: any) {
    console.error('Error sharing template:', error);
    res.status(500).json({
      error: error.message || 'Failed to share template',
    });
  }
});

/**
 * POST /api/templates/:id/version
 * Create new version of template
 * Requirement 31.7: Version templates
 */
router.post('/:id/version', requireRole('TeamLead', 'Administrator'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { scriptId, versionType } = req.body;

    if (!scriptId) {
      return res.status(400).json({
        error: 'scriptId is required',
      });
    }

    // Retrieve updated script
    const updatedScript = await artifactStorageService.retrieveInteractiveScript(scriptId);
    if (!updatedScript) {
      return res.status(404).json({
        error: `Interactive script ${scriptId} not found`,
      });
    }

    // Version template
    const template = await templateService.versionTemplate(
      id,
      updatedScript,
      versionType || 'minor'
    );

    res.json({
      message: 'Template versioned successfully',
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
        updatedAt: template.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error versioning template:', error);
    res.status(500).json({
      error: error.message || 'Failed to version template',
    });
  }
});

/**
 * GET /api/templates
 * Get template library
 * Requirement 31.8: Provide library view
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const {
      tags,
      creatorId,
      sharedWithTenant,
      limit,
      offset,
    } = req.query;

    // Parse query parameters
    const options = {
      tenantId: tenantId,
      tags: tags ? (tags as string).split(',') : undefined,
      creatorId: creatorId as string,
      sharedWithTenant: sharedWithTenant as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    };

    // Get template library
    const result = await templateService.getTemplateLibrary(options);

    res.json({
      templates: result.templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        version: t.version,
        tags: t.tags,
        usageCount: t.usageCount,
        rating: t.rating,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error: any) {
    console.error('Error getting template library:', error);
    res.status(500).json({
      error: error.message || 'Failed to get template library',
    });
  }
});

/**
 * GET /api/templates/:id
 * Get template details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    // Retrieve template
    const template = await artifactStorageService.retrieveTemplate(id);
    if (!template) {
      return res.status(404).json({
        error: `Template ${id} not found`,
      });
    }

    // Check access (must be owner or shared with tenant)
    if (template.tenantId !== tenantId && !template.sharedWith.includes(tenantId)) {
      return res.status(403).json({
        error: 'Access denied to this template',
      });
    }

    res.json({ template });
  } catch (error: any) {
    console.error('Error getting template:', error);
    res.status(500).json({
      error: error.message || 'Failed to get template',
    });
  }
});

/**
 * POST /api/templates/:id/use
 * Track template usage
 * Requirement 31.6: Track usage with analytics
 */
router.post('/:id/use', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await templateService.trackTemplateUsage(id, userId);

    res.json({
      message: 'Template usage tracked',
    });
  } catch (error: any) {
    console.error('Error tracking template usage:', error);
    res.status(500).json({
      error: error.message || 'Failed to track template usage',
    });
  }
});

/**
 * POST /api/templates/:id/feedback
 * Submit template feedback
 * Requirement 31.9: Allow feedback for improvement
 */
router.post('/:id/feedback', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5',
      });
    }

    await templateService.submitFeedback(id, userId, rating, comment);

    res.json({
      message: 'Feedback submitted successfully',
    });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      error: error.message || 'Failed to submit feedback',
    });
  }
});

/**
 * GET /api/templates/:id/stats
 * Get template usage statistics
 */
router.get('/:id/stats', requireRole('TeamLead', 'Administrator'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await templateService.getTemplateStats(id);

    res.json({ stats });
  } catch (error: any) {
    console.error('Error getting template stats:', error);
    res.status(500).json({
      error: error.message || 'Failed to get template stats',
    });
  }
});

/**
 * POST /api/templates/:id/customize
 * Customize template for specific repository
 * Requirement 31.5: Allow customization
 */
router.post('/:id/customize', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const { name, description, scriptModifications } = req.body;

    const customizedTemplate = await templateService.customizeTemplate(
      id,
      userId,
      tenantId,
      {
        name,
        description,
        scriptModifications,
      }
    );

    res.status(201).json({
      message: 'Template customized successfully',
      template: {
        id: customizedTemplate.id,
        name: customizedTemplate.name,
        description: customizedTemplate.description,
        version: customizedTemplate.version,
      },
    });
  } catch (error: any) {
    console.error('Error customizing template:', error);
    res.status(500).json({
      error: error.message || 'Failed to customize template',
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete template
 */
router.delete('/:id', requireRole('TeamLead', 'Administrator'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    // Retrieve template to check ownership
    const template = await artifactStorageService.retrieveTemplate(id);
    if (!template) {
      return res.status(404).json({
        error: `Template ${id} not found`,
      });
    }

    // Check ownership
    if (template.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Only the template owner can delete it',
      });
    }

    // Delete template
    await artifactStorageService.deleteTemplate(id);

    res.json({
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete template',
    });
  }
});

export default router;

