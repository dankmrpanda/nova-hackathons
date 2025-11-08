// @ts-nocheck
import axios from 'axios';
import { config } from '../config';
import { db } from '../db';
import { logger } from './logger.service';
import { v4 as uuidv4 } from 'uuid';

interface AnimationRequest {
  userId: string;
  analysisId: string;
  animationType: 'architecture' | 'dataflow' | 'onboarding';
  options: any;
}

class AnimationService {
  async generateAnimation(request: AnimationRequest) {
    try {
      const animationId = uuidv4();

      // Create animation record
      await db.query(
        `INSERT INTO animations (
          id, user_id, analysis_id, animation_type, status, options, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          animationId,
          request.userId,
          request.analysisId,
          request.animationType,
          'queued',
          JSON.stringify(request.options),
        ]
      );

      // Queue animation generation
      this.processAnimation(animationId, request).catch(error => {
        logger.error('Animation generation failed', { service: 'animation' }, error);
      });

      return {
        animationId,
        status: 'queued',
      };
    } catch (error: any) {
      logger.error('Failed to start animation generation', { service: 'animation' }, error);
      throw error;
    }
  }

  private async processAnimation(animationId: string, request: AnimationRequest) {
    try {
      // Update status to processing
      await db.query(
        'UPDATE animations SET status = $1, started_at = NOW() WHERE id = $2',
        ['processing', animationId]
      );

      // Get analysis results
      const analysisResult = await db.query(
        'SELECT results FROM analyses WHERE id = $1',
        [request.analysisId]
      );

      if (analysisResult.rows.length === 0) {
        throw new Error('Analysis not found');
      }

      const analysis = analysisResult.rows[0].results;

      // Generate animation using Modal
      const animationData = await this.callModalService({
        analysisId: request.analysisId,
        animationType: request.animationType,
        analysis,
        options: request.options,
      });

      // Store animation URL
      await db.query(
        `UPDATE animations 
         SET status = $1, 
             animation_url = $2, 
             completed_at = NOW() 
         WHERE id = $3`,
        ['completed', animationData.url, animationId]
      );

      logger.info('Animation generated', {
        service: 'animation',
        metadata: { animationId },
      });

      return animationData;
    } catch (error: any) {
      logger.error('Animation processing failed', { service: 'animation' }, error);

      await db.query(
        `UPDATE animations 
         SET status = $1, 
             error = $2, 
             completed_at = NOW() 
         WHERE id = $3`,
        ['failed', error.message, animationId]
      );

      throw error;
    }
  }

  private async callModalService(data: any) {
    try {
      // Call Modal API to generate animation
      // Modal will run a serverless function that creates video animations
      const response = await axios.post(
        'https://api.modal.com/v1/functions/invoke',
        {
          function_name: 'generate_onboarding_animation',
          input: data,
        },
        {
          headers: {
            Authorization: `Bearer ${config.modal.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        url: response.data.animation_url,
        duration: response.data.duration,
        thumbnail: response.data.thumbnail_url,
      };
    } catch (error: any) {
      // Fallback: Generate static diagram instead of animation
      logger.warn('Modal animation failed, generating static diagram', {
        service: 'animation',
      });

      return {
        url: this.generateStaticDiagram(data.analysis),
        duration: 0,
        thumbnail: null,
        type: 'static',
      };
    }
  }

  private generateStaticDiagram(analysis: any): string {
    // Generate Mermaid diagram syntax as fallback
    const mermaidSyntax = this.convertToMermaid(analysis);
    
    // Encode for URL
    const encoded = Buffer.from(mermaidSyntax).toString('base64');
    
    // Return Mermaid Live Editor URL
    return `https://mermaid.ink/img/${encoded}`;
  }

  private convertToMermaid(analysis: any): string {
    // Create a simple architecture diagram
    let diagram = 'graph TD\n';

    if (analysis.architecture && analysis.architecture.components) {
      analysis.architecture.components.forEach((comp: string, idx: number) => {
        diagram += `  A${idx}[${comp}]\n`;
      });
    }

    return diagram;
  }

  async getAnimationStatus(userId: string, animationId: string) {
    const result = await db.query(
      'SELECT status, started_at, completed_at FROM animations WHERE id = $1 AND user_id = $2',
      [animationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Animation not found');
    }

    return result.rows[0];
  }

  async getAnimationUrl(userId: string, animationId: string) {
    const result = await db.query(
      'SELECT animation_url FROM animations WHERE id = $1 AND user_id = $2',
      [animationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Animation not found');
    }

    return result.rows[0].animation_url;
  }
}

export const animationService = new AnimationService();
