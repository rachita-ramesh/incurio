import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeneratedRecommendation } from './openai';
import { TOTAL_DAILY_SPARKS } from '../services/factGenerator';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export interface User {
  id: string;
  email: string;
  preferences: string[];
  created_at: string;
}

export interface Spark {
  id: string;
  content: string;
  topic: string;
  details: string;
  created_at: string;
  user_id: string;
  local_date?: string;  // Optional field for local date tracking
}

export interface UserInteraction {
  id: string;
  user_id: string;
  spark_id: string;
  interaction_type: 'dislike' | 'like' | 'love';
  created_at: string;
}

interface PostgrestError {
  message: string;
  details: string;
  hint?: string;
  code: string;
  name?: string;
}

interface SimilarityCheckParams {
  p_user_id: string;
  p_topic: string;
  p_embedding: number[];
  p_similarity_threshold: number;
}

interface SimilarityCheckResult {
  is_too_similar: boolean;
  similar_spark_id: string;
  similarity_score: number;
  content: string;
}

interface SimilarityScore {
  content: string;
  similarity_score: number;
}

interface CheckAndSaveSparkResult {
  id: string;
  similarity_scores: SimilarityScore[];
}

interface CheckAndSaveSparkParams {
  p_content: string;
  p_topic: string;
  p_details: string;
  p_user_id: string;
  p_embedding: number[];
  p_similarity_threshold: number;
}

