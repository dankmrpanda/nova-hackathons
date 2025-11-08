import { config } from '../config';

export interface AiriaHealthStatus {
  available: boolean;
  lastChecked: Date;
  readOnlyMode: boolean;
  message?: string;
}

class AiriaHealthService {
  private healthStatus: AiriaHealthStatus = {
    available: true,
    lastChecked: new Date(),
    readOnlyMode: false,
  };

  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 30000; // 30 seconds
  private readonly TIMEOUT_MS = 5000; // 5 seconds

  /**
   * Start polling Airia health
   */
  startHealthCheck(): void {
    if (this.checkInterval) {
      return; // Already running
    }

    console.log('Starting Airia health check polling...');
    
    // Initial check
    this.checkAiriaHealth();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAiriaHealth();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop polling Airia health
   */
  stopHealthCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Stopped Airia health check polling');
    }
  }

  /**
   * Check Airia availability
   */
  private async checkAiriaHealth(): Promise<void> {
    const previousAvailability = this.healthStatus.available;

    try {
      const airiaUrl = config.airia?.apiUrl || process.env.AIRIA_API_URL;
      
      if (!airiaUrl) {
        console.warn('Airia URL not configured, assuming unavailable');
        this.updateHealthStatus(false, 'Airia URL not configured');
        return;
      }

      // Make health check request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(`${airiaUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.updateHealthStatus(true);
        
        // Log if we're recovering from downtime
        if (!previousAvailability) {
          console.log('Airia is now available - exiting read-only mode');
        }
      } else {
        this.updateHealthStatus(false, `Airia returned status ${response.status}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      const message = err.name === 'AbortError' 
        ? 'Airia health check timed out'
        : `Airia health check failed: ${err.message}`;
      
      this.updateHealthStatus(false, message);
      
      // Log if this is a new downtime
      if (previousAvailability) {
        console.error('Airia is now unavailable - entering read-only mode:', message);
      }
    }
  }

  /**
   * Update health status and manage read-only mode
   */
  private updateHealthStatus(available: boolean, message?: string): void {
    const previousReadOnlyMode = this.healthStatus.readOnlyMode;
    
    this.healthStatus = {
      available,
      lastChecked: new Date(),
      readOnlyMode: !available,
      message,
    };

    // Log mode changes
    if (previousReadOnlyMode !== this.healthStatus.readOnlyMode) {
      if (this.healthStatus.readOnlyMode) {
        console.warn('Entering read-only mode due to Airia unavailability');
      } else {
        console.log('Exiting read-only mode - Airia is available');
      }
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): AiriaHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Check if Airia is available
   */
  isAvailable(): boolean {
    return this.healthStatus.available;
  }

  /**
   * Check if system is in read-only mode
   */
  isReadOnlyMode(): boolean {
    return this.healthStatus.readOnlyMode;
  }

  /**
   * Manually trigger a health check (for testing or immediate verification)
   */
  async triggerHealthCheck(): Promise<AiriaHealthStatus> {
    await this.checkAiriaHealth();
    return this.getHealthStatus();
  }
}

export const airiaHealthService = new AiriaHealthService();
