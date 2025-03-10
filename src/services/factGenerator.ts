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
  generatedAt: string; // Full timestamp
  sparkIndex: number;  // Index of the spark (1-7)
}

/**
 * Returns a string in YYYY-MM-DD format for a given date
 * If no date is provided, returns today's date
 */
function getLocalDateString(date?: Date): string {
  const targetDate = date || new Date();
  // Format date using local components
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0'); // +1 because months are 0-indexed
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

  console.log('=== Getting Local Date String ===');
  console.log('Input date:', date ? date.toLocaleString() : 'No date provided (using now)');
  console.log('Target date local:', targetDate.toLocaleString());
  console.log('Local components:', { year, month, day });
  console.log('Formatted date string:', dateString);
  return dateString;
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
  ) {
    try {
      console.log('=== Spark Generation Debug ===');
      const now = new Date();
      console.log('Current time:', now.toISOString());
      console.log('Current local time:', now.toLocaleTimeString());
      const today = getLocalDateString();

      // Check if it's past 9 AM
      const currentTimeInHours = now.getHours() + now.getMinutes() / 60;
      console.log('Current time in hours:', currentTimeInHours);
      console.log('Spark time threshold:', SPARK_TIME);
      if (currentTimeInHours < SPARK_TIME) {
        console.log('Too early for sparks - wait until 9 AM');
        console.log('Hours until available:', SPARK_TIME - currentTimeInHours);
        return null;
      }

      // Check Supabase for today's sparks
      console.log('Checking Supabase for existing sparks');
      const { data: existingSparks, error: sparksError } = await supabaseApi.getSparksForDate(userId, today);
      
      if (sparksError) {
        console.error('Error checking Supabase:', sparksError);
        throw sparksError;
      }

      // If we found sparks in Supabase, use them
      if (existingSparks && existingSparks.length > 0) {
        console.log('Found existing sparks in Supabase:', existingSparks.length);
        
        // Find first uninteracted spark
        for (let i = 0; i < existingSparks.length; i++) {
          const spark = existingSparks[i];
          try {
            const interactionKey = `${SPARK_INTERACTION_KEY}_${userId}_${today}_${i + 1}`;
            console.log('=== Checking Spark Interaction ===');
            console.log('Checking interaction for spark:', { sparkIndex: i + 1, interactionKey });
            const hasInteraction = await AsyncStorage.getItem(interactionKey);
            console.log('Interaction check result:', hasInteraction ? 'Interacted' : 'Not interacted');
            if (!hasInteraction) {
              console.log('Found uninteracted spark:', { sparkIndex: i + 1, sparkId: spark.id });
              return {
                ...spark,
                sparkIndex: i + 1,
                date: today,
                userId: userId
              };
            }
          } catch (interactionError) {
            console.warn('Failed to check interaction:', interactionError);
            // If we can't check interactions, return first spark
            return {
              ...spark,
              sparkIndex: 1,
              date: today,
              userId: userId
            };
          }
        }

        console.log('All sparks have been interacted with');
        return null;
      }

      // If no sparks exist, generate new ones
      console.log('No existing sparks found, generating new ones');
      const spark = await this.generateDailySpark(userId, selectedTopics, userPreferences);
      return spark;
    } catch (error) {
      console.error('Error in getTodaysSpark:', error);
      throw error;
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

  async shouldGenerateNewSpark(): Promise<boolean> {
    const now = new Date();
    const sparkTime = new Date(now);
    const hours = Math.floor(SPARK_TIME);
    const minutes = Math.round((SPARK_TIME - hours) * 60);
    sparkTime.setHours(hours, minutes, 0, 0);

    console.log('=== Checking Spark Generation Time ===');
    console.log('Current time:', now.toISOString());
    console.log('Current local time:', now.toLocaleTimeString());
    console.log('Target spark time:', sparkTime.toLocaleTimeString());
    console.log('Hours:', hours, 'Minutes:', minutes);
    console.log('Should generate new spark:', now >= sparkTime ? 'Yes' : 'No');

    // Compare local times to see if it's past spark time
    return now >= sparkTime;
  },

  async hasSparkForDate(userId: string, date: Date): Promise<boolean> {
    console.log('=== Checking Sparks For Date ===');
    console.log('User:', userId);
    console.log('Checking date:', date.toISOString());
    
    const targetDate = getLocalDateString(date);
    console.log('Formatted target date:', targetDate);
    
    const { data: sparks, error } = await supabaseApi.getSparksForDate(userId, targetDate);
    
    if (error) {
      console.error('Error checking sparks in Supabase:', error);
      return false;
    }

    const hasSparkForDate = sparks && sparks.length > 0;
    console.log('Sparks found for date:', hasSparkForDate ? 'Yes' : 'No');
    if (hasSparkForDate) {
      console.log('Number of sparks:', sparks?.length);
    }

    return hasSparkForDate;
  },
};

export default sparkGeneratorService;