export const supabaseApi = {
  async saveUserPreferences(userId: string, preferences: string[]) {
    return await supabase
      .from('users')
      .update({ preferences })
      .eq('id', userId);
  },

  async saveSpark(spark: Omit<Spark, 'id' | 'created_at' | 'user_id'>, userId: string) {
    return await supabase
      .from('sparks')
      .insert([{
        content: spark.content,
        topic: spark.topic,
        details: spark.details,
        user_id: userId
      }])
      .select();
  },

  async saveInteraction(interaction: Omit<UserInteraction, 'id' | 'created_at'>) {
    return await supabase
      .from('user_interactions')
      .insert([interaction]);
  },

  async getUserHistory(userId: string) {
    return await supabase
      .from('sparks')
      .select(`
        *,
        user_interactions!inner(interaction_type)
      `)
      .eq('user_interactions.user_id', userId)
      .order('created_at', { ascending: false });
  },

  async searchSparks(userId: string, searchQuery: string) {
    return await supabase
      .from('sparks')
      .select(`
        id,
        content,
        topic,
        details,
        created_at,
        user_interactions!inner (interaction_type)
      `)
      .eq('user_interactions.user_id', userId)
      .textSearch('content', searchQuery, {
        type: 'websearch',
        config: 'english'
      })
      .order('created_at', { ascending: false });
  },
  async incrementTopicLoveCount(userId: string, topic: string) {
    console.log('=== Incrementing Topic Love Count ===');
    console.log('User:', userId);
    console.log('Topic:', topic);

    // First, try to get existing record
    const { data: existingTrail, error: fetchError } = await supabase
      .from('curiosity_trails')
      .select('love_count, last_milestone')
      .eq('user_id', userId)
      .eq('topic', topic)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching love count:', fetchError);
      throw fetchError;
    }

    const currentCount = existingTrail?.love_count || 0;
    const lastMilestone = existingTrail?.last_milestone || 0;
    const newCount = currentCount + 1;
    
    console.log('Current count:', currentCount);
    console.log('New count:', newCount);
    console.log('Last milestone:', lastMilestone);

    // Check if we'll hit a new milestone
    const newMilestone = Math.floor(newCount / 5) * 5;
    const hitNewMilestone = newMilestone > lastMilestone;

    if (existingTrail) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('curiosity_trails')
        .update({ 
          love_count: newCount,
          last_milestone: hitNewMilestone ? newMilestone : lastMilestone,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('topic', topic);

      if (updateError) {
        console.error('Error updating love count:', updateError);
        throw updateError;
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('curiosity_trails')
        .insert([{ 
          user_id: userId,
          topic,
          love_count: 1,
          last_milestone: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error('Error inserting love count:', insertError);
        throw insertError;
      }
    }

    console.log('Successfully updated love count');
    console.log('Hit new milestone:', hitNewMilestone);
    return { newCount, hitNewMilestone, milestone: newMilestone };
  },

  async getTopicLoveCount(userId: string, topic: string): Promise<number> {
    const { data, error } = await supabase
      .from('curiosity_trails')
      .select('love_count')
      .eq('user_id', userId)
      .eq('topic', topic)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching love count:', error);
      throw error;
    }

    return data?.love_count || 0;
  },

  async saveRecommendation(
    userId: string,
    topic: string,
    recommendation: GeneratedRecommendation,
    milestone: number
  ) {
    console.log('=== Saving Recommendation ===');
    console.log('Topic:', topic);
    console.log('Milestone:', milestone);
    
    // Save as a special spark
    const { data: savedSpark, error: sparkError } = await supabase
      .from('sparks')
      .insert([{
        content: `📚 ${recommendation.title}`,
        topic: topic,
        details: recommendation.details,
        is_curiosity_trail: true,
        user_id: userId,
        recommendation: {
          title: recommendation.title,
          type: recommendation.type,
          why_recommended: recommendation.whyRecommended
        }
      }])
      .select()
      .single();

    if (sparkError) {
      console.error('Error saving recommendation spark:', sparkError);
      throw sparkError;
    }

    console.log('Successfully saved recommendation');
    return savedSpark;
  },

  async getLovedSparksForTopic(userId: string, topic: string) {
    console.log('=== Fetching Loved Sparks ===');
    console.log('User:', userId);
    console.log('Topic:', topic);
    
    const { data, error } = await supabase
      .from('sparks')
      .select(`
        content,
        topic,
        user_interactions!inner (
          interaction_type
        )
      `)
      .eq('user_interactions.user_id', userId)
      .eq('user_interactions.interaction_type', 'love')
      .eq('topic', topic)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loved sparks:', error);
      throw error;
    }

    // Transform the data to match the expected format
    const transformedData = data?.map(spark => ({
      content: spark.content,
      topic: spark.topic
    })) || [];

    console.log('Found loved sparks:', transformedData.length);
    return transformedData;
  },

  async getSparksForDateRange(userId: string, startDate: string, endDate: string) {
    console.log('=== Getting Sparks For Date Range ===');
    console.log('Start date:', startDate);
    console.log('End date:', endDate);
    
    // First, cleanup old sparks that are not curiosity trails
    await this.cleanupOldSparks(userId);

    try {
      const { data: sparks, error } = await supabase
        .from('sparks')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .eq('is_curiosity_trail', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching sparks:', error);
        throw error;
      }

      // Check if we have a complete set of sparks
      const incomplete = !sparks || sparks.length < TOTAL_DAILY_SPARKS;
      if (incomplete) {
        console.log(`Found incomplete set of sparks: ${sparks?.length || 0}/${TOTAL_DAILY_SPARKS}`);
      }

      return { data: sparks || [], incomplete };
    } catch (error) {
      console.error('Error in getSparksForDateRange:', error);
      throw error;
    }
  },

  async getSparksForDate(userId: string, date: string) {
    console.log('=== Getting Sparks For Date (Legacy) ===');
    console.log('Date:', date);
    
    // Parse the date string (expected format: MM/DD/YYYY)
    const [month, day, year] = date.split('/').map(Number);
    
    // Create date objects for start and end of the specified date in local time
    const startOfDay = new Date(year, month - 1, day);  // month is 0-indexed
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(year, month - 1, day);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getSparksForDateRange(userId, startOfDay.toISOString(), endOfDay.toISOString());
  },

  async cleanupOldSparks(userId: string) {
    console.log('=== Cleaning Up Old Sparks ===');
    
    // Keep only sparks from the last 7 days and curiosity trails
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);  // Start of day in local time

    console.log('Cleaning up sparks before:', sevenDaysAgo.toLocaleString());
    console.log('Cutoff date in ISO:', sevenDaysAgo.toISOString());

    return await supabase
      .from('sparks')
      .delete()
      .eq('user_id', userId)
      .eq('is_curiosity_trail', false)
      .lt('created_at', sevenDaysAgo.toISOString());
  },

  async saveSparkWithEmbedding(
    spark: Omit<Spark, 'id' | 'created_at' | 'user_id'>,
    embedding: number[],
    userId: string
  ) {
    console.log('=== Saving Spark with Embedding ===');
    console.log('User:', userId);
    console.log('Topic:', spark.topic);
    console.log('Content:', spark.content);
    console.log('Content length:', spark.content.length);
    console.log('Embedding dimensions:', embedding.length);
    
    try {
      const params: CheckAndSaveSparkParams = {
        p_content: spark.content,
        p_topic: spark.topic,
        p_details: spark.details,
        p_user_id: userId,
        p_embedding: embedding,
        p_similarity_threshold: 0.85
      };

      console.log('Calling check_and_save_spark with params:', {
        ...params,
        p_embedding: `[${params.p_embedding.slice(0, 3).join(', ')}...]` // Log just first few values
      });

      const { data, error } = await supabase
        .rpc('check_and_save_spark', params);

      console.log('RPC Response:', { data, error });

      if (error) {
        // Check if this was a similarity error
        if (error.message.includes('Similar spark found')) {
          const similarityScore = parseFloat(error.message.split(' ').pop() || '0');
          console.log('Found similar spark with score:', `${(similarityScore * 100).toFixed(2)}%`);
          throw new Error(`Spark too similar to existing spark (similarity: ${(similarityScore * 100).toFixed(2)}%)`);
        }
        throw error;
      }

      if (!data) {
        console.error('No data returned from check_and_save_spark RPC call');
        throw new Error('No data returned from check_and_save_spark');
      }

      // Log the raw data to understand its structure
      console.log('Raw RPC response data:', JSON.stringify(data, null, 2));

      // Handle both possible response formats
      const sparkId = typeof data === 'string' ? data : data.id;
      
      if (!sparkId) {
        console.error('No spark ID found in response data:', data);
        throw new Error('No ID returned from check_and_save_spark');
      }

      // Log similarity scores if any were returned
      if (data.similarity_scores && data.similarity_scores.length > 0) {
        console.log('=== Similarity Scores ===');
        data.similarity_scores.forEach((score: SimilarityScore) => {
          console.log(`Score: ${(score.similarity_score * 100).toFixed(2)}% for: "${score.content.substring(0, 100)}..."`);
        });
      } else {
        console.log('No similar sparks found');
      }

      console.log('Spark and embedding saved successfully with ID:', sparkId);
      return { id: sparkId, ...spark, user_id: userId };
    } catch (error) {
      console.error('Error in saveSparkWithEmbedding:', error);
      if (error instanceof Error) {
        const pgError = error as unknown as PostgrestError;
        console.error('Error details:', {
          name: pgError.name || error.name,
          message: pgError.message || error.message,
          code: pgError.code,
          details: pgError.details,
          hint: pgError.hint
        });
      }
      throw error;
    }
  }
};
