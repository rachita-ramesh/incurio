import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase, supabaseApi } from '../../api/supabase';
import { TopicSelector } from '../../components/TopicSelector';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Account: undefined;
  TopicPreferences: undefined;
  Fact: { selectedTopics: string[] };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TopicPreferences'>;
};

export const TopicPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [currentPreferences, setCurrentPreferences] = useState<string[]>([]);

  useEffect(() => {
    loadCurrentPreferences();
  }, []);

  const loadCurrentPreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData, error } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (userData?.preferences) {
        setCurrentPreferences(userData.preferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTopicsSelected = async (selectedTopics: string[]) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabaseApi.saveUserPreferences(user.id, selectedTopics);
      Alert.alert('Success', 'Your preferences have been updated!');
      navigation.navigate('Fact', { selectedTopics });
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    color: '#6B4EFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
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
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
  },
}); 