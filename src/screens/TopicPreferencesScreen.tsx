import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { supabase } from '../api/supabase';
import { TopicSelector } from '../components/TopicSelector';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Fact: { selectedTopics: string[] };
  Account: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Fact'>;

export const TopicPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [currentPreferences, setCurrentPreferences] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentPreferences();
  }, []);

  const loadCurrentPreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: preferences, error } = await supabase
        .from('user_preferences')
        .select('topics')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      if (preferences?.topics) {
        setCurrentPreferences(preferences.topics);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      setError('Failed to load your preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleTopicsSelected = async (selectedTopics: string[]) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, try to update existing preferences
      const { error: upsertError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          topics: selectedTopics,
          updated_at: new Date().toISOString()
        });

      if (upsertError) throw upsertError;

      // Navigate back to fact screen with new topics
      navigation.navigate('Fact', { selectedTopics });
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Failed to save your preferences');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading your preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Topic Preferences</Text>
        <Text style={styles.subtitle}>
          Select the topics you're interested in learning about
        </Text>
      </View>
      <TopicSelector
        onTopicsSelected={handleTopicsSelected}
        initialTopics={currentPreferences}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
}); 