import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSpark } from '../api/openai';
import { supabaseApi } from '../api/supabase';
import { notificationService } from './notificationService';
import { AVAILABLE_TOPICS } from '../constants/topics';

export const DAILY_SPARK_KEY = 'daily_spark';
export const SPARK_INTERACTION_KEY = 'spark_interaction';
export const TOTAL_DAILY_SPARKS = 7;
const VARIETY_PROBABILITY = 0.2; // 20% chance to show spark from non-preferred topics

// Changed to 12:01 AM (0.0167 hours)
export const SPARK_TIME = 0.0167; // 12:01 AM

interface DailySpark {
  id: string;
  content: string;
  topic: string;
  details: string;
  date: string;        // Local date string
  userId: string;
  generatedAt: string; // Full timestamp (still okay in UTC or local)
  sparkIndex: number;  // Index of the spark (1-5)
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
    const sparks: DailySpark[] = [];

    // Generate 5 sparks
    for (let i = 0; i < TOTAL_DAILY_SPARKS; i++) {
      // Apply bandit algorithm to potentially include non-selected topics
      const topicsForGeneration = this.selectTopicsWithBandit(selectedTopics);

      // Generate new spark
      console.log(`Generating spark ${i + 1} of ${TOTAL_DAILY_SPARKS} for topics:`, topicsForGeneration);
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
        date: today,
        userId: userId,
        generatedAt: new Date().toISOString(),
        sparkIndex: i + 1
      };

      sparks.push(spark);
    }

    // Save all sparks to local storage
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    await AsyncStorage.setItem(userSparkKey, JSON.stringify(sparks));

    // Schedule next day's notification
    notificationService.scheduleDailyNotification();

    return sparks[0]; // Return the first spark to maintain compatibility
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

    // Check if we already have today's sparks for this user
    const storedSparks = await AsyncStorage.getItem(userSparkKey);
    if (storedSparks) {
      console.log('Found stored sparks');
      const parsedSparks: DailySpark[] = JSON.parse(storedSparks);
      if (parsedSparks[0]?.date === today) {
        console.log("Found today's stored sparks");
        
        // Find the first uninteracted spark
        for (const spark of parsedSparks) {
          const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${spark.sparkIndex}`;
          const hasInteraction = await AsyncStorage.getItem(interactionKey);
          if (!hasInteraction) {
            console.log(`Returning uninteracted spark ${spark.sparkIndex}`);
            return spark;
          }
        }
        
        // If all sparks have been interacted with, return null
        console.log('All sparks have been interacted with');
        return null;
      }
      console.log('Stored sparks are old, removing');
      await AsyncStorage.removeItem(userSparkKey);
    } else {
      console.log('No stored sparks found');
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
        const sparks = await this.generateDailySpark(
          userId,
          selectedTopics,
          userPreferences
        );
        console.log('Successfully generated new sparks');
        return sparks;
      } catch (error) {
        console.error('Error generating sparks:', error);
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

    const storedSparks = await AsyncStorage.getItem(userSparkKey);
    if (!storedSparks) return false;

    const parsedSparks: DailySpark[] = JSON.parse(storedSparks);
    if (parsedSparks[0]?.date !== today) return false;

    // Check if all sparks have been interacted with
    for (let i = 1; i <= TOTAL_DAILY_SPARKS; i++) {
      const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${i}`;
      const hasInteraction = await AsyncStorage.getItem(interactionKey);
      if (!hasInteraction) return false;
    }

    return true;
  },

  async markSparkAsInteracted(userId: string, sparkIndex: number): Promise<void> {
    // Use local date for interaction key
    const today = getLocalDateString();
    const userInteractionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${sparkIndex}`;
    await AsyncStorage.setItem(userInteractionKey, 'true');

    // Check if all sparks have been interacted with
    let allInteracted = true;
    for (let i = 1; i <= TOTAL_DAILY_SPARKS; i++) {
      const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${i}`;
      const hasInteraction = await AsyncStorage.getItem(interactionKey);
      if (!hasInteraction) {
        allInteracted = false;
        break;
      }
    }

    // Only cancel notification if all sparks have been interacted with
    if (allInteracted) {
      notificationService.cancelTodayNotification();
    }
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
    const sparkTime = new Date(now);
    const hours = Math.floor(SPARK_TIME);
    const minutes = Math.round((SPARK_TIME - hours) * 60);
    sparkTime.setHours(hours, minutes, 0, 0);

    // Compare local times to see if it's past spark time
    return now >= sparkTime;
  },
};

