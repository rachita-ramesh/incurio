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
import { useTheme } from '../../theme/ThemeContext';

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
  const { theme } = useTheme();

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      if (!user) throw new Error('User not authenticated');
      
      // Directly query sparks that belong to the user and are curiosity trails
      const { data, error } = await supabase
        .from('sparks')
        .select(`
          id,
          content,
          topic,
          details,
          created_at,
          recommendation
        `)
        .eq('user_id', user.id)
        .eq('is_curiosity_trail', true)
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
    <TouchableOpacity 
      style={[
        styles.card, 
        { 
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[
          styles.contentType, 
          { 
            color: theme.primary,
            backgroundColor: theme.surface 
          }
        ]}>
          {item.recommendation.type}
        </Text>
        <Text style={[styles.topic, { color: theme.primary }]}>
          {item.topic}
        </Text>
      </View>
      <Text style={[styles.title, { color: theme.text.primary }]}>
        {item.recommendation.title}
      </Text>
      <Text style={[styles.pitch, { color: theme.text.secondary }]}>
        {item.recommendation.why_recommended}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>
            My Curiosity Trails
          </Text>
          <Text style={styles.headerIcon}>🗺️</Text>
        </View>
        <Text style={[styles.headerSubtitle, { color: theme.text.secondary }]}>
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
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              No recommendations yet. Keep loving sparks to get personalized recommendations!
            </Text>
          </View>
        }
      />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'AvenirNext-Regular',
  },
  header: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    marginRight: 8,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  list: {
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contentType: {
    fontSize: 14,
    fontFamily: 'AvenirNext-DemiBold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    textTransform: 'uppercase',
  },
  topic: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
  },
  title: {
    fontSize: 18,
    fontFamily: 'AvenirNext-DemiBold',
    marginBottom: 8,
  },
  pitch: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    lineHeight: 22,
  },
}); 