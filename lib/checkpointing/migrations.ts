import { getTablesWithSchema } from "./sql";

/**
 * To add a new migration, add a new string to the list returned by the getMigrations function.
 * The position of the migration in the list is the version number.
 */
export const getMigrations = (schema: string) => {
  const SCHEMA_TABLES = getTablesWithSchema(schema);
  return [
    // Migration 0: Initial checkpoint_migrations table
    `CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLES.checkpoint_migrations} (
    v INTEGER PRIMARY KEY
  );`,

    // Migration 1: Create checkpoints table
    `CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLES.checkpoints} (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
  );`,

    // Migration 2: Create checkpoint_blobs table
    `CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLES.checkpoint_blobs} (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL,
    version TEXT NOT NULL,
    type TEXT NOT NULL,
    blob BYTEA,
    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
  );`,

    // Migration 3: Create checkpoint_writes table
    `CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLES.checkpoint_writes} (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    channel TEXT NOT NULL,
    type TEXT,
    blob BYTEA NOT NULL,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
  );`,

    // Migration 4: Make blob nullable in checkpoint_blobs
    `ALTER TABLE ${SCHEMA_TABLES.checkpoint_blobs} ALTER COLUMN blob DROP not null;`,
  ];
}; 