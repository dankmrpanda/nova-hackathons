// @ts-nocheck
/**
 * S3 Bucket Initialization Script
 * 
 * Initializes S3 bucket with encryption and lifecycle policies
 * Run this script once during deployment setup
 * 
 * Usage:
 *   npm run init:s3
 *   or
 *   ts-node src/scripts/init-s3-bucket.ts
 */

import { getS3LifecycleService } from '../services/s3-lifecycle.service';

async function initializeS3Bucket() {
  console.log('='.repeat(60));
  console.log('S3 Bucket Initialization');
  console.log('='.repeat(60));
  console.log();

  const s3Service = getS3LifecycleService();

  try {
    // Initialize bucket with encryption and lifecycle policies
    console.log('Step 1: Configuring bucket encryption (AES-256)...');
    await s3Service.configureBucketEncryption();
    console.log('✓ Encryption configured');
    console.log();

    console.log('Step 2: Configuring lifecycle policies...');
    await s3Service.configureBucketLifecycle();
    console.log('✓ Lifecycle policies configured');
    console.log();

    // Verify configuration
    console.log('Step 3: Verifying configuration...');
    const verification = await s3Service.verifyConfiguration();
    console.log('✓ Configuration verified');
    console.log();

    // Display results
    console.log('Configuration Summary:');
    console.log('-'.repeat(60));
    console.log(`Encryption Enabled: ${verification.encryptionEnabled ? '✓' : '✗'}`);
    console.log(`Lifecycle Policies: ${verification.lifecyclePoliciesCount} configured`);
    console.log();

    if (verification.issues.length > 0) {
      console.log('Issues Found:');
      verification.issues.forEach((issue) => {
        console.log(`  ✗ ${issue}`);
      });
      console.log();
    }

    // List configured policies
    console.log('Configured Lifecycle Policies:');
    console.log('-'.repeat(60));
    const policies = await s3Service.getLifecyclePolicies();
    policies.forEach((policy) => {
      console.log(`  • ${policy.Id}`);
      console.log(`    Prefix: ${policy.Prefix || 'all'}`);
      console.log(`    Status: ${policy.Status}`);
      if (policy.Expiration?.Days) {
        console.log(`    Expiration: ${policy.Expiration.Days} days`);
      }
      console.log();
    });

    console.log('='.repeat(60));
    console.log('S3 bucket initialization completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error initializing S3 bucket:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  initializeS3Bucket()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { initializeS3Bucket };


