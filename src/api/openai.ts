import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@env';
import { ChatCompletionMessage } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface GeneratedContent {
  content: string;
  topic: string;
  details: string;
}

export const generateFact = async (
  selectedTopics: string[],
  userPreferences: string
): Promise<GeneratedContent> => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a content generator that creates a mix of interesting facts, memorable quotes, and thought-provoking ideas. Your responses should be engaging and stimulate curiosity. You MUST respond with a JSON object in the following format:\n\n{\n  \"content\": \"A concise, attention-grabbing main statement (100-200 characters)\",\n  \"details\": \"A detailed explanation (minimum 200 words) with historical context and insights\",\n  \"topic\": \"MUST be one of the provided topics\"\n}\n\nThe detailed part must be substantially different from the main content, offering much more depth and perspective. The topic field is required and must exactly match one of the topics provided in the user's message."
        },
        {
          role: "user",
          content: `Generate either an interesting fact, a memorable quote, or a thought-provoking idea about one of these topics: ${selectedTopics.join(', ')}. The main content should be clear and captivating (100-200 characters), while the details section must provide extensive background, context, and insights (minimum 200 words). Consider these user preferences: ${userPreferences}.

The topic field in the response MUST be exactly one of: ${selectedTopics.join(', ')} and MUST match the actual content.`
        }
      ],
      temperature: 0.7,
      seed: Math.floor(Math.random() * 1000000)
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No content received from OpenAI');
    }

    console.log('OpenAI Response:', result);

    const parsedResult = JSON.parse(result) as GeneratedContent;
    if (!parsedResult.content || !parsedResult.details || !parsedResult.topic || !selectedTopics.includes(parsedResult.topic)) {
      console.error('Invalid response format:', result);
      throw new Error('Invalid response format from OpenAI');
    }

    // Log lengths to verify we're getting substantial content
    console.log('Content length:', parsedResult.content.length);
    console.log('Details length:', parsedResult.details.length);

    return parsedResult;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
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
