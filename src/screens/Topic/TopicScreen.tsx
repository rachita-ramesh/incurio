import React, { useEffect, useState } from 'react';
import { SafeAreaView, ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { supabase, supabaseApi } from '../../api/supabase';
import { TopicSelector } from '../../components/TopicSelector';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Topic: undefined;
  Fact: {
    selectedTopics: string[];
  };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Topic'>;
};

export const TopicScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's existing preferences
      const { data: userData, error } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // If user has preferences, go directly to Fact screen
      if (userData?.preferences && userData.preferences.length > 0) {
        navigation.replace('Fact', { selectedTopics: userData.preferences });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicsSelected = async (selectedTopics: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabaseApi.saveUserPreferences(user.id, selectedTopics);
      navigation.replace('Fact', { selectedTopics });
    } catch (error) {
      console.error('Error saving topics:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4285F4" />
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
      <TopicSelector onTopicsSelected={handleTopicsSelected} />
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
  },
}); 