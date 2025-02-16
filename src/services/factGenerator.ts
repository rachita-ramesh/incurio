import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateFact } from '../api/openai';
import { supabaseApi } from '../api/supabase';

const DAILY_FACT_KEY = 'daily_fact';
const ALL_TOPICS = [
  'Science', 'History', 'Technology', 'Art', 'Literature', 
  'Philosophy', 'Psychology', 'Space', 'Nature', 'Culture'
];
const VARIETY_PROBABILITY = 0.2; // 20% chance to show fact from non-preferred topics

interface DailyFact {
  id: string;
  content: string;
  topic: string;
  details: string;
  date: string;
  userId: string;
}

export const factGeneratorService = {
  async getTodaysFact(userId: string, selectedTopics: string[], userPreferences: string) {
    const today = new Date().toISOString().split('T')[0];
    const userFactKey = `${DAILY_FACT_KEY}_${userId}`;
    
    // Check if we already have today's fact for this user
    const storedFact = await AsyncStorage.getItem(userFactKey);
    if (storedFact) {
      const parsedFact: DailyFact = JSON.parse(storedFact);
      if (parsedFact.date === today && parsedFact.id) {
        console.log('Returning cached fact for today with ID:', parsedFact.id);
        return parsedFact;
      }
      // If fact is from a previous day or has no ID, remove it
      console.log('Removing old or invalid fact from cache');
      await AsyncStorage.removeItem(userFactKey);
    }

    // Decide whether to show a fact from user's preferences or other topics
    let topicsToUse = selectedTopics;
    if (Math.random() < VARIETY_PROBABILITY) {
      const otherTopics = ALL_TOPICS.filter(topic => !selectedTopics.includes(topic));
      if (otherTopics.length > 0) {
        console.log('Generating fact from non-preferred topics for variety');
        topicsToUse = otherTopics;
      }
    }

    // Generate new fact
    console.log('Generating new fact for topics:', topicsToUse);
    const generatedFact = await generateFact(topicsToUse, userPreferences);
    
    // Save to Supabase first to get the ID
    const { data: savedFact, error } = await supabaseApi.saveFact({
      content: generatedFact.content,
      topic: generatedFact.topic,
      details: generatedFact.details
    });

    if (error || !savedFact || savedFact.length === 0) {
      console.error('Error saving fact to Supabase:', error);
      throw new Error('Failed to save fact');
    }

    console.log('Saved fact to Supabase with ID:', savedFact[0].id);

    const fact: DailyFact = {
      id: savedFact[0].id,
      content: generatedFact.content,
      topic: generatedFact.topic,
      details: generatedFact.details,
      date: today,
      userId: userId
    };

    // Save to local storage with user-specific key
    await AsyncStorage.setItem(userFactKey, JSON.stringify(fact));
    console.log('Saved fact to local storage with ID:', fact.id);

    return fact;
  },

  async clearStoredFact(userId: string) {
    const userFactKey = `${DAILY_FACT_KEY}_${userId}`;
    await AsyncStorage.removeItem(userFactKey);
  },

  async checkIfFactAvailableToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const userFactKey = `${DAILY_FACT_KEY}_${userId}`;
    
    const storedFact = await AsyncStorage.getItem(userFactKey);
    if (!storedFact) return false;
    
    const parsedFact: DailyFact = JSON.parse(storedFact);
    return parsedFact.date === today;
  }
};
