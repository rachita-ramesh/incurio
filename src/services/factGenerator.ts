import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSpark } from '../api/openai';
import { supabaseApi } from '../api/supabase';
import { notificationService } from './notificationService';
import { AVAILABLE_TOPICS } from '../constants/topics';

export const DAILY_SPARK_KEY = 'daily_spark';
export const SPARK_INTERACTION_KEY = 'spark_interaction';
export const SPARK_GENERATION_LOCK_KEY = 'spark_generation_lock';
export const TOTAL_DAILY_SPARKS = 7;
const VARIETY_PROBABILITY = 0.2; // 20% chance to show spark from non-preferred topics

interface DailySpark {
  id: string;
  content: string;
  topic: string;
  details: string;
  date: string;        // Local date string
  userId: string;
  generatedAt: string; // Full timestamp
  sparkIndex: number;  // Index of the spark (1-7)
}

// Helper function for consistent date handling
function getLocalDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getUTCStartEndOfDay(localDate: string): { start: Date, end: Date } {
  // Parse the local date string
  const [month, day, year] = localDate.split('/').map(Number);
  
  // Create Date objects for start and end of the local day
  const startLocal = new Date(year, month - 1, day, 0, 0, 0);
  const endLocal = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  // Convert to UTC
  const startUTC = new Date(startLocal.toUTCString());
  const endUTC = new Date(endLocal.toUTCString());
  
  return { start: startUTC, end: endUTC };
}

