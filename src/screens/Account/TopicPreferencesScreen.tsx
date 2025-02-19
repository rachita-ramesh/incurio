import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase, supabaseApi } from '../../api/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { AVAILABLE_TOPICS, Topic } from '../../constants/topics';

type RootStackParamList = {
  Auth: undefined;
  Topic: undefined;
  Fact: { selectedTopics: string[] };
  TopicPreferences: undefined;
  AccountSettings: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TopicPreferences'>;
};

export const TopicPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [currentPreferences, setCurrentPreferences] = useState<Topic[]>([]);

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

  const toggleTopic = (topic: Topic) => {
    setCurrentPreferences(prev => 
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleSavePreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabaseApi.saveUserPreferences(user.id, currentPreferences);
      Alert.alert(
        'Success',
        'Your preferences have been updated! Changes will take effect with your next daily spark.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Loading your preferences...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.primary }]}>
            Topic Preferences
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Select topics you're interested in to personalize your daily sparks
          </Text>
        </View>

        <View style={styles.topicsGrid}>
          {AVAILABLE_TOPICS.map((topic) => (
            <TouchableOpacity
              key={topic}
              style={[
                styles.topicButton,
                {
                  backgroundColor: currentPreferences.includes(topic) ? theme.primary : theme.card,
                  borderColor: currentPreferences.includes(topic) ? theme.primary : theme.cardBorder,
                }
              ]}
              onPress={() => toggleTopic(topic)}
            >
              <Text
                style={[
                  styles.topicText,
                  {
                    color: currentPreferences.includes(topic) ? '#fff' : theme.text.primary,
                  }
                ]}
              >
                {topic}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.primary,
              opacity: loading ? 0.7 : 1,
            }
          ]}
          onPress={handleSavePreferences}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            Save Preferences
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    lineHeight: 22,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  topicButton: {
    width: '31%',
    marginHorizontal: '1%',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicText: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6B4EFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
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
  },
}); 