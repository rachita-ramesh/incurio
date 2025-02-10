import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@env';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateFact = async (
  selectedTopics: string[],
  userPreferences: string
) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a fact generator that creates interesting and thought-provoking facts."
        },
        {
          role: "user",
          content: `Generate a single interesting fact about one of these topics: ${selectedTopics.join(
            ', '
          )}. Consider these user preferences: ${userPreferences}. 
          Return only the fact text without any additional formatting or labels.`
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim();
  } catch (error) {
    console.error('Error generating fact:', error);
    throw error;
  }
};