async function acquireLock(userId: string): Promise<boolean> {
  try {
    const lockKey = `${SPARK_GENERATION_LOCK_KEY}_${userId}`;
    const existingLock = await AsyncStorage.getItem(lockKey);
    
    if (existingLock) {
      const lockData = JSON.parse(existingLock);
      const lockTime = new Date(lockData.timestamp);
      const now = new Date();
      
      // If lock is older than 5 minutes, consider it stale
      if (now.getTime() - lockTime.getTime() > 5 * 60 * 1000) {
        await AsyncStorage.setItem(lockKey, JSON.stringify({ timestamp: now.toISOString() }));
        return true;
      }
      return false;
    }
    
    await AsyncStorage.setItem(lockKey, JSON.stringify({ timestamp: new Date().toISOString() }));
    return true;
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
}

async function releaseLock(userId: string): Promise<void> {
  try {
    const lockKey = `${SPARK_GENERATION_LOCK_KEY}_${userId}`;
    await AsyncStorage.removeItem(lockKey);
  } catch (error) {
    console.error('Error releasing lock:', error);
  }
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
    const today = getLocalDateString();
    const sparks: DailySpark[] = [];

    console.log('=== Generating Daily Sparks ===');
    console.log('Local date:', today);
    console.log('User:', userId);

    // Generate sparks
    for (let i = 0; i < TOTAL_DAILY_SPARKS; i++) {
      const topicsForGeneration = this.selectTopicsWithBandit(selectedTopics);

      console.log(`Generating spark ${i + 1} of ${TOTAL_DAILY_SPARKS} for topics:`, topicsForGeneration);
      const generatedSpark = await generateSpark(topicsForGeneration, userPreferences);

      // Save to Supabase
      const { data: savedSpark, error } = await supabaseApi.saveSpark({
        content: generatedSpark.content,
        topic: generatedSpark.topic,
        details: generatedSpark.details
      }, userId);

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
        generatedAt: savedSpark[0].created_at,
        sparkIndex: i + 1
      };

      sparks.push(spark);
    }

    // Save to local storage
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
    await AsyncStorage.setItem(userSparkKey, JSON.stringify(sparks));

    return sparks[0];
  },

  async getTodaysSpark(
    userId: string,
    selectedTopics: string[],
    userPreferences: string
  ): Promise<DailySpark | null> {
    try {
      console.log('=== Getting Today\'s Spark ===');
      const now = new Date();
      const today = getLocalDateString(now);
      console.log('Current time:', now.toLocaleString());
      console.log('Local date:', today);

      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (retryCount < MAX_RETRIES) {
        // Check Supabase for today's sparks using date range
        const { start, end } = getUTCStartEndOfDay(today);
        console.log('Checking Supabase for sparks between:', start.toISOString(), 'and', end.toISOString());
        
        const { data: existingSparks, incomplete } = await supabaseApi.getSparksForDateRange(
          userId,
          start.toISOString(),
          end.toISOString()
        );

        // If we have a complete set, find first uninteracted spark
        if (!incomplete && existingSparks && existingSparks.length > 0) {
          return await this._findFirstUninteractedSpark(existingSparks, userId, today);
        }

        // If we have an incomplete set, generate all remaining sparks
        if (incomplete) {
          console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES}: Generating remaining sparks (${existingSparks?.length || 0}/${TOTAL_DAILY_SPARKS})`);
          
          const remainingCount = TOTAL_DAILY_SPARKS - (existingSparks?.length || 0);
          const newSparks: DailySpark[] = [];
          const startIndex = existingSparks?.length || 0;
          
          // Generate all remaining sparks
          for (let i = 0; i < remainingCount; i++) {
            const currentSparkNumber = startIndex + i + 1;
            console.log(`=== Generating Spark ${currentSparkNumber}/${TOTAL_DAILY_SPARKS} ===`);
            
            const topicsForGeneration = this.selectTopicsWithBandit(selectedTopics);
            console.log('Selected topics:', topicsForGeneration);
            const generatedSpark = await generateSpark(topicsForGeneration, userPreferences);

            console.log(`Spark ${currentSparkNumber}: Content length: ${generatedSpark.content.length}, Details length: ${generatedSpark.details.length}`);

            // Save to Supabase
            const { data: savedSpark, error } = await supabaseApi.saveSpark({
              content: generatedSpark.content,
              topic: generatedSpark.topic,
              details: generatedSpark.details
            }, userId);

            if (error || !savedSpark || savedSpark.length === 0) {
              console.error(`Failed to save spark ${currentSparkNumber}, retrying...`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }

            console.log(`Successfully saved spark ${currentSparkNumber} with topic: ${generatedSpark.topic}`);

            const spark: DailySpark = {
              id: savedSpark[0].id,
              content: generatedSpark.content,
              topic: generatedSpark.topic,
              details: generatedSpark.details,
              date: today,
              userId: userId,
              generatedAt: savedSpark[0].created_at,
              sparkIndex: currentSparkNumber
            };

            newSparks.push(spark);
          }

          // If we successfully generated all remaining sparks
          if (newSparks.length === remainingCount) {
            // Save to local storage for faster access
            const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;
            const existingStoredSparks = await AsyncStorage.getItem(userSparkKey);
            const storedSparks: DailySpark[] = existingStoredSparks ? JSON.parse(existingStoredSparks) : [];
            storedSparks.push(...newSparks);
            await AsyncStorage.setItem(userSparkKey, JSON.stringify(storedSparks));

            // Return the first uninteracted spark from the complete set
            const { data: completeSparks } = await supabaseApi.getSparksForDateRange(
              userId,
              start.toISOString(),
              end.toISOString()
            );
            
            if (completeSparks && completeSparks.length > 0) {
              return await this._findFirstUninteractedSpark(completeSparks, userId, today);
            }
          }
        }

        // If no sparks exist at all, generate the full set
        return await this._generateFullDailySparkSet(userId, selectedTopics, userPreferences);
      }

      throw new Error('Failed to generate sparks after maximum retries');
    } catch (error) {
      console.error('Error in getTodaysSpark:', error);
      throw error;
    }
  },

  // Helper method to find first uninteracted spark
  async _findFirstUninteractedSpark(sparks: any[], userId: string, today: string): Promise<DailySpark | null> {
    for (let i = 0; i < sparks.length; i++) {
      const spark = sparks[i];
      const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${i + 1}`;
      const hasInteraction = await AsyncStorage.getItem(interactionKey);
      
      if (!hasInteraction) {
        return {
          ...spark,
          sparkIndex: i + 1,
          date: today,
          userId: userId
        };
      }
    }
    return null;
  },

  // Helper method to generate full set of sparks
  async _generateFullDailySparkSet(userId: string, selectedTopics: string[], userPreferences: string): Promise<DailySpark | null> {
    const lockAcquired = await acquireLock(userId);
    if (!lockAcquired) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await this.getTodaysSpark(userId, selectedTopics, userPreferences);
    }

    try {
      return await this.generateDailySpark(userId, selectedTopics, userPreferences);
    } finally {
      await releaseLock(userId);
    }
  },

  async checkIfSparkAvailableToday(userId: string): Promise<boolean> {
    // Local date for consistency
    const today = getLocalDateString();
    const userSparkKey = `${DAILY_SPARK_KEY}_${userId}`;

    console.log('=== Checking Sparks Available Today ===');
    console.log('Checking for user:', userId);
    
    const storedSparks = await AsyncStorage.getItem(userSparkKey);
    console.log('Stored sparks found:', storedSparks ? 'Yes' : 'No');
    if (!storedSparks) return false;

    const parsedSparks: DailySpark[] = JSON.parse(storedSparks);
    console.log('Parsed sparks date:', parsedSparks[0]?.date, 'Today:', today);
    if (parsedSparks[0]?.date !== today) return false;

    // Check if all sparks have been interacted with
    console.log('Checking interactions for all sparks...');
    for (let i = 1; i <= TOTAL_DAILY_SPARKS; i++) {
      const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${i}`;
      console.log('Checking spark:', i, 'Key:', interactionKey);
      const hasInteraction = await AsyncStorage.getItem(interactionKey);
      console.log('Spark', i, 'interaction status:', hasInteraction ? 'Interacted' : 'Not interacted');
      if (!hasInteraction) {
        console.log('Found uninteracted spark:', i);
        return false;
      }
    }

    console.log('All sparks have been interacted with');
    return true;
  },

  async markSparkAsInteracted(userId: string, sparkIndex: number): Promise<void> {
    try {
      const today = getLocalDateString();
      const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${sparkIndex}`;
      console.log('=== Marking Spark Interaction ===');
      console.log('Attempting to mark spark as interacted:', { userId, sparkIndex, interactionKey });
      await AsyncStorage.setItem(interactionKey, 'true');
      console.log('Successfully marked spark as interacted');
      
      // Verify the interaction was stored
      const verifyInteraction = await AsyncStorage.getItem(interactionKey);
      console.log('Verification - Interaction stored:', verifyInteraction);
    } catch (error) {
      console.error('Error marking spark as interacted:', error);
      console.warn('User might see this spark again due to interaction tracking failure');
    }
  },

  async clearStoredSpark(userId: string) {
    try {
      await AsyncStorage.removeItem(`${DAILY_SPARK_KEY}_${userId}`);
      
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

  async hasSparkForDate(userId: string, date: Date): Promise<boolean> {
    console.log('=== Checking Sparks For Date ===');
    console.log('User:', userId);
    console.log('Checking date:', date.toISOString());
    
    const targetDate = getLocalDateString(date);
    console.log('Formatted target date:', targetDate);
    
    // Get UTC start and end times for the local date
    const { start, end } = getUTCStartEndOfDay(targetDate);
    console.log('UTC range:', { start: start.toISOString(), end: end.toISOString() });
    
    // Query Supabase using UTC range
    const { data: sparks } = await supabaseApi.getSparksForDateRange(
      userId,
      start.toISOString(),
      end.toISOString()
    );

    const hasSparkForDate = sparks && sparks.length > 0;
    console.log('Sparks found for date:', hasSparkForDate ? 'Yes' : 'No');
    if (hasSparkForDate) {
      console.log('Number of sparks:', sparks?.length);
    }

    return hasSparkForDate;
  },
};

export default sparkGeneratorService;

