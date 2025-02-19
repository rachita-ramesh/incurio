import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { sparkGeneratorService } from '../../services/factGenerator';
import { DAILY_SPARK_KEY } from '../../services/factGenerator';
import { supabase } from '../../api/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeableSpark } from '../../components/SwipeableFact';
import { SparkConsumedScreen } from '../../components/SparkConsumedScreen';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';

type RootStackParamList = {
  Auth: undefined;
  Topic: undefined;
  Fact: {
    selectedTopics: string[];
  };
  CuriosityHub: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Fact'>;

interface Spark {
  id: string;
  content: string;
  topic: string;
  details: string;
}

export const FactScreen: React.FC<Props> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const [spark, setSpark] = useState<Spark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sparkConsumed, setSparkConsumed] = useState(false);
  const [reaction, setReaction] = useState<'dislike' | 'like' | 'love' | null>(null);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace('Auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('CuriosityHub')} style={styles.curiosityHubButton}>
          <Text style={styles.curiosityHubButtonText}>🧠</Text>
        </TouchableOpacity>
      ),
      headerTitleStyle: {
        fontFamily: 'AvenirNext-Medium',
        fontSize: 20,
      },
    });
  }, [navigation]);

  const loadSpark = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if user has already consumed today's spark
      const hasConsumed = await sparkGeneratorService.checkIfSparkAvailableToday(user.id);
      if (hasConsumed) {
        setSparkConsumed(true);
        return;
      }

      // Check if we have a spark for today but haven't interacted with it
      const hasSpark = await sparkGeneratorService.hasSparkForToday(user.id);
      if (hasSpark) {
        const storedSpark = await AsyncStorage.getItem(`${DAILY_SPARK_KEY}_${user.id}`);
        if (storedSpark) {
          const parsedSpark = JSON.parse(storedSpark);
          setSpark({
            id: parsedSpark.id,
            content: parsedSpark.content,
            topic: parsedSpark.topic,
            details: parsedSpark.details
          });
          setLoading(false);
          return;
        }
      }

      const dailySpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        route.params.selectedTopics,
        'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
      );
      
      if (!dailySpark) {
        throw new Error('No spark available yet. Please wait until 8 AM.');
      }
      
      if (!dailySpark.content || !dailySpark.id) {
        throw new Error('Invalid spark received: missing content or ID');
      }
      
      console.log('Setting spark with ID:', dailySpark.id);
      setSpark({
        id: dailySpark.id,
        content: dailySpark.content,
        topic: dailySpark.topic,
        details: dailySpark.details
      });
    } catch (err) {
      console.error('Error loading spark:', err);
      setError('Failed to load today\'s spark. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!sparkConsumed) {
        loadSpark();
      }
    }, [route.params.selectedTopics, sparkConsumed])
  );

  const handleInteraction = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await sparkGeneratorService.markSparkAsInteracted(user.id);
      notificationService.scheduleDailyNotification();
      setSparkConsumed(true);
    } catch (error) {
      console.error('Error handling interaction:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleSwipeUp = async () => {
    try {
      if (!spark) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save the love interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: spark.id,
          interaction_type: 'love',
        }]);

      if (interactionError) throw interactionError;
      console.log('Loved spark:', spark.content);
      
      await handleInteraction();
    } catch (error) {
      console.error('Error handling swipe up:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleSwipeLeft = async () => {
    try {
      if (!spark) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save the dislike interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: spark.id,
          interaction_type: 'dislike',
        }]);

      if (interactionError) throw interactionError;
      console.log('Disliked spark:', spark.content);
      
      await handleInteraction();
    } catch (error) {
      console.error('Error handling swipe left:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleSwipeRight = async () => {
    try {
      if (!spark) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save the like interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: spark.id,
          interaction_type: 'like',
        }]);

      if (interactionError) throw interactionError;
      console.log('Liked spark:', spark.content);
      
      await handleInteraction();
    } catch (error) {
      console.error('Error handling swipe right:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleReaction = async (type: 'dislike' | 'like' | 'love') => {
    setReaction(type);
    switch (type) {
      case 'dislike':
        await handleSwipeLeft();
        break;
      case 'like':
        await handleSwipeRight();
        break;
      case 'love':
        await handleSwipeUp();
        break;
    }
  };

  const handleNext = () => {
    if (reaction) {
      setSparkConsumed(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Generating your daily spark...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text.primary }]}>
            {error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSpark}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (sparkConsumed) {
    return <SparkConsumedScreen />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {spark && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.factCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.factText, { color: theme.text.primary }]}>
              {spark.content}
            </Text>
            <View style={styles.factMeta}>
              <Text style={[styles.factCategory, { color: theme.text.secondary }]}>
                {spark.topic}
              </Text>
              <Text style={[styles.factDate, { color: theme.text.secondary }]}>
                {new Date(spark.details).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.reactionContainer}>
            <TouchableOpacity
              style={[
                styles.reactionButton,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  opacity: reaction === 'dislike' ? 1 : 0.7 
                }
              ]}
              onPress={() => handleReaction('dislike')}
            >
              <Text style={styles.reactionEmoji}>👎</Text>
              <Text style={[styles.reactionText, { color: theme.text.primary }]}>
                Meh
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reactionButton,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  opacity: reaction === 'like' ? 1 : 0.7 
                }
              ]}
              onPress={() => handleReaction('like')}
            >
              <Text style={styles.reactionEmoji}>👍</Text>
              <Text style={[styles.reactionText, { color: theme.text.primary }]}>
                Nice
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reactionButton,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  opacity: reaction === 'love' ? 1 : 0.7 
                }
              ]}
              onPress={() => handleReaction('love')}
            >
              <Text style={styles.reactionEmoji}>🤯</Text>
              <Text style={[styles.reactionText, { color: theme.text.primary }]}>
                Woah
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.primary }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              Next Spark
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    padding: 20,
  },
  factCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  factText: {
    fontSize: 18,
    fontFamily: 'AvenirNext-Regular',
    lineHeight: 26,
    marginBottom: 16,
  },
  factMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factCategory: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
  },
  factDate: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Regular',
  },
  reactionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  reactionButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  reactionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  reactionText: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6B4EFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'AvenirNext-Medium',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  curiosityHubButton: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
  },
  curiosityHubButtonText: {
    color: '#6B4EFF',
    fontSize: 28,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
}); 