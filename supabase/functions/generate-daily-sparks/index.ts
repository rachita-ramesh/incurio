// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
/// <reference types="https://deno.land/x/deno/mod.ts" />
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts";
import { z } from "https://deno.land/x/zod/mod.ts";
import { zodResponseFormat } from "https://deno.land/x/openai@v4.69.0/helpers/zod.ts";


console.log("Hello from Functions!")

const TOTAL_DAILY_SPARKS = 7;

// Schema definition
const SparkSchema = z.object({
  content: z.string(),
  details: z.string(),
  topic: z.string()
});

interface GeneratedContent {
  content: string;
  topic: string;
  details: string;
}

interface User {
  id: string;
  preferences: string[];
}


// Create a single supabase client for interacting with your database
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

// Add these helper functions at the top level
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add type for OpenAI API error
interface OpenAIError extends Error {
  status?: number;
  headers?: {
    'retry-after-ms'?: string;
  };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 500
): Promise<T> {
  let lastError: OpenAIError | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as OpenAIError;
      if (lastError.status === 429) {
        // Get retry delay from headers or use exponential backoff
        const retryAfter = lastError.headers?.['retry-after-ms'] 
          ? parseInt(lastError.headers['retry-after-ms']) 
          : initialDelay * Math.pow(2, attempt - 1);
        console.log(`Rate limited. Waiting ${retryAfter}ms before retry ${attempt}/${maxRetries}`);
        await sleep(retryAfter);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

async function generateSpark(selectedTopics: string[]): Promise<GeneratedContent> {
  return await withRetry(async () => {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      response_format: zodResponseFormat(SparkSchema, "spark"),
      messages: [
        {
          role: "user",
          content: 
            "You are a curiosity igniter that creates intriguing sparks of knowledge in distinct formats. "
            + "For each response, you MUST choose exactly ONE of these formats:\n\n"
            + "1. Thought-provoking question \n"
            + "2. Mind-bending perspective \n"
            + "3. Surprising insight \n"
            + "Response format:\n"
            + "{\n"
            + '  "content": "ONE spark using exactly ONE of the above formats (100-200 chars). NO calls to action. MUST BE UNIQUE AND DIFFERENT FROM PREVIOUS SPARKS. Use plain text for mathematical symbols (e.g. pi instead of π or \\pi).",\n'
            + '  "details": "A captivating exploration without markdown headers (maximum 200 words). It should be consumable. Write in a flowing, narrative style with section breaks.",\n'
            + '  "topic": "MUST be one of the provided topics"\n'
            + "}\n\n"
            + "IMPORTANT:\n"
            + "- Each spark MUST be unique and different from others\n"
            + "- Avoid repetitive themes or similar concepts\n"
            + "- Focus on fascinating, lesser-known facts and perspectives\n"
            + "- Make it engaging and scientifically accurate\n"
            + "- Use plain text for mathematical symbols and formulas\n"
            + "- Do NOT use LaTeX notation or special characters\n"
            + "- Do NOT use markdown headers (###) in the response\n"
            + "- Do not mention the format name"
        },
        {
          role: "user",
          content: `Generate a curiosity spark about one of these topics: ${selectedTopics.join(', ')}. `
            + `The spark SHOULD make the person go what the fuck!?? The spark can be a thought-provoking question, a surprising insight, or an interesting perspective `
            + `(100-200 characters), without any explicit calls to action. `
            + `The details section should provide rich context and exploration paths. `
            + `The topic field in the response MUST be exactly one of: ${selectedTopics.join(', ')} `
            + `and MUST match the actual content.`
        }
      ],
      temperature: 1.0,
      seed: Date.now()
    });

    // Grab the validated, parsed result
    const parsedResult = completion.choices[0]?.message?.parsed;
    if (!parsedResult) {
      throw new Error('No parsed content received from OpenAI');
    }

    // Double-check the "topic" is valid
    if (!selectedTopics.includes(parsedResult.topic)) {
      console.error('Invalid topic received:', parsedResult.topic);
      throw new Error('Invalid topic in structured response from OpenAI');
    }

    return parsedResult;
  });
}

async function generateEmbedding(content: string, details: string): Promise<number[]> {
  return await withRetry(async () => {
    const combinedText = `${content}\n\n${details}`;
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: combinedText
    });

    if (!response.data[0]?.embedding) {
      throw new Error('No embedding received from OpenAI');
    }

    return response.data[0].embedding;
  });
}

async function generateSparksForUser(userId: string, preferences: string[]) {
  console.log(`Generating sparks for user ${userId}`);
  
  // Add delay between users to help with rate limiting
  await sleep(1000);

  // Get today's date in UTC
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Check if user already has sparks for today
  const { data: existingSparks } = await supabaseAdmin
    .from('sparks')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', endOfDay.toISOString());

  if (existingSparks && existingSparks.length >= TOTAL_DAILY_SPARKS) {
    console.log(`User ${userId} already has ${existingSparks.length} sparks for today`);
    return;
  }

  // Generate remaining sparks
  const remainingCount = TOTAL_DAILY_SPARKS - (existingSparks?.length || 0);
  console.log(`Generating ${remainingCount} sparks for user ${userId}`);

  for (let i = 0; i < remainingCount; i++) {
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    
    while (attempts < MAX_ATTEMPTS) {
      try {
        attempts++;
        console.log(`Attempt ${attempts} for spark ${i + 1}`);
        
        // Generate spark
        const generatedSpark = await generateSpark(preferences);
        
        // Generate embedding
        const embedding = await generateEmbedding(generatedSpark.content, generatedSpark.details);
        
        // Save spark with embedding and similarity check
        const { data, error } = await supabaseAdmin.rpc('check_and_save_spark', {
          p_content: generatedSpark.content,
          p_topic: generatedSpark.topic,
          p_details: generatedSpark.details,
          p_user_id: userId,
          p_embedding: embedding,
          p_similarity_threshold: 0.85
        });

        if (error) {
          if (error.message.includes('Similar spark found')) {
            console.log('Generated spark was too similar, retrying...');
            continue;
          }
          throw error;
        }

        console.log(`Successfully saved spark ${i + 1} for user ${userId}`);
        break;
      } catch (error) {
        console.error(`Error generating spark ${i + 1}, attempt ${attempts}:`, error);
        if (attempts === MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  }
}

serve(async (req: Request) => {
  try {
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, preferences');

    if (userError) throw userError;

    // Process users in smaller batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    const results: PromiseSettledResult<void>[] = [];
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i / BATCH_SIZE + 1}, users ${i + 1}-${Math.min(i + BATCH_SIZE, users.length)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map((user: User) => generateSparksForUser(user.id, user.preferences))
      );
      
      results.push(...batchResults);
      
      // Add delay between batches
      if (i + BATCH_SIZE < users.length) {
        await sleep(5000);
      }
    }

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        message: 'Daily sparks generation complete',
        results: {
          total: users.length,
          succeeded,
          failed
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in generate-daily-sparks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-daily-sparks' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
