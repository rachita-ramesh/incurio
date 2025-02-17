-- Rename facts table to sparks
ALTER TABLE facts RENAME TO sparks;

-- Rename fact_id to spark_id in user_interactions table
ALTER TABLE user_interactions RENAME COLUMN fact_id TO spark_id;

-- Update foreign key constraint
ALTER TABLE user_interactions 
  DROP CONSTRAINT IF EXISTS user_interactions_fact_id_fkey,
  ADD CONSTRAINT user_interactions_spark_id_fkey 
    FOREIGN KEY (spark_id) 
    REFERENCES sparks(id);

-- Add comment to explain the changes
COMMENT ON TABLE sparks IS 'Table storing curiosity sparks that ignite user exploration';
COMMENT ON COLUMN sparks.content IS 'The main spark content that ignites curiosity';
COMMENT ON COLUMN sparks.details IS 'Detailed exploration paths and additional context for the spark'; 