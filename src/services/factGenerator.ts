import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSpark } from '../api/openai';
import { supabaseApi } from '../api/supabase';

export const DAILY_SPARK_KEY = 'daily_spark';
export const SPARK_INTERACTION_KEY = 'spark_interaction';
const ALL_TOPICS = [
  'Science', 'History', 'Technology', 'Art', 'Literature', 
  'Philosophy', 'Psychology', 'Space', 'Nature', 'Culture'
];
const VARIETY_PROBABILITY = 0.2; // 20% chance to show spark from non-preferred topics

interface DailySpark {
  id: string;
  content: string;
  topic: string;
  details: string;
  date: string;
  userId: string;
}

export const sparkGeneratorService = {
  async getTodaysSpark(userId: string, selectedTopics: string[], userPreferences: string) {
    const today = new Date().toISOString().split('T')[0];
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    
    // Check if we already have today's spark for this user
    const storedSpark = await AsyncStorage.getItem(userSparkKey);
    if (storedSpark) {
      const parsedSpark: DailySpark = JSON.parse(storedSpark);
      if (parsedSpark.date === today && parsedSpark.id) {
        console.log('Returning cached spark for today with ID:', parsedSpark.id);
        return parsedSpark;
      }
      // If spark is from a previous day or has no ID, remove it
      console.log('Removing old or invalid spark from cache');
      await AsyncStorage.removeItem(userSparkKey);
    }

    // Decide whether to show a spark from user's preferences or other topics
    let topicsToUse = selectedTopics;
    if (Math.random() < VARIETY_PROBABILITY) {
      const otherTopics = ALL_TOPICS.filter(topic => !selectedTopics.includes(topic));
      if (otherTopics.length > 0) {
        console.log('Generating spark from non-preferred topics for variety');
        topicsToUse = otherTopics;
      }
    }

    // Generate new spark
    console.log('Generating new spark for topics:', topicsToUse);
    const generatedSpark = await generateSpark(topicsToUse, userPreferences);
    
    // Save to Supabase first to get the ID
    const { data: savedSpark, error } = await supabaseApi.saveSpark({
      content: generatedSpark.content,
      topic: generatedSpark.topic,
      details: generatedSpark.details
    });

    if (error || !savedSpark || savedSpark.length === 0) {
      console.error('Error saving spark to Supabase:', error);
      throw new Error('Failed to save spark');
    }

    console.log('Saved spark to Supabase with ID:', savedSpark[0].id);

    const spark: DailySpark = {
      id: savedSpark[0].id,
      content: generatedSpark.content,
      topic: generatedSpark.topic,
      details: generatedSpark.details,
      date: today,
      userId: userId
    };

    // Save to local storage with user-specific key
    await AsyncStorage.setItem(userSparkKey, JSON.stringify(spark));
    console.log('Saved spark to local storage with ID:', spark.id);

    return spark;
  },

  async checkIfSparkAvailableToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    const userInteractionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}`;
    
    const storedSpark = await AsyncStorage.getItem(userSparkKey);
    if (!storedSpark) return false;
    
    const parsedSpark: DailySpark = JSON.parse(storedSpark);
    const hasInteraction = await AsyncStorage.getItem(userInteractionKey);
    
    return parsedSpark.date === today && hasInteraction === 'true';
  },

  async markSparkAsInteracted(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const userInteractionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}`;
    await AsyncStorage.setItem(userInteractionKey, 'true');
  },

  async clearStoredSpark(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    const userInteractionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}`;
    await AsyncStorage.removeItem(userSparkKey);
    await AsyncStorage.removeItem(userInteractionKey);
  },

  async hasSparkForToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    
    const storedSpark = await AsyncStorage.getItem(userSparkKey);
    if (!storedSpark) return false;
    
    const parsedSpark: DailySpark = JSON.parse(storedSpark);
    return parsedSpark.date === today;
  }
};
