import OpenAI, { APIError } from 'openai';
import { OPENAI_API_KEY } from '@env';
// import { ChatCompletionMessage } from 'openai/resources/chat/completions';

// Zod and OpenAI Zod helper
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

// Remove .min(1) or other constraints that translate to unsupported "minLength"
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

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateSpark = async (
  selectedTopics: string[],
  userPreferences: string
): Promise<GeneratedContent> => {
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      // Use the updated schema without minLength
      response_format: zodResponseFormat(SparkSchema, "spark"),
      messages: [
        {
          role: "user",
          content: 
            "You are a curiosity igniter that creates intriguing sparks of knowledge in distinct formats. "
            + "For each response, you MUST choose exactly ONE of these formats:\n\n"
            + "1. SURPRISING INSIGHT \n"
            + "2. MIND-BENDING PERSPECTIVE \n"
            + "Response format:\n"
            + "{\n"
            + '  "content": "ONE spark using exactly ONE of the above formats (100-200 chars). NO calls to action. MUST BE UNIQUE AND DIFFERENT FROM PREVIOUS SPARKS.",\n'
            + '  "details": "A captivating exploration (minimum 200 words)",\n'
            + '  "topic": "MUST be one of the provided topics"\n'
            + "}\n\n"
            + "IMPORTANT:\n"
            + "- Each spark MUST be unique and different from others\n"
            + "- Avoid repetitive themes or similar concepts\n"
            + "- Focus on fascinating, lesser-known facts and perspectives\n"
            + "- Make it engaging and scientifically accurate"
        },
        {
          role: "user",
          content: `Generate a curiosity spark about one of these topics: ${selectedTopics.join(', ')}. `
            + `The spark SHOULD make the person go what the fuck!?? The spark can be a thought-provoking question, a surprising insight, or an interesting perspective `
            + `(100-200 characters), without any explicit calls to action. `
            + `The details section should provide rich context and exploration paths. `
            + `Consider these user preferences: ${userPreferences}.\n\n`
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

    // Log lengths to verify
    console.log('Content length:', parsedResult.content.length);
    console.log('Details length:', parsedResult.details.length);

    return parsedResult;
  } catch (error: unknown) {
    if (error instanceof APIError) {
      console.error('OpenAI API Error:', {
        status: error.status,
        message: error.message,
        code: error.code,
        type: error.type
      });
    } else {
      console.error('Error generating content:', error);
    }
    throw error;
  }
};


