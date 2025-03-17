import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Image,
  Alert,
  RefreshControl,
  AppState,
  Platform,
  AppStateStatus,
} from 'react-native';
import { sparkGeneratorService, DAILY_SPARK_KEY } from '../../services/sparkGenerator';
import { supabase, supabaseApi } from '../../api/supabase';
import { generateRecommendation, type GeneratedRecommendation } from '../../api/openai';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeableSpark } from '../../components/SwipeableFact';
import { ScrollView } from 'react-native-gesture-handler';
import { RotateNoteIcon } from '../../components/common/RotateNoteIcon';
import { colors } from '../../theme/colors';
import { notificationService } from '../../services/notificationService';
import { useUser } from '../../contexts/UserContext';
import { RecommendationModal } from '../../components/RecommendationModal';
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
  sparkIndex: number;
  created_at?: string;  // Optional since we might not always have it
}

// Helper to convert DailySpark to Spark
const convertToSpark = (dailySpark: any): Spark => ({
  id: dailySpark.id,
  content: dailySpark.content,
  topic: dailySpark.topic,
  details: dailySpark.details,
  sparkIndex: dailySpark.sparkIndex,
  created_at: dailySpark.generatedAt
});

// Constants for spark availability
const SPARK_AVAILABILITY = {
  START_HOUR: 4, // 4 AM
  END_HOUR: 23, // 11 PM
};

interface RecommendationModalState {
  visible: boolean;
  topic: string;
  milestone: number;
  recommendation: GeneratedRecommendation & { id: string };
}

// Helper function to get uninteracted sparks count
const getUninteractedSparksCount = async (userId: string): Promise<number> => {
  try {
    // Get today's date range in UTC
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // First get all sparks for today
    const { data: todaySparks, error: sparksError } = await supabase
      .from('sparks')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString());

    if (sparksError) throw sparksError;
    if (!todaySparks) return 0;

    // Then get all interactions for today's sparks
    const { data: interactions, error: interactionsError } = await supabase
      .from('user_interactions')
      .select('spark_id')
      .eq('user_id', userId)
      .in('spark_id', todaySparks.map(spark => spark.id));

    if (interactionsError) throw interactionsError;

    // Calculate uninteracted sparks
    const interactedSparkIds = new Set(interactions?.map(i => i.spark_id) || []);
    const uninteractedCount = todaySparks.filter(spark => !interactedSparkIds.has(spark.id)).length;

    console.log('=== Uninteracted Sparks Status ===');
    console.log(`Total sparks for today: ${todaySparks.length}`);
    console.log(`Interacted sparks: ${interactedSparkIds.size}`);
    console.log(`Uninteracted sparks remaining: ${uninteractedCount}`);

    return uninteractedCount;
  } catch (error) {
    console.error('Error getting uninteracted sparks count:', error);
    return 0;
  }
};

