import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { factGeneratorService } from '../../services/factGenerator';
import { supabase } from '../../api/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeableFact } from '../../components/SwipeableFact';
import { FactConsumedScreen } from '../../components/FactConsumedScreen';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../../services/notificationService';

type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Fact: {
    selectedTopics: string[];
  };
  Account: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Fact'>;

interface Fact {
  id: string;
  content: string;
  topic: string;
  details: string;
}

export const FactScreen: React.FC<Props> = ({ route, navigation }) => {
  const [fact, setFact] = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factConsumed, setFactConsumed] = useState(false);

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
        <TouchableOpacity onPress={() => navigation.navigate('Account')} style={styles.accountButton}>
          <Text style={styles.accountButtonText}>👤</Text>
        </TouchableOpacity>
      ),
      headerTitleStyle: {
        fontFamily: 'AvenirNext-Medium',
        fontSize: 20,
      },
    });
  }, [navigation]);

  const loadFact = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if user has already consumed today's fact
      const hasConsumed = await factGeneratorService.checkIfFactAvailableToday(user.id);
      if (hasConsumed) {
        setFactConsumed(true);
        return;
      }

      const dailyFact = await factGeneratorService.getTodaysFact(
        user.id,
        route.params.selectedTopics,
        'Prefer concise, interesting facts that are easy to understand.'
      );
      
      if (!dailyFact.content || !dailyFact.id) {
        throw new Error('Invalid fact received: missing content or ID');
      }
      
      console.log('Setting fact with ID:', dailyFact.id);
      setFact({
        id: dailyFact.id,
        content: dailyFact.content,
        topic: dailyFact.topic,
        details: dailyFact.details
      });
    } catch (err) {
      console.error('Error loading fact:', err);
      setError('Failed to load today\'s fact. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!factConsumed) {
        loadFact();
      }
    }, [route.params.selectedTopics, factConsumed])
  );

  const handleSwipeUp = async () => {
    try {
      if (!fact) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save the love interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          fact_id: fact.id,
          interaction_type: 'love',
        }]);

      if (interactionError) throw interactionError;
      console.log('Loved fact:', fact.content);
      
      // Schedule next notification
      notificationService.scheduleDailyNotification();
      
      setFactConsumed(true);
    } catch (error) {
      console.error('Error handling swipe up:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleSwipeLeft = async () => {
    try {
      if (!fact) return;
      if (!fact.id) {
        console.error('Cannot save interaction: fact has no ID');
        setError('Failed to process your response. Please try again.');
        return;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('Saving dislike interaction for fact:', fact.id);
      // Save the dislike interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          fact_id: fact.id,
          interaction_type: 'dislike',
        }]);

      if (interactionError) throw interactionError;
      console.log('Successfully saved dislike for fact:', fact.id);
      
      // Schedule next notification
      notificationService.scheduleDailyNotification();
      
      setFactConsumed(true);
    } catch (error) {
      console.error('Error handling swipe left:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleSwipeRight = async () => {
    try {
      if (!fact) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save the like interaction
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert([{
          user_id: user.id,
          fact_id: fact.id,
          interaction_type: 'like',
        }]);

      if (interactionError) throw interactionError;
      console.log('Liked fact:', fact.content);
      
      // Schedule next notification
      notificationService.scheduleDailyNotification();
      
      setFactConsumed(true);
    } catch (error) {
      console.error('Error handling swipe right:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Generating your daily fact...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadFact}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (factConsumed) {
    return <FactConsumedScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {fact && (
        <SwipeableFact
          fact={fact}
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
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
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
  topicLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  topic: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4285F4',
    marginBottom: 24,
  },
  factCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  factText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountButton: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
  },
  accountButtonText: {
    color: '#4285F4',
    fontSize: 28,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
}); 