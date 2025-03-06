import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../api/supabase';
import { useUser } from '../../contexts/UserContext';

type RootStackParamList = {
  CuriosityTrails: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CuriosityTrails'>;
};

interface Recommendation {
  id: string;
  content: string;
  topic: string;
  details: string;
  created_at: string;
  recommendation: {
    title: string;
    type: 'book' | 'movie' | 'documentary';
    why_recommended: string;
  };
}

export const CuriosityTrailsScreen: React.FC<Props> = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      if (!user) throw new Error('User not authenticated');
      
      // Query sparks that are curiosity trails and have a user interaction from this user
      const { data, error } = await supabase
        .from('sparks')
        .select(`
          *,
          user_interactions!inner (
            user_id
          )
        `)
        .eq('is_curiosity_trail', true)
        .eq('user_interactions.user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecommendations(data as Recommendation[]);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Recommendation }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.contentType}>{item.recommendation.type}</Text>
        <Text style={styles.topic}>{item.topic}</Text>
      </View>
      <Text style={styles.title}>{item.recommendation.title}</Text>
      <Text style={styles.pitch}>{item.recommendation.why_recommended}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B4EFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Curiosity Trails</Text>
          <Text style={styles.headerIcon}>🗺️</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Personalized recommendations based on your interests
        </Text>
      </View>
      <FlatList
        data={recommendations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recommendations yet. Keep loving sparks to get personalized recommendations!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'AvenirNext-Regular',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'AvenirNext-Bold',
    color: '#6B4EFF',
    marginRight: 8,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6B4EFF',
    shadowColor: '#6B4EFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contentType: {
    fontSize: 14,
    fontFamily: 'AvenirNext-DemiBold',
    color: '#6B4EFF',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    textTransform: 'uppercase',
  },
  topic: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
    color: '#4338CA',
  },
  title: {
    fontSize: 18,
    fontFamily: 'AvenirNext-DemiBold',
    color: '#000',
    marginBottom: 8,
  },
  pitch: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
    lineHeight: 22,
  },
}); 