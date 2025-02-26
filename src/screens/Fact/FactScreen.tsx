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
    let timeoutId: NodeJS.Timeout | undefined;
    
    try {
      setLoading(true);
      setError(null);
      
      // Create an AbortController for the API request
      const abortController = new AbortController();
      
      // Add timeout
      timeoutId = setTimeout(() => {
        abortController.abort();
        setError('Taking too long to generate spark. Please try again.');
        setLoading(false);
      }, 30000); // 30 second timeout
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if user has already consumed today's spark
      const hasConsumed = await sparkGeneratorService.checkIfSparkAvailableToday(user.id);
      if (hasConsumed) {
        clearTimeout(timeoutId);
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
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }
      }

      const dailySpark = await sparkGeneratorService.getTodaysSpark(
        user.id,
        route.params.selectedTopics,
        'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
      );
      
      clearTimeout(timeoutId);
      
      if (!dailySpark) {
        throw new Error(`Too early for today's spark. Please wait until 9:00 AM.`);
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
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load today\'s spark. Please try again later.');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
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