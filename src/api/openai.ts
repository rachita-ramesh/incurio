import OpenAI, { APIError } from 'openai';
import { OPENAI_API_KEY } from '@env';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { supabaseApi } from './supabase';

// Remove .min(1) or other constraints that translate to unsupported "minLength"
const SparkSchema = z.object({
  content: z.string(),
  details: z.string(),
  topic: z.string()
});

const RecommendationSchema = z.object({
  title: z.string(),
  type: z.enum(['book', 'movie', 'documentary']),
  whyRecommended: z.string(),
  details: z.string(),
});

interface GeneratedContent {
  content: string;
  topic: string;
  details: string;
}

export type GeneratedRecommendation = z.infer<typeof RecommendationSchema>;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateSpark = async (
  selectedTopics: string[],
  userPreferences: string,
  userId: string,
  maxRetries: number = 3
): Promise<GeneratedContent> => {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      attempts++;
      console.log(`Attempt ${attempts} of ${maxRetries} to generate unique spark`);

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
              + '  "content": "ONE spark using exactly ONE of the above formats (100-200 chars). NO calls to action. MUST BE UNIQUE AND DIFFERENT FROM PREVIOUS SPARKS.",\n'
              + '  "details": "A captivating exploration without markdown headers (maximum 200 words). It should be consumable. Write in a flowing, narrative style with section breaks.",\n'
              + '  "topic": "MUST be one of the provided topics"\n'
              + "}\n\n"
              + "IMPORTANT:\n"
              + "- Each spark MUST be unique and different from others\n"
              + "- Avoid repetitive themes or similar concepts\n"
              + "- Focus on fascinating, lesser-known facts and perspectives\n"
              + "- Make it engaging and scientifically accurate\n"
              + "- Do NOT use markdown headers (###) in the response\n"
              + "- Do not mention the format name meaning don't say 'Surprising Insight' or 'Thought-provoking question' or anything like that"
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
    } catch (error: unknown) {
      if (error instanceof APIError) {
        console.error('OpenAI API Error:', {
          status: error.status,
          message: error.message,
          code: error.code,
          type: error.type
        });
        throw error; // Always throw OpenAI errors
      } else {
        console.error('Error generating content:', error);
        throw error;
      }
    }
  }

  throw new Error(`Failed to generate a unique spark after ${maxRetries} attempts`);
};

export const generateRecommendation = async (
  topic: string,
  lovedSparks: { content: string; topic: string }[]
): Promise<GeneratedRecommendation> => {
  try {
    console.log('=== Generating Recommendation ===');
    console.log('Topic:', topic);
    console.log('Number of loved sparks:', lovedSparks.length);

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      response_format: zodResponseFormat(RecommendationSchema, "recommendation"),
      messages: [
        {
          role: "user",
          content: 
            "You are a curiosity trail guide that recommends books, movies, or documentaries based on users' interests. "
            + `The user has shown deep interest in ${topic} by loving ${lovedSparks.length} sparks about it. `
            + "Some of the sparks they loved include:\n"
            + lovedSparks.map(spark => `- ${spark.content}`).join('\n')
            + "\n\n"
            + "Recommend ONE engaging piece of content that would deepen their understanding and curiosity about this topic.\n\n"
            + "Response format:\n"
            + "{\n"
            + '  "title": "The exact title of the recommended content",\n'
            + '  "type": "book" OR "movie" OR "documentary",\n'
            + '  "whyRecommended": "2-3 sentences explaining why this specifically matches their interests (150-200 chars)",\n'
            + '  "details": "A concise, engaging description that builds curiosity without spoilers (MAXIMUM 200 words)"\n'
            + "}\n\n"
            + "IMPORTANT:\n"
            + "- Choose content that's accessible and well-regarded\n"
            + "- Make clear connections to their demonstrated interests\n"
            + "- Focus on why this will spark more curiosity\n"
            + "- Be specific about what makes this recommendation special\n"
            + "- Keep the details section under 200 words\n"
            + "- Write in an engaging, narrative style"
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

    console.log('Successfully generated recommendation');
    return parsedResult;
  } catch (error) {
    if (error instanceof APIError) {
      console.error('OpenAI API Error:', error.message, error.status);
    } else {
      console.error('Error generating recommendation:', error);
    }
    throw error;
  }
};

export const generateEmbedding = async (content: string, details: string): Promise<number[]> => {
  try {
    console.log('=== Generating Embedding ===');
    console.log('Content:', content);
    console.log('Content length:', content.length);
    console.log('Details length:', details.length);
    
    const combinedText = `${content}\n\n${details}`;
    console.log('Combined text length:', combinedText.length);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: combinedText,
      dimensions: 1536
    });

    if (!response.data[0]?.embedding) {
      throw new Error('No embedding received from OpenAI');
    }

    console.log('Successfully generated embedding');
    console.log('Embedding dimensions:', response.data[0].embedding.length);
    console.log('First few values:', response.data[0].embedding.slice(0, 5));

    return response.data[0].embedding;
  } catch (error) {
    if (error instanceof APIError) {
      console.error('OpenAI API Error:', error.message, error.status);
    } else {
      console.error('Error generating embedding:', error);
    }
    throw error;
  }
};


