import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSpark } from '../api/openai';
import { supabaseApi } from '../api/supabase';
import { notificationService } from './notificationService';
import { AVAILABLE_TOPICS } from '../constants/topics';

export const DAILY_SPARK_KEY = 'daily_spark';
export const SPARK_INTERACTION_KEY = 'spark_interaction';
const VARIETY_PROBABILITY = 0.2; // 20% chance to show spark from non-preferred topics

// Simple time constant - 9:00 AM (local)
export const SPARK_TIME = 9.0; // 9 hours (9:00 AM)

interface DailySpark {
  id: string;
  content: string;
  topic: string;
  details: string;
  date: string;        // Local date string
  userId: string;
  generatedAt: string; // Full timestamp (still okay in UTC or local)
}

/**
 * Returns a string in YYYY-MM-DD format based on local time.
 * Example: "2025-02-21"
 */
function getLocalDateString(): string {
  return new Date().toLocaleDateString('en-CA');
}

export const sparkGeneratorService = {
  selectTopicsWithBandit(userSelectedTopics: string[]): string[] {
    // 20% chance to explore non-selected topics
    if (Math.random() < VARIETY_PROBABILITY) {
      const unselectedTopics = AVAILABLE_TOPICS.filter(
        topic => !userSelectedTopics.includes(topic)
      );
      if (unselectedTopics.length > 0) {
        // Pick 1-2 random unselected topics
        const numTopics = Math.min(
          1 + Math.floor(Math.random() * 2),
          unselectedTopics.length
        );
        const shuffled = unselectedTopics.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, numTopics);
      } 
    }
    return userSelectedTopics;
  },

  async generateDailySpark(
    userId: string,
    selectedTopics: string[],
    userPreferences: string
  ) {
    // Use local date for "today"
    const today = getLocalDateString();
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;

    // Apply bandit algorithm to potentially include non-selected topics
    const topicsForGeneration = this.selectTopicsWithBandit(selectedTopics);

    // Generate new spark
    console.log('Generating new spark for topics:', topicsForGeneration);
    const generatedSpark = await generateSpark(topicsForGeneration, userPreferences);

    // Save to Supabase first to get the ID
    const { data: savedSpark, error } = await supabaseApi.saveSpark({
      content: generatedSpark.content,
      topic: generatedSpark.topic,
      details: generatedSpark.details,
    });

    if (error || !savedSpark || savedSpark.length === 0) {
      console.error('Error saving spark to Supabase:', error);
      throw new Error('Failed to save spark');
    }

    const spark: DailySpark = {
      id: savedSpark[0].id,
      content: generatedSpark.content,
      topic: generatedSpark.topic,
      details: generatedSpark.details,
      date: today, // local date
      userId: userId,
      generatedAt: new Date().toISOString(), // full timestamp is still fine in UTC
    };

    // Save to local storage with user-specific key
    await AsyncStorage.setItem(userSparkKey, JSON.stringify(spark));

    // Schedule next day's notification
    notificationService.scheduleDailyNotification();

    return spark;
  },

  async getTodaysSpark(
    userId: string,
    selectedTopics: string[],
    userPreferences: string
  ) {
    // Keep a reference to "now" for local time checks
    const now = new Date();
    // Local date string for "today"
    const today = getLocalDateString();
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;

    // Production logging
    console.log('=== Spark Generation Debug ===');
    console.log('Current time (local):', now.toLocaleString());
    console.log('Current time (ISO):', now.toISOString());
    console.log("Today's date (local):", today);
    console.log(
      'Current decimal hours:',
      now.getHours() + now.getMinutes() / 60
    );
    console.log('Target spark time:', SPARK_TIME);
    console.log('User ID:', userId);
    console.log('Selected topics:', selectedTopics);

    // Check if we already have today's spark for this user
    const storedSpark = await AsyncStorage.getItem(userSparkKey);
    if (storedSpark) {
      console.log('Found stored spark');
      const parsedSpark: DailySpark = JSON.parse(storedSpark);
      console.log('Stored spark date:', parsedSpark.date);
      console.log("Today's date:", today);
      if (parsedSpark.date === today) {
        console.log("Returning today's stored spark");
        return parsedSpark;
      }
      console.log('Stored spark is old, removing');
      await AsyncStorage.removeItem(userSparkKey);
    } else {
      console.log('No stored spark found');
    }

    // Convert current time to decimal hours for comparison
    const currentTimeInHours = now.getHours() + now.getMinutes() / 60;
    console.log('Time comparison:', {
      current: currentTimeInHours.toFixed(3),
      target: SPARK_TIME.toFixed(3),
      shouldGenerate: currentTimeInHours >= SPARK_TIME,
    });

    // Check if it's past spark time
    if (currentTimeInHours >= SPARK_TIME) {
      console.log('Past spark time, initiating generation');
      try {
        const spark = await this.generateDailySpark(
          userId,
          selectedTopics,
          userPreferences
        );
        console.log('Successfully generated new spark:', spark.id);
        return spark;
      } catch (error) {
        console.error('Error generating spark:', error);
        throw error;
      }
    } else {
      console.log(
        'Too early for spark, waiting until:',
        `${Math.floor(SPARK_TIME)}:${Math.round(
          (SPARK_TIME % 1) * 60
        )
          .toString()
          .padStart(2, '0')}`
      );
      return null;
    }
  },

  async checkIfSparkAvailableToday(userId: string): Promise<boolean> {
    // Local date for consistency
    const today = getLocalDateString();
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    const userInteractionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}`;

    const storedSpark = await AsyncStorage.getItem(userSparkKey);
    if (!storedSpark) return false;

    const parsedSpark: DailySpark = JSON.parse(storedSpark);
    const hasInteraction = await AsyncStorage.getItem(userInteractionKey);

    return parsedSpark.date === today && hasInteraction === 'true';
  },

  async markSparkAsInteracted(userId: string): Promise<void> {
    // Use local date for interaction key
    const today = getLocalDateString();
    const userInteractionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}`;
    await AsyncStorage.setItem(userInteractionKey, 'true');

    // Cancel the 9 AM notification since user has interacted
    notificationService.cancelTodayNotification();
  },

  async clearStoredSpark(userId: string) {
    // Local date for clearing the userInteractionKey
    const today = getLocalDateString();
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    const userInteractionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}`;
    await AsyncStorage.removeItem(userSparkKey);
    await AsyncStorage.removeItem(userInteractionKey);
  },

  async hasSparkForToday(userId: string): Promise<boolean> {
    // Local date to check if there's a spark
    const today = getLocalDateString();
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;

    const storedSpark = await AsyncStorage.getItem(userSparkKey);
    if (!storedSpark) return false;

    const parsedSpark: DailySpark = JSON.parse(storedSpark);
    return parsedSpark.date === today;
  },

  async shouldGenerateNewSpark(): Promise<boolean> {
    const now = new Date();
    const nineAM = new Date(now);
    nineAM.setHours(9, 0, 0, 0);

    // Compare local times to see if it's past 9 AM local
    return now >= nineAM;
  },
};

