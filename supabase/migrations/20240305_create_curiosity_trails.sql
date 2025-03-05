-- Create the curiosity_trails table
create table public.curiosity_trails (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text not null,
  spark_id uuid references public.sparks(id) on delete cascade not null,
  love_milestone integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.curiosity_trails enable row level security;

create policy "Users can view their own curiosity trails"
  on public.curiosity_trails for select
  using (auth.uid() = user_id);

create policy "Users can insert their own curiosity trails"
  on public.curiosity_trails for insert
  with check (auth.uid() = user_id);

-- Create index for faster lookups
create index curiosity_trails_user_topic_idx on public.curiosity_trails (user_id, topic);
create index curiosity_trails_milestone_idx on public.curiosity_trails (user_id, topic, love_milestone); 