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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeableSpark } from '../../components/SwipeableFact';
import { SparkConsumedScreen } from '../../components/SparkConsumedScreen';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';
import { useUser } from '../../contexts/UserContext';

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

  // Show loading state immediately
  useEffect(() => {
    // Reset states when screen mounts
    setLoading(true);
    setError(null);
    setSparkConsumed(false);
    
    // Load spark
    loadSpark();
  }, []);

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

      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      // Check if sparks are available for today or if all consumed
      const sparkAvailable = await sparkGeneratorService.checkIfSparkAvailableToday(user.id);
      
      if (!sparkAvailable) {
        console.log('All sparks consumed for today');
        setSparkConsumed(true);
        setLoading(false);
        return;
      }

      // Get spark (this will now use the cache if available)
      const loadedSpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        selectedTopics,
        JSON.stringify(user.preferences || [])
      );

      if (loadedSpark) {
        setSpark({
          id: loadedSpark.id,
          content: loadedSpark.content,
          topic: loadedSpark.topic,
          details: loadedSpark.details,
          sparkIndex: loadedSpark.sparkIndex
        });
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
      if (!sparkConsumed) {
        loadSpark();
      }
    }, [selectedTopics, sparkConsumed])
  );

  const handleInteraction = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!spark) throw new Error('No spark available');

      // Mark current spark as interacted
      await sparkGeneratorService.markSparkAsInteracted(user.id, spark.sparkIndex);

      // Try to get the next uninteracted spark
      const nextSpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        selectedTopics,
        JSON.stringify(user.preferences || [])
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

  if (error) {
    const now = new Date();
    const hours = Math.floor(SPARK_TIME);
    const minutes = Math.round((SPARK_TIME - hours) * 60);
    const timeString = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    const errorMessage = now.getHours() < SPARK_TIME
      ? `Today's spark will be ready at ${timeString}`
      : error;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text.primary }]}>
            {errorMessage}
          </Text>
          {now.getHours() >= SPARK_TIME && (
            <TouchableOpacity style={styles.retryButton} onPress={loadSpark}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
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
}); 