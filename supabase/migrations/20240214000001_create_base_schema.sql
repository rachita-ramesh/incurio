-- Create the users table
CREATE TABLE public.users (
    id uuid references auth.users on delete cascade primary key,
    preferences text[] default array[]::text[] not null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Create the sparks table first (since it's referenced by other tables)
CREATE TABLE public.sparks (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    content text not null,
    topic text not null,
    details text,
    is_curiosity_trail boolean default false,
    recommendation jsonb,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Create spark_embeddings table (after sparks table)
CREATE TABLE public.spark_embeddings (
    spark_id uuid references public.sparks(id) on delete cascade primary key,
    embedding vector(1536),
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Create user_interactions table
CREATE TABLE public.user_interactions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    spark_id uuid references public.sparks(id) on delete cascade not null,
    interaction_type text not null,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Create curiosity_trails table
CREATE TABLE public.curiosity_trails (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    topic text not null,
    love_count integer default 0 not null,
    last_milestone integer default 0 not null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Add RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sparks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curiosity_trails ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Sparks policies
CREATE POLICY "Users can view their own sparks"
    ON public.sparks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sparks"
    ON public.sparks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Spark embeddings policies
CREATE POLICY "Users can view their own spark embeddings"
    ON public.spark_embeddings FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.sparks
        WHERE sparks.id = spark_embeddings.spark_id
        AND sparks.user_id = auth.uid()
    ));

-- User interactions policies
CREATE POLICY "Users can view their own interactions"
    ON public.user_interactions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own interactions"
    ON public.user_interactions FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Curiosity trails policies
CREATE POLICY "Users can view their own curiosity trails"
    ON public.curiosity_trails FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own curiosity trails"
    ON public.curiosity_trails FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own curiosity trails"
    ON public.curiosity_trails FOR UPDATE
    USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_sparks_user_id ON public.sparks(user_id);
CREATE INDEX idx_sparks_topic ON public.sparks(topic);
CREATE INDEX idx_sparks_curiosity_trail ON public.sparks(is_curiosity_trail) WHERE is_curiosity_trail = true;
CREATE INDEX idx_spark_embeddings_embedding ON public.spark_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_user_interactions_user_id ON public.user_interactions(user_id);
CREATE INDEX idx_user_interactions_spark_id ON public.user_interactions(spark_id);
CREATE INDEX idx_curiosity_trails_user_topic ON public.curiosity_trails(user_id, topic);
CREATE INDEX idx_curiosity_trails_milestone ON public.curiosity_trails(user_id, topic, last_milestone); 