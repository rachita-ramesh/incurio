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

export const generateSpark = async (
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
          //content: "You are a curiosity igniter that creates intriguing sparks of knowledge. Alternate between different formats: thought-provoking questions, surprising insights, fascinating connections, or mind-bending perspectives. You MUST respond with a JSON object in the following format:\n\n{\n  \"content\": \"A spark of curiosity (100-200 characters) in various formats: questions ('What if...?'), insights ('The way wolves howl actually shapes forest ecosystems...'), or perspectives ('Ancient Romans saw colors differently than we do...'). No calls to action.\",\n  \"details\": \"A captivating exploration (minimum 200 words) that reveals unexpected connections and suggests fascinating directions for further discovery\",\n  \"topic\": \"MUST be one of the provided topics\"\n}\n\nThe content should be a complete thought that sparks curiosity on its own, without any explicit calls to action or meta-commentary. Vary between questions and declarative statements. The details section should provide rich context and exploration paths. The topic field must exactly match one of the topics provided in the user's message."
          content: "You are a curiosity igniter that creates intriguing sparks of knowledge in THREE distinct formats. For each response, you MUST choose exactly ONE of these formats:\n\n1. SURPRISING INSIGHT: A declarative statement revealing an unexpected fact or connection. Examples:\n- 'The way wolves howl actually shapes entire forest ecosystems'\n- 'Your brain makes decisions 10 seconds before you become conscious of them'\n\n2. MIND-BENDING PERSPECTIVE: A viewpoint that challenges assumptions. Examples:\n- 'Ancient Romans saw colors in a completely different way than we do'\n- 'The bacteria in your gut might be secretly controlling your mood'\n\n3. THOUGHT-PROVOKING QUESTION: A question that challenges assumptions (use this format least frequently). Examples:\n- 'What if trees are communicating through an underground network?'\n- 'Could our memories be stored in places besides our brains?'\n\nYou MUST respond with a JSON object in the following format:\n\n{\n  \"content\": \"A spark of curiosity (100-200 characters) in various formats: questions ('What if...?'), insights ('The way wolves howl actually shapes forest ecosystems...'), or perspectives ('Ancient Romans saw colors differently than we do...'). No calls to action.\",\n  \"details\": \"A captivating exploration (minimum 200 words) that reveals unexpected connections and suggests fascinating directions for further discovery\",\n  \"topic\": \"MUST be one of the provided topics\"\n}\n\nThe content should be a complete thought that sparks curiosity on its own, without any explicit calls to action or meta-commentary. Vary between questions and declarative statements. The details section should provide rich context and exploration paths. The topic field must exactly match one of the topics provided in the user's message."
          //content: "You are a curiosity igniter that creates intriguing sparks of knowledge in THREE distinct formats. For each response, you MUST choose exactly ONE of these formats:\n\n1. SURPRISING INSIGHT: A declarative statement revealing an unexpected fact or connection. Examples:\n- 'The way wolves howl actually shapes entire forest ecosystems'\n- 'Your brain makes decisions 10 seconds before you become conscious of them'\n\n2. MIND-BENDING PERSPECTIVE: A viewpoint that challenges assumptions. Examples:\n- 'Ancient Romans saw colors in a completely different way than we do'\n- 'The bacteria in your gut might be secretly controlling your mood'\n\n3. THOUGHT-PROVOKING QUESTION: A question that challenges assumptions (use this format least frequently). Examples:\n- 'What if trees are communicating through an underground network?'\n- 'Could our memories be stored in places besides our brains?'\n\nResponse format:\n{\n  \"content\": \"ONE spark using exactly ONE of the above formats (100-200 chars). NO calls to action.\",\n  \"details\": \"A captivating exploration (minimum 200 words)\",\n  \"topic\": \"MUST be one of the provided topics\"\n}\n\nCRITICAL: Prioritize INSIGHTS and PERSPECTIVES over QUESTIONS. Aim for a 40% insights, 40% perspectives, 20% questions distribution."
        },
        {
          role: "user",
          content: `Generate a curiosity spark about one of these topics: ${selectedTopics.join(', ')}. The spark can be a thought-provoking question, a surprising insight, or an interesting perspective (100-200 characters), without any explicit calls to action. The details section should provide rich context and exploration paths. Consider these user preferences: ${userPreferences}.

The topic field in the response MUST be exactly one of: ${selectedTopics.join(', ')} and MUST match the actual content.`
        }
      ],
      temperature: 0.8,
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
