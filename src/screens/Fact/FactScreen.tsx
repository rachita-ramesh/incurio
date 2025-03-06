import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { sparkGeneratorService, DAILY_SPARK_KEY, SPARK_TIME } from '../../services/factGenerator';
import { supabase } from '../../api/supabase';
import { supabaseApi } from '../../api/supabase';
import { generateRecommendation, type GeneratedRecommendation } from '../../api/openai';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeableSpark } from '../../components/SwipeableFact';
import { SparkConsumedScreen } from '../../components/SparkConsumedScreen';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { RecommendationModal } from '../../components/RecommendationModal';

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
  sparkIndex: number;
}

export const FactScreen: React.FC<Props> = ({ route, navigation }) => {
  const { selectedTopics } = route.params;
  const [spark, setSpark] = useState<Spark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sparkConsumed, setSparkConsumed] = useState(false);
  const { user } = useUser();
  const { theme } = useTheme();
  const [recommendationModal, setRecommendationModal] = useState<{
    visible: boolean;
    topic: string;
    milestone: number;
    recommendation: GeneratedRecommendation & { id: string };
  } | null>(null);

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

      // Get user preferences from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user preferences:', userError);
      }

      const userPreferences = userData?.preferences || [];

      // Get today's spark without forcing regeneration
      const newSpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        selectedTopics,
        'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
      );

      if (newSpark) {
        setSpark(newSpark);
        setSparkConsumed(false);
      } else {
        // If no spark available, all have been consumed
        setSparkConsumed(true);
      }
    } catch (error) {
      console.error('Error loading spark:', error);
      setError(`Error loading spark: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!sparkConsumed && !spark) {
        loadSpark();
      }
    }, [selectedTopics, sparkConsumed, spark])
  );

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace('Auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleInteraction = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!spark) throw new Error('No spark available');
      console.log('=== Processing Love Interaction ===');
      console.log('User:', user.id);
      console.log('Spark:', spark.id);
      console.log('Topic:', spark.topic);

      // Get user preferences from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user preferences:', userError);
      }

      const userPreferences = userData?.preferences || [];

      // Mark current spark as interacted
      await sparkGeneratorService.markSparkAsInteracted(user.id, spark.sparkIndex);

      // Try to get the next uninteracted spark
      const nextSpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        selectedTopics,
        JSON.stringify(userPreferences)
      );

      if (nextSpark) {
        // If there's another spark, show it
        setSpark(nextSpark);
      } else {
        // If no more sparks, show the consumed screen
        notificationService.scheduleDailyNotification();
        setSparkConsumed(true);
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      // Check if all sparks have been consumed
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const hasConsumed = await sparkGeneratorService.checkIfSparkAvailableToday(user.id);
          if (hasConsumed) {
            notificationService.scheduleDailyNotification();
            setSparkConsumed(true);
            return;
          }
        }
      } catch (checkError) {
        console.error('Error checking spark status:', checkError);
      }
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleSwipeUp = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!spark) throw new Error('No spark available');

      console.log('=== Processing Love Interaction ===');
      console.log('User:', user.id);
      console.log('Spark:', spark.id);
      console.log('Topic:', spark.topic);

      // Save the love interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: spark.id,
          interaction_type: 'love',
        }]);

      if (interactionError) throw interactionError;
      console.log('Saved love interaction successfully');

      // Increment topic love count and check for milestone
      const { hitNewMilestone, milestone } = await supabaseApi.incrementTopicLoveCount(user.id, spark.topic);
      
      if (hitNewMilestone) {
        console.log(`🎉 Hit new milestone of ${milestone} loves for topic ${spark.topic}!`);
        
        // Fetch loved sparks for this topic
        const lovedSparks = await supabaseApi.getLovedSparksForTopic(user.id, spark.topic);
        
        // Generate recommendation using OpenAI
        const recommendation = await generateRecommendation(spark.topic, lovedSparks);
        
        // Save the recommendation
        const savedRecommendation = await supabaseApi.saveRecommendation(
          user.id,
          spark.topic,
          recommendation,
          milestone
        );
        
        console.log('Successfully generated and saved recommendation:', savedRecommendation.id);
        
        // Show celebration modal
        setRecommendationModal({
          visible: true,
          topic: spark.topic,
          milestone,
          recommendation: {
            ...recommendation,
            id: savedRecommendation.id
          }
        });
      }

      await handleInteraction();
    } catch (error) {
      console.error('Error handling swipe up:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleSwipeLeft = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!spark) throw new Error('No spark available');

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!spark) throw new Error('No spark available');

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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Loading your spark...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || sparkConsumed) {
    const now = new Date();
    const hours = Math.floor(SPARK_TIME);
    const minutes = Math.round((SPARK_TIME - hours) * 60);
    const timeString = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    const errorMessage = now.getHours() < SPARK_TIME
      ? `Today's spark will be ready at ${timeString}`
      : error;
      const handleReset = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          await sparkGeneratorService.resetForTesting(user.id);
          setSparkConsumed(false);
          setError(null);
          loadSpark();
        } catch (error) {
          console.error('Error resetting:', error);
        }
      };  

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text.primary }]}>
            {errorMessage}
          </Text>
          <View style={styles.buttonContainer}>
            {now.getHours() >= SPARK_TIME && (
              <TouchableOpacity style={styles.retryButton} onPress={loadSpark}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
            {__DEV__ && (
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: '#FF6B6B', marginTop: 10 }]} 
                onPress={handleReset}
              >
                <Text style={styles.retryButtonText}>Reset For Testing</Text>
              </TouchableOpacity>
            )}
          </View>
                <View style={styles.buttonContainer}>
            {now.getHours() >= SPARK_TIME && (
              <TouchableOpacity style={styles.retryButton} onPress={loadSpark}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
            {__DEV__ && (
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: '#FF6B6B', marginTop: 10 }]} 
                onPress={handleReset}
              >
                <Text style={styles.retryButtonText}>Reset For Testing</Text>
              </TouchableOpacity>
            )}
          </View>
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
        <SwipeableSpark
          spark={spark}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onSwipeUp={handleSwipeUp}
        />
      )}
      
      {recommendationModal && (
        <RecommendationModal
          visible={recommendationModal.visible}
          onClose={() => setRecommendationModal(null)}
          topic={recommendationModal.topic}
          milestone={recommendationModal.milestone}
          recommendation={recommendationModal.recommendation}
        />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  retryButton: {
    backgroundColor: '#6B4EFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
  },
  curiosityHubButton: {
    marginRight: 8,
  },
  curiosityHubButtonText: {
    fontSize: 24,
  },
    buttonContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
}); 