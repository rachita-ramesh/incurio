-- Add check_and_save_spark function for similarity checking and storing sparks
CREATE OR REPLACE FUNCTION public.check_and_save_spark(
  p_content text,
  p_topic text,
  p_details text,
  p_user_id text,
  p_embedding vector,
  p_similarity_threshold double precision,
  p_is_curiosity_trail boolean DEFAULT false
) 
RETURNS jsonb 
LANGUAGE plpgsql
AS $$
DECLARE
    v_spark_id uuid;
    v_similar_spark record;
    v_similarity_scores jsonb := '[]'::jsonb;
BEGIN
    -- First check similarity with existing sparks
    SELECT s.id, s.content, (1 - (e.embedding <=> p_embedding)) as similarity_score
    INTO v_similar_spark
    FROM spark_embeddings e
    JOIN sparks s ON s.id = e.spark_id
    WHERE s.user_id = p_user_id
    AND s.topic = p_topic
    AND (1 - (e.embedding <=> p_embedding)) >= p_similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT 1;
    
    -- If similar spark found, return error with similarity score
    IF v_similar_spark.id IS NOT NULL THEN
        -- Collect a few similar sparks for logging/debugging
        SELECT jsonb_agg(json_build_object(
            'id', s.id,
            'content', s.content,
            'similarity_score', (1 - (e.embedding <=> p_embedding))
        ))
        INTO v_similarity_scores
        FROM spark_embeddings e
        JOIN sparks s ON s.id = e.spark_id
        WHERE s.user_id = p_user_id
        AND s.topic = p_topic
        ORDER BY (1 - (e.embedding <=> p_embedding)) DESC
        LIMIT 5;
        
        RAISE EXCEPTION 'Similar spark found with score %', v_similar_spark.similarity_score
            USING DETAIL = v_similarity_scores;
    END IF;
    
    -- If no similar spark found, insert the new spark
    INSERT INTO sparks (content, topic, details, user_id, is_curiosity_trail)
    VALUES (p_content, p_topic, p_details, p_user_id, p_is_curiosity_trail)
    RETURNING id INTO v_spark_id;
    
    -- Store the embedding
    INSERT INTO spark_embeddings (spark_id, embedding)
    VALUES (v_spark_id, p_embedding);
    
    -- Return the new spark ID
    RETURN json_build_object('id', v_spark_id, 'similarity_scores', v_similarity_scores);
END;
$$;

-- Create spark_embeddings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.spark_embeddings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    spark_id uuid REFERENCES public.sparks(id) ON DELETE CASCADE NOT NULL,
    embedding vector NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS spark_embeddings_embedding_idx ON public.spark_embeddings USING ivfflat (embedding vector_cosine_ops); 