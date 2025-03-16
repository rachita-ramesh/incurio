-- Create a cron job to run daily at 4 AM UTC
select
  cron.schedule(
    'daily-spark-generation',  -- name of the cron job
    '0 4 * * *',             -- cron schedule (4 AM UTC daily)
    $$
    select
      net.http_post(
        url:='https://' || (select net.http_get('https://supabase.com/api/projects/' || current_setting('app.settings.project_id'))::json->>'ref') || '.functions.supabase.co/generate-daily-sparks',
        headers:='{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
      ) as request_id;
    $$
  ); 