-- Add new columns to the sparks table
alter table public.sparks
add column is_curiosity_trail boolean default false,
add column recommendation jsonb;

-- Create an index for faster filtering of Curiosity Trails
create index sparks_curiosity_trail_idx on public.sparks (is_curiosity_trail) where is_curiosity_trail = true; 