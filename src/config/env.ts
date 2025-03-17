// Environment variables
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Define the environment variables type
interface EnvVariables {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

// Fallback values in case env variables fail to load
const ENV: EnvVariables = {
  SUPABASE_URL: SUPABASE_URL || 'https://jdvgciruwbnocqtzhxje.supabase.co',
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdmdjaXJ1d2Jub2NxdHpoeGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNTI5NzcsImV4cCI6MjA1NDcyODk3N30.NXtdCIDx3AyAXEdI3n2mHQpGMZ1z2bVoaJ0oZnH5e7Y',
};

// Debug info - remove in production
console.log('ENV Configuration:', {
  SUPABASE_URL: ENV.SUPABASE_URL,
  SUPABASE_ANON_KEY_DEFINED: !!ENV.SUPABASE_ANON_KEY,
});

export default ENV; 