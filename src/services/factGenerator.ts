import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSpark } from '../api/openai';
import { supabaseApi } from '../api/supabase';
import { notificationService } from './notificationService';
import { AVAILABLE_TOPICS } from '../constants/topics';

export const DAILY_SPARK_KEY = 'daily_spark';
export const SPARK_INTERACTION_KEY = 'spark_interaction';
export const TOTAL_DAILY_SPARKS = 7;
const VARIETY_PROBABILITY = 0.2; // 20% chance to show spark from non-preferred topics

// Set spark generation time to 9:00 AM for testing
export const SPARK_TIME = 9.0; // 9:00 AM

interface DailySpark {
  id: string;
  content: string;
  topic: string;
  details: string;
  date: string;        // Local date string
  userId: string;
  generatedAt: string; // Full timestamp (still okay in UTC or local)
  sparkIndex: number;  // Index of the spark (1-7)
}

// Add caching mechanism
interface SparkCache {
  [userId: string]: {
    sparks: DailySpark[];
  date: string;
    lastUpdated: number;
  };
}

/**
 * Returns a string in YYYY-MM-DD format based on local time.
 * Example: "2025-02-21"
 */
function getLocalDateString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export const sparkGeneratorService = {
  // In-memory cache for faster retrieval
  _sparkCache: {} as SparkCache,

  // Check if we have valid cached sparks for this user
  _getCachedSparks(userId: string): DailySpark[] | null {
    const cache = this._sparkCache[userId];
    if (cache && cache.date === getLocalDateString()) {
      console.log('Cache hit: Using in-memory cached sparks');
      return cache.sparks;
    }
    console.log('Cache miss: No valid cached sparks found');
    return null;
  },

  // Update the cache with new sparks
  _updateCache(userId: string, sparks: DailySpark[]) {
    this._sparkCache[userId] = {
      sparks,
      date: getLocalDateString(),
      lastUpdated: Date.now()
    };
    console.log('Cache updated with new sparks');
  },

  // Invalidate cache for a user
  _invalidateCache(userId: string) {
    delete this._sparkCache[userId];
    console.log('Cache invalidated for user:', userId);
  },

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

    // After successfully generating sparks, update the cache
    this._updateCache(userId, sparks);

    return sparks[0]; // Return the first spark to maintain compatibility
  },

  async getTodaysSpark(
    userId: string,
    selectedTopics: string[],
    userPreferences: string
  ) {
    try {
      console.log('=== Spark Generation Debug ===');
      const now = new Date();
      const today = getLocalDateString();
      const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;

      // First check the in-memory cache
      const cachedSparks = this._getCachedSparks(userId);
      if (cachedSparks) {
        console.log('Using cached sparks for performance');
        // Find the first uninteracted spark
        for (const spark of cachedSparks) {
          const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${spark.sparkIndex}`;
          const interacted = await AsyncStorage.getItem(interactionKey);
          if (!interacted) {
            console.log('Found uninteracted spark from cache:', spark.sparkIndex);
            return spark;
          }
        }
        console.log('All cached sparks have been interacted with');
        return null;
      }

      // Check if we already have today's sparks in AsyncStorage
      const storedSparks = await AsyncStorage.getItem(userSparkKey);
      if (storedSparks) {
        const parsedSparks: DailySpark[] = JSON.parse(storedSparks);
        if (parsedSparks[0]?.date === today) {
          console.log('Found stored sparks for today');
          // Update cache with stored sparks
          this._updateCache(userId, parsedSparks);
          
          // Find first uninteracted spark
          for (const spark of parsedSparks) {
            const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${spark.sparkIndex}`;
            const hasInteraction = await AsyncStorage.getItem(interactionKey);
            if (!hasInteraction) {
              console.log(`Returning uninteracted spark ${spark.sparkIndex}`);
              return spark;
            }
          }
          console.log('All sparks have been interacted with');
          return null;
        }
        console.log('Stored sparks are from a different day');
        await AsyncStorage.removeItem(userSparkKey);
      }

      // Only generate new sparks if it's past spark time
      const currentTimeInHours = now.getHours() + now.getMinutes() / 60;
      if (currentTimeInHours >= SPARK_TIME) {
        console.log('Generating new sparks for today');
        const spark = await this.generateDailySpark(userId, selectedTopics, userPreferences);
        return spark;
      } else {
        console.log('Too early for new sparks');
        return null;
      }
    } catch (error) {
      console.error('Error in getTodaysSpark:', error);
      throw error;
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
    try {
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

      // If we have cached sparks, mark them as interacted in the cache too
      if (this._sparkCache[userId]) {
        console.log('Updating interaction status in cache');
        // We don't need to modify the cache objects directly since we're just checking
        // for interacted status using AsyncStorage in our filter logic
      }
    } catch (error) {
      console.error('Error marking spark as interacted:', error);
      throw error;
    }
  },

  async clearStoredSpark(userId: string) {
    try {
      await AsyncStorage.removeItem(`${DAILY_SPARK_KEY}_${userId}`);
      
      // Also clear the cache for this user
      this._invalidateCache(userId);
      
      // Remove all interaction markers
      for (let i = 1; i <= TOTAL_DAILY_SPARKS; i++) {
        await AsyncStorage.removeItem(`${SPARK_INTERACTION_KEY}_${userId}_${i}`);
      }
      console.log('Cleared all stored sparks and interactions for user:', userId);
    } catch (error) {
      console.error('Error clearing stored spark:', error);
      throw error;
    }
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
  async resetForTesting(userId: string) {
    console.log('=== DEVELOPMENT MODE: Resetting sparks for testing ===');
    try {
      // Clear stored sparks
      const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
      await AsyncStorage.removeItem(userSparkKey);
      
      // Clear all interaction markers for today
      const today = getLocalDateString();
      for (let i = 1; i <= TOTAL_DAILY_SPARKS; i++) {
        const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${i}`;
        await AsyncStorage.removeItem(interactionKey);
      }
      
      // Clear the cache
      if (this._sparkCache[userId]) {
        delete this._sparkCache[userId];
      }
      
      console.log('Successfully reset sparks and interactions for testing');
    } catch (error) {
      console.error('Error resetting for testing:', error);
      return false;
    }
  },
};

export default sparkGeneratorService;

