import React, { useEffect, useState } from 'react';
import { SafeAreaView, ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase, supabaseApi } from '../../api/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { AVAILABLE_TOPICS, Topic } from '../../constants/topics';

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
  const { theme } = useTheme();
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleTopic = (topic: Topic) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleContinue = async () => {
    if (selectedTopics.length === 0) {
      Alert.alert('Select Topics', 'Please select at least one topic to continue.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabaseApi.saveUserPreferences(user.id, selectedTopics);
      navigation.replace('Fact', { selectedTopics });
    } catch (error) {
      console.error('Error saving topics:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          Welcome to Incurio
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Select topics you're interested in to get started with your daily sparks
        </Text>
      </View>

      <View style={styles.topicsGrid}>
        {AVAILABLE_TOPICS.map((topic) => (
          <TouchableOpacity
            key={topic}
            style={[
              styles.topicButton,
              {
                backgroundColor: selectedTopics.includes(topic) ? theme.primary : theme.card,
                borderColor: selectedTopics.includes(topic) ? theme.primary : theme.cardBorder,
              }
            ]}
            onPress={() => toggleTopic(topic)}
          >
            <Text
              style={[
                styles.topicText,
                {
                  color: selectedTopics.includes(topic) ? '#fff' : theme.text.primary,
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
          styles.continueButton,
          {
            backgroundColor: theme.primary,
            opacity: loading ? 0.7 : 1,
          }
        ]}
        onPress={handleContinue}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.continueButtonText}>
            Continue
          </Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
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
    paddingHorizontal: 20,
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
  continueButton: {
    marginHorizontal: 20,
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
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
  },
}); 