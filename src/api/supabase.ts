import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface User {
  id: string;
  email: string;
  preferences: string[];
  created_at: string;
}

export interface Fact {
  id: string;
  content: string;
  topic: string;
  created_at: string;
}

export interface UserInteraction {
  id: string;
  user_id: string;
  fact_id: string;
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

  async saveFact(fact: Omit<Fact, 'id' | 'created_at'>) {
    return await supabase
      .from('facts')
      .insert([fact]);
  },

  async saveInteraction(interaction: Omit<UserInteraction, 'id' | 'created_at'>) {
    return await supabase
      .from('user_interactions')
      .insert([interaction]);
  },

  async getUserHistory(userId: string) {
    return await supabase
      .from('facts')
      .select(`
        *,
        user_interactions!inner(interaction_type)
      `)
      .eq('user_interactions.user_id', userId)
      .order('created_at', { ascending: false });
  }
};
