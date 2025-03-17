import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSpark, generateEmbedding } from '../api/openai';
import { supabaseApi } from '../api/supabase';
import { notificationService } from './notificationService';
import { AVAILABLE_TOPICS } from '../constants/topics';
import { supabase } from '../api/supabase';

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

// Helper function to check if a lock is stale
function isLockStale(lockTimestamp: string): boolean {
  try {
    const lockTime = new Date(lockTimestamp);
    const now = new Date();
    
    // If the timestamp is in the future, the lock is invalid
    if (lockTime > now) {
      console.log('Lock timestamp is in the future, considering stale:', lockTimestamp);
      return true;
    }

    // If the timestamp is from a different day, the lock is stale
    if (getLocalDateString(lockTime) !== getLocalDateString(now)) {
      console.log('Lock is from a different day, considering stale');
      return true;
    }

    // If the lock is older than 5 minutes, it's stale
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const isStale = lockTime < fiveMinutesAgo;
    if (isStale) {
      console.log('Lock is older than 5 minutes, considering stale');
    }
    return isStale;
  } catch (error) {
    console.error('Error parsing lock timestamp, considering stale:', error);
    return true;
  }
}

async function cleanupStaleLocks(userId: string): Promise<void> {
  try {
    const lockKey = `${SPARK_GENERATION_LOCK_KEY}_${userId}`;
    console.log('Checking for stale locks...');
    
    const existingLock = await AsyncStorage.getItem(lockKey);
    if (existingLock) {
      try {
        const lockData = JSON.parse(existingLock);
        if (isLockStale(lockData.timestamp)) {
          console.log('Found stale lock, removing');
          await AsyncStorage.removeItem(lockKey);
        }
      } catch (error) {
        console.warn('Error checking stale lock, removing:', error);
        await AsyncStorage.removeItem(lockKey);
      }
    }
  } catch (error) {
    console.error('Error in cleanupStaleLocks:', error);
  }
}

