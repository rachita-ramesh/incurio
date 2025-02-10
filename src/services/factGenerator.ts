import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateFact } from '../api/openai';
import { supabaseApi } from '../api/supabase';

const DAILY_FACT_KEY = 'daily_fact';

interface DailyFact {
  content: string;
  topic: string;
  date: string;
}

export const factGeneratorService = {
  async getTodaysFact(userId: string, selectedTopics: string[], userPreferences: string) {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have today's fact
    const storedFact = await AsyncStorage.getItem(DAILY_FACT_KEY);
    if (storedFact) {
      const parsedFact: DailyFact = JSON.parse(storedFact);
      if (parsedFact.date === today) {
        return parsedFact;
      }
    }

    // Generate new fact
    const factContent = await generateFact(selectedTopics, userPreferences);
    const selectedTopic = selectedTopics[Math.floor(Math.random() * selectedTopics.length)];
    
    const fact = {
      content: factContent,
      topic: selectedTopic,
      date: today,
    };

    // Save to local storage
    await AsyncStorage.setItem(DAILY_FACT_KEY, JSON.stringify(fact));

    // Save to Supabase
    await supabaseApi.saveFact({
      content: factContent || '',
      topic: selectedTopic,
    });

    return fact;
  },

  async clearStoredFact() {
    await AsyncStorage.removeItem(DAILY_FACT_KEY);
  }
};
