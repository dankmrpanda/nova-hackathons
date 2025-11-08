/**
 * Audit Log Partition Management Script
 * 
 * Creates and manages monthly partitions for audit logs
 * Should be run monthly via cron job
 * 
 * Usage:
 *   npm run manage:audit-partitions
 *   or
 *   ts-node src/scripts/manage-audit-partitions.ts
 */

import { db } from '../db';

/**
 * Create audit log partition for a specific month
 */
async function createPartition(year: number, month: number): Promise<void> {
  const monthStr = month.toString().padStart(2, '0');
  const partitionName = `audit_logs_${year}_${monthStr}`;

  // Calculate date range
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`Creating partition: ${partitionName}`);
  console.log(`  Date range: ${startDateStr} to ${endDateStr}`);

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF audit_logs_partitioned
      FOR VALUES FROM ('${startDateStr}') TO ('${endDateStr}')
    `);
    console.log(`✓ Partition ${partitionName} created successfully`);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log(`  Partition ${partitionName} already exists`);
    } else {
      throw error;
    }
  }
}

/**
 * Create partitions for next N months
 */
async function createFuturePartitions(monthsAhead: number = 3): Promise<void> {
  console.log(`Creating partitions for next ${monthsAhead} months...`);
  console.log();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

  for (let i = 0; i < monthsAhead; i++) {
    const targetDate = new Date(currentYear, currentMonth - 1 + i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    await createPartition(year, month);
  }

  console.log();
  console.log(`✓ Created ${monthsAhead} future partitions`);
}

/**
 * List all existing audit log partitions
 */
async function listPartitions(): Promise<void> {
  console.log('Existing audit log partitions:');
  console.log('-'.repeat(60));

  const result = await db.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE tablename LIKE 'audit_logs_%'
      AND tablename != 'audit_logs_partitioned'
    ORDER BY tablename
  `);

  if (result.rows.length === 0) {
    console.log('  No partitions found');
  } else {
    result.rows.forEach((row) => {
      console.log(`  ${row.tablename} (${row.size})`);
    });
  }

  console.log();
  console.log(`Total partitions: ${result.rows.length}`);
}

/**
 * Get partition statistics
 */
async function getPartitionStats(): Promise<void> {
  console.log('Partition statistics:');
  console.log('-'.repeat(60));

  const result = await db.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      (SELECT COUNT(*) FROM audit_logs_partitioned 
       WHERE timestamp >= (tablename || '-01')::date 
         AND timestamp < (tablename || '-01')::date + INTERVAL '1 month'
      ) as row_count
    FROM pg_tables
    WHERE tablename LIKE 'audit_logs_20%'
    ORDER BY tablename DESC
    LIMIT 12
  `);

  if (result.rows.length === 0) {
    console.log('  No partition statistics available');
  } else {
    result.rows.forEach((row) => {
      console.log(`  ${row.tablename}:`);
      console.log(`    Size: ${row.size}`);
      console.log(`    Rows: ${row.row_count || 'N/A'}`);
    });
  }

  console.log();
}

/**
 * Archive old partitions (detach and move to archive schema)
 */
async function archiveOldPartitions(monthsToKeep: number = 24): Promise<void> {
  console.log(`Archiving partitions older than ${monthsToKeep} months...`);
  console.log();

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);

  const cutoffYear = cutoffDate.getFullYear();
  const cutoffMonth = cutoffDate.getMonth() + 1;

  const result = await db.query(`
    SELECT tablename
    FROM pg_tables
    WHERE tablename LIKE 'audit_logs_20%'
      AND tablename < 'audit_logs_${cutoffYear}_${cutoffMonth.toString().padStart(2, '0')}'
    ORDER BY tablename
  `);

  if (result.rows.length === 0) {
    console.log('  No partitions to archive');
    return;
  }

  // Create archive schema if it doesn't exist
  await db.query('CREATE SCHEMA IF NOT EXISTS audit_archive');

  for (const row of result.rows) {
    const partitionName = row.tablename;
    console.log(`Archiving partition: ${partitionName}`);

    try {
      // Detach partition
      await db.query(`
        ALTER TABLE audit_logs_partitioned DETACH PARTITION ${partitionName}
      `);

      // Move to archive schema
      await db.query(`
        ALTER TABLE ${partitionName} SET SCHEMA audit_archive
      `);

      console.log(`✓ Partition ${partitionName} archived`);
    } catch (error) {
      console.error(`✗ Failed to archive ${partitionName}:`, error);
    }
  }

  console.log();
  console.log(`✓ Archived ${result.rows.length} partitions`);
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Audit Log Partition Management');
  console.log('='.repeat(60));
  console.log();

  try {
    // List existing partitions
    await listPartitions();
    console.log();

    // Get partition statistics
    await getPartitionStats();
    console.log();

    // Create future partitions
    await createFuturePartitions(3);
    console.log();

    // Archive old partitions (optional, commented out by default)
    // await archiveOldPartitions(24);
    // console.log();

    console.log('='.repeat(60));
    console.log('Partition management completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error managing partitions:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { createPartition, createFuturePartitions, listPartitions, archiveOldPartitions };