async function acquireLock(userId: string): Promise<boolean> {
  try {
    const lockKey = `${SPARK_GENERATION_LOCK_KEY}_${userId}`;
    console.log('Attempting to acquire lock:', lockKey);
    
    // First try to get the existing lock
    let existingLock: string | null = null;
    try {
      existingLock = await AsyncStorage.getItem(lockKey);
      console.log('Existing lock:', existingLock);
    } catch (error) {
      console.warn('Error reading lock, assuming no lock exists:', error);
    }
    
    if (existingLock) {
      try {
        const lockData = JSON.parse(existingLock);
        
        // Check if the lock is stale
        if (isLockStale(lockData.timestamp)) {
          console.log('Found stale lock, overwriting');
          await AsyncStorage.setItem(lockKey, JSON.stringify({ timestamp: new Date().toISOString() }));
          return true;
        }
        console.log('Found valid lock, cannot acquire');
        return false;
      } catch (error) {
        console.warn('Error parsing lock data, treating as invalid:', error);
        // If we can't parse the lock data, consider it invalid
        await AsyncStorage.setItem(lockKey, JSON.stringify({ timestamp: new Date().toISOString() }));
        return true;
      }
    }
    
    // No existing lock, try to acquire
    try {
      console.log('No existing lock, attempting to acquire');
      const now = new Date();
      await AsyncStorage.setItem(lockKey, JSON.stringify({ timestamp: now.toISOString() }));
      
      // Verify the lock was actually set
      const verifyLock = await AsyncStorage.getItem(lockKey);
      if (!verifyLock) {
        console.error('Lock verification failed - lock was not set');
        return false;
      }
      
      console.log('Successfully acquired and verified lock');
      return true;
    } catch (error) {
      console.error('Error setting lock:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in acquireLock:', error);
    // If we hit an unexpected error, assume no lock for safety
    return true;
  }
}

async function releaseLock(userId: string): Promise<void> {
  try {
    const lockKey = `${SPARK_GENERATION_LOCK_KEY}_${userId}`;
    console.log('Attempting to release lock:', lockKey);
    
    try {
      await AsyncStorage.removeItem(lockKey);
      
      // Verify the lock was actually removed
      const verifyRemoved = await AsyncStorage.getItem(lockKey);
      if (verifyRemoved) {
        console.warn('Lock removal verification failed - lock still exists');
      } else {
        console.log('Successfully released and verified lock removal');
      }
    } catch (error) {
      console.error('Error removing lock:', error);
    }
  } catch (error) {
    console.error('Error in releaseLock:', error);
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
      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      let savedSpark = null;

      while (attempts < MAX_ATTEMPTS && !savedSpark) {
        try {
          attempts++;
          const topicsForGeneration = this.selectTopicsWithBandit(selectedTopics);
          console.log(`Generating spark ${i + 1} of ${TOTAL_DAILY_SPARKS} (Attempt ${attempts}/${MAX_ATTEMPTS})`);
          console.log('Selected topics:', topicsForGeneration);

          const generatedSpark = await generateSpark(topicsForGeneration, userPreferences, userId);
          console.log(`Generated spark ${i + 1}: Content length: ${generatedSpark.content.length}, Details length: ${generatedSpark.details.length}`);

          // Generate embedding for similarity check
          const embedding = await generateEmbedding(generatedSpark.content, generatedSpark.details);

          // Try to save with embedding and similarity check
          savedSpark = await supabaseApi.saveSparkWithEmbedding({
            content: generatedSpark.content,
            topic: generatedSpark.topic,
            details: generatedSpark.details
          }, embedding, userId);

          console.log(`Successfully saved spark ${i + 1} with topic: ${generatedSpark.topic}`);

          const spark: DailySpark = {
            id: savedSpark.id,
            content: generatedSpark.content,
            topic: generatedSpark.topic,
            details: generatedSpark.details,
            date: today,
            userId: userId,
            generatedAt: new Date().toISOString(),
            sparkIndex: i + 1
          };

          sparks.push(spark);
        } catch (error) {
          if (error instanceof Error && error.message.includes('too similar')) {
            console.log(`Attempt ${attempts}: Generated spark was too similar, retrying...`);
            if (attempts >= MAX_ATTEMPTS) {
              throw new Error(`Failed to generate a unique spark after ${MAX_ATTEMPTS} attempts`);
            }
            // Continue to next attempt
            continue;
          }
          // For other errors, throw immediately
          throw error;
        }
      }

      if (!savedSpark) {
        throw new Error(`Failed to generate and save spark ${i + 1} after ${MAX_ATTEMPTS} attempts`);
      }
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

      // Get UTC start and end times for the local date
      const { start, end } = getUTCStartEndOfDay(today);
      console.log('Checking Supabase for sparks between:', start.toISOString(), 'and', end.toISOString());
      
      const { data: existingSparks } = await supabaseApi.getSparksForDateRange(
        userId,
        start.toISOString(),
        end.toISOString()
      );

      if (!existingSparks || existingSparks.length === 0) {
        console.log('No sparks found for today');
        return null;
      }

      // Find first uninteracted spark
      return await this._findFirstUninteractedSpark(existingSparks, userId, today);
    } catch (error) {
      console.error('Error in getTodaysSpark:', error);
      throw error;
    }
  },

  // Helper method to find first uninteracted spark
  async _findFirstUninteractedSpark(sparks: any[], userId: string, today: string): Promise<DailySpark | null> {
    try {
      // Get all interactions for this user directly from the database
      const { data: interactions, error } = await supabase
        .from('user_interactions')
        .select('spark_id')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching interactions:', error);
        throw error;
      }
      
      // Create a set of interacted spark IDs for quick lookup
      const interactedIds = new Set(interactions?.map(i => i.spark_id) || []);
      console.log(`User has interacted with ${interactedIds.size} sparks in total`);
      
      // Find first uninteracted spark
      for (let i = 0; i < sparks.length; i++) {
        const spark = sparks[i];
        
        // Check if this spark has been interacted with
        if (!interactedIds.has(spark.id)) {
          console.log(`Found uninteracted spark: ${spark.id}`);
          return {
            ...spark,
            sparkIndex: i + 1,
            date: today,
            userId: userId
          };
        }
      }
      
      console.log('All sparks have been interacted with');
      return null;
    } catch (error) {
      console.error('Error in _findFirstUninteractedSpark:', error);
      return null;
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

