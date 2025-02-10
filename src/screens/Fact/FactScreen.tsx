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
import auth from '@react-native-firebase/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Fact: {
    selectedTopics: string[];
  };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Fact'>;

export const FactScreen: React.FC<Props> = ({ route, navigation }) => {
  const [fact, setFact] = useState<{ content: string; topic: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      await auth().signOut();
      navigation.replace('Auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const loadFact = async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = auth().currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const dailyFact = await factGeneratorService.getTodaysFact(
        userId,
        route.params.selectedTopics,
        'Prefer concise, interesting facts that are easy to understand.'
      );
      
      if (!dailyFact.content) {
        throw new Error('No fact content received');
      }
      
      setFact({
        content: dailyFact.content,
        topic: dailyFact.topic
      });
    } catch (err) {
      console.error('Error loading fact:', err);
      setError('Failed to load today\'s fact. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFact();
  }, []);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.topicLabel}>TODAY'S FACT ABOUT</Text>
        <Text style={styles.topic}>{fact?.topic?.toUpperCase()}</Text>
        <View style={styles.factCard}>
          <Text style={styles.factText}>{fact?.content}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={loadFact}>
          <Text style={styles.refreshButtonText}>Get Another Fact</Text>
        </TouchableOpacity>
      </View>
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
  signOutButton: {
    padding: 12,
  },
  signOutText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '600',
  },
}); 