export const FactScreen: React.FC<Props> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spark, setSpark] = useState<Spark | null>(null);
  const [sparkConsumed, setSparkConsumed] = useState(false);
  const [recommendationModal, setRecommendationModal] = useState<RecommendationModalState | null>(null);
  const selectedTopics = route.params?.selectedTopics || [];
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const { user } = useUser();
  const appState = useRef(AppState.currentState);
  const isLoadingRef = useRef(false);
  const processingInteractionRef = useRef(false); // Reference to track if an interaction is in progress

  useEffect(() => {
    loadUserPreferences();
    // Initial load when component mounts
    loadSpark();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('App has come to the foreground!');
      await loadSpark();
    }

    appState.current = nextAppState;
  };

  const loadUserPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData, error } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserPreferences(userData?.preferences || []);
    } catch (error) {
      console.error('Error loading user preferences:', error);
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
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) {
      console.log('Already loading sparks, skipping...');
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Log uninteracted sparks count before loading
      const uninteractedCount = await getUninteractedSparksCount(user.id);
      console.log('Starting loadSpark with', uninteractedCount, 'uninteracted sparks');

      // Get today's date range in UTC
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // First try getting spark through sparkGeneratorService
      const dailySpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        selectedTopics,
        'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
      );

      let newSpark: Spark | null = dailySpark ? convertToSpark(dailySpark) : null;

      // If no spark returned but we know there are uninteracted sparks, fetch directly from Supabase
      if (!newSpark && uninteractedCount > 0) {
        console.log('getTodaysSpark returned null but uninteracted sparks exist, fetching manually...');
        
        // Get all sparks for today
        const { data: todaySparks, error: sparksError } = await supabase
          .from('sparks')
          .select('id, content, topic, details, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startOfDay.toISOString())
          .lt('created_at', endOfDay.toISOString());

        if (sparksError) {
          console.error('Error fetching today\'s sparks:', sparksError);
          throw sparksError;
        }
        
        if (!todaySparks || todaySparks.length === 0) {
          console.log('No sparks found for today');
          return;
        }
        
        console.log(`Found ${todaySparks.length} total sparks for today`);

        // Get all interactions for this user
        const { data: interactions, error: interactionsError } = await supabase
          .from('user_interactions')
          .select('spark_id')
          .eq('user_id', user.id);

        if (interactionsError) {
          console.error('Error fetching interactions:', interactionsError);
          throw interactionsError;
        }

        // Create a set of interacted spark IDs for quick lookup
        const interactedIds = new Set(interactions?.map(i => i.spark_id) || []);
        console.log(`User has interacted with ${interactedIds.size} sparks in total`);

        // Find first uninteracted spark
        const uninteractedSpark = todaySparks.find(spark => !interactedIds.has(spark.id));
        
        if (uninteractedSpark) {
          console.log('Found uninteracted spark with ID:', uninteractedSpark.id);
          newSpark = {
            id: uninteractedSpark.id,
            content: uninteractedSpark.content,
            topic: uninteractedSpark.topic,
            details: uninteractedSpark.details,
            sparkIndex: 1, // Default to 1 since we're bypassing sparkGeneratorService
            created_at: uninteractedSpark.created_at
          };
        } else {
          console.log('All sparks have been interacted with');
        }
      }

      if (newSpark) {
        console.log('Setting spark:', newSpark.id);
        setSpark(newSpark);
        setSparkConsumed(false);
      } else {
        // Double check one last time
        const remainingCount = await getUninteractedSparksCount(user.id);
        console.log('Final check - Uninteracted sparks remaining:', remainingCount);
        setSparkConsumed(remainingCount === 0);
      }
    } catch (error) {
      console.error('Error loading spark:', error);
      setError(`Error loading spark: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

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
    // Prevent multiple simultaneous interactions
    if (processingInteractionRef.current) {
      console.log('Already processing an interaction, skipping...');
      return;
    }

    try {
      processingInteractionRef.current = true; // Set flag to indicate interaction in progress
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!spark) throw new Error('No spark available');
      
      // Capture current spark to ensure consistency
      const currentSpark = { ...spark };
      
      // Log uninteracted count before interaction
      const beforeCount = await getUninteractedSparksCount(user.id);
      console.log('=== Processing Interaction ===');
      console.log('Uninteracted sparks before:', beforeCount);
      console.log('User:', user.id);
      console.log('Spark:', currentSpark.id);
      console.log('Topic:', currentSpark.topic);

      // Record interaction in Supabase directly (using 'like' instead of 'view')
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: currentSpark.id,
          interaction_type: 'like',
        }]);

      if (interactionError) {
        console.error('Error recording interaction:', interactionError);
        throw interactionError;
      }

      // Mark current spark as interacted in local storage too
      await sparkGeneratorService.markSparkAsInteracted(user.id, currentSpark.sparkIndex);

      // Try to get the next uninteracted spark via sparkGeneratorService
      const dailySpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        selectedTopics,
        JSON.stringify(userPreferences)
      );

      let nextSpark: Spark | null = dailySpark ? convertToSpark(dailySpark) : null;

      // If service returns null, try manual approach
      if (!nextSpark) {
        console.log('handleInteraction: Trying manual fetch of next uninteracted spark');
        
        // Get today's date range in UTC
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Get all sparks for today
        const { data: todaySparks, error: sparksError } = await supabase
          .from('sparks')
          .select('id, content, topic, details, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startOfDay.toISOString())
          .lt('created_at', endOfDay.toISOString());

        if (sparksError) {
          console.error('Error fetching today\'s sparks after interaction:', sparksError);
          throw sparksError;
        }
        
        if (todaySparks && todaySparks.length > 0) {
          // Get all interactions
          const { data: interactions, error: interactionsError } = await supabase
            .from('user_interactions')
            .select('spark_id')
            .eq('user_id', user.id);

          if (interactionsError) {
            console.error('Error fetching interactions after interaction:', interactionsError);
            throw interactionsError;
          }

          // Find uninteracted sparks (excluding the current one)
          const interactedIds = new Set(interactions?.map(i => i.spark_id) || []);
          const uninteractedSpark = todaySparks.find(s => !interactedIds.has(s.id) && s.id !== currentSpark.id);
          
          if (uninteractedSpark) {
            console.log('Found next uninteracted spark with ID:', uninteractedSpark.id);
            nextSpark = {
              id: uninteractedSpark.id,
              content: uninteractedSpark.content,
              topic: uninteractedSpark.topic,
              details: uninteractedSpark.details,
              sparkIndex: currentSpark.sparkIndex + 1,
              created_at: uninteractedSpark.created_at
            };
          }
        }
      }

      // Log uninteracted count after interaction
      const afterCount = await getUninteractedSparksCount(user.id);
      console.log('Uninteracted sparks after:', afterCount);

      if (nextSpark) {
        console.log('Setting next spark:', nextSpark.id);
        setSpark(nextSpark);
        setSparkConsumed(false);
      } else {
        console.log('No more uninteracted sparks found');
        notificationService.scheduleDailyNotification();
        setSparkConsumed(true);
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const remainingCount = await getUninteractedSparksCount(user.id);
          console.log('Error recovery - Uninteracted sparks:', remainingCount);
          setSparkConsumed(remainingCount === 0);
        }
      } catch (checkError) {
        console.error('Error checking spark status:', checkError);
      }
      setError('Failed to process your response. Please try again.');
    } finally {
      // Add a small delay before allowing another interaction
      setTimeout(() => {
        processingInteractionRef.current = false;
      }, 300);
    }
  };

  const handleSwipeUp = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!spark) throw new Error('No spark available');

      // Store the current spark ID to track if it changes during async operations
      const currentSparkId = spark.id;

      console.log('=== Processing Love Interaction ===');
      console.log('User:', user.id);
      console.log('Spark:', currentSparkId);
      console.log('Topic:', spark.topic);

      // Save the love interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: currentSparkId,
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

      // Check if the current spark is still the one we processed
      // If state has changed during async operations, don't proceed with handleInteraction
      if (spark && spark.id === currentSparkId) {
        await handleInteraction();
      } else {
        console.log('Spark changed during love interaction processing, skipping handleInteraction');
      }
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

      // Store current spark ID
      const currentSparkId = spark.id;

      // Save the dislike interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: currentSparkId,
          interaction_type: 'dislike',
        }]);

      if (interactionError) throw interactionError;
      console.log('Disliked spark:', spark.content);
      
      // Only proceed if spark hasn't changed
      if (spark && spark.id === currentSparkId) {
        await handleInteraction();
      } else {
        console.log('Spark changed during dislike processing, skipping handleInteraction');
      }
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

      // Store current spark ID
      const currentSparkId = spark.id;

      // Save the like interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          spark_id: currentSparkId,
          interaction_type: 'like',
        }]);

      if (interactionError) throw interactionError;
      console.log('Liked spark:', spark.content);
      
      // Only proceed if spark hasn't changed
      if (spark && spark.id === currentSparkId) {
        await handleInteraction();
      } else {
        console.log('Spark changed during like processing, skipping handleInteraction');
      }
    } catch (error) {
      console.error('Error handling swipe right:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const checkSparkAvailability = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Sparks are available from 4 AM to 11 PM
    return currentHour >= SPARK_AVAILABILITY.START_HOUR;
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Try to get spark from sparkGeneratorService
      const dailySpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        selectedTopics,
        JSON.stringify(userPreferences)
      );

      let newSpark: Spark | null = dailySpark ? convertToSpark(dailySpark) : null;

      // If service returns null, try manual approach
      if (!newSpark) {
        console.log('handleRefresh: Trying manual fetch of uninteracted sparks');
        
        // Get today's date range in UTC
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Get all of today's sparks
        const { data: todaySparks, error: sparksError } = await supabase
          .from('sparks')
          .select('id, content, topic, details, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startOfDay.toISOString())
          .lt('created_at', endOfDay.toISOString());

        if (sparksError) {
          console.error('Error fetching today\'s sparks:', sparksError);
          throw sparksError;
        }
        
        if (todaySparks && todaySparks.length > 0) {
          console.log(`Refresh found ${todaySparks.length} total sparks for today`);
          
          // Get all interactions
          const { data: interactions, error: interactionsError } = await supabase
            .from('user_interactions')
            .select('spark_id')
            .eq('user_id', user.id);

          if (interactionsError) {
            console.error('Error fetching interactions:', interactionsError);
            throw interactionsError;
          }

          // Find uninteracted sparks
          const interactedIds = new Set(interactions?.map(i => i.spark_id) || []);
          console.log(`Refresh: User has interacted with ${interactedIds.size} sparks in total`);
          
          const uninteractedSpark = todaySparks.find(spark => !interactedIds.has(spark.id));
          
          if (uninteractedSpark) {
            console.log('Refresh found uninteracted spark with ID:', uninteractedSpark.id);
            newSpark = {
              id: uninteractedSpark.id,
              content: uninteractedSpark.content,
              topic: uninteractedSpark.topic,
              details: uninteractedSpark.details,
              sparkIndex: 1,
              created_at: uninteractedSpark.created_at
            };
          } else {
            console.log('Refresh: All sparks have been interacted with');
          }
        }
      }

      if (newSpark) {
        console.log('Setting spark from refresh:', newSpark.id);
        setSpark(newSpark);
        setSparkConsumed(false);
      } else {
        // One final check
        const remainingCount = await getUninteractedSparksCount(user.id);
        console.log('Final refresh check - Uninteracted sparks remaining:', remainingCount);
        setSparkConsumed(remainingCount === 0);
      }
      setError(null);
    } catch (error) {
      console.error('Error refreshing spark:', error);
      setError('Failed to refresh your spark. Please try again.');
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
            Loading your spark...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sparkConsumed) {
    return <SparkConsumedScreen />;
  }

  const errorMessage = !checkSparkAvailability()
    ? `Your daily sparks will be available at ${SPARK_AVAILABILITY.START_HOUR}:00 AM`
    : 'No sparks available. Please try again later.';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text.primary }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : sparkConsumed ? (
        <View style={styles.consumedContainer}>
          <Text style={[styles.consumedText, { color: theme.text.primary }]}>
            You've seen all your sparks for today!
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshButtonText}>Check Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {checkSparkAvailability() && spark && (
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
        </>
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
  consumedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consumedText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  refreshButton: {
    backgroundColor: '#6B4EFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
  },
}); 