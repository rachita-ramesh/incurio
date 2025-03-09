import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeneratedRecommendation } from './openai';

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
}

export interface UserInteraction {
  id: string;
  user_id: string;
  spark_id: string;
  interaction_type: 'dislike' | 'like' | 'love';
  created_at: string;
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
    const newMilestone = Math.floor(newCount / 10) * 10;
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
          last_milestone: 0
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

  async getSparksForDate(userId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get sparks created for this date (either created today or pre-generated yesterday)
    return await supabase
      .from('sparks')
      .select('*')
      .eq('user_id', userId)
      .or(`created_at.gte.${startOfDay.toISOString()},created_at.gte.${new Date(startOfDay.getTime() - 24*60*60*1000).toISOString()}`)
      .lt('created_at', endOfDay.toISOString());
  }
};
