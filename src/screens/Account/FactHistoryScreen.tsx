import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../api/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Account: undefined;
  FactHistory: { filter: 'like' | 'love' | 'dislike' };
};

type Props = NativeStackScreenProps<RootStackParamList, 'FactHistory'>;

interface FactWithInteraction {
  id: string;
  content: string;
  topic: string;
  created_at: string;
  interaction_type: 'like' | 'love' | 'dislike';
}

export const FactHistoryScreen: React.FC<Props> = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [facts, setFacts] = useState<FactWithInteraction[]>([]);

  useEffect(() => {
    loadFactHistory();
  }, [route.params.filter]);

  const loadFactHistory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('facts')
        .select(`
          id,
          content,
          topic,
          created_at,
          user_interactions!inner (interaction_type)
        `)
        .eq('user_interactions.user_id', user.id)
        .eq('user_interactions.interaction_type', route.params.filter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('=== Raw Supabase Response ===');
      console.log('Filter:', route.params.filter);
      console.log('Data:', JSON.stringify(data, null, 2));
      
      const mappedFacts = data.map(item => ({
        id: item.id,
        content: item.content,
        topic: item.topic,
        created_at: item.created_at,
        interaction_type: item.user_interactions[0].interaction_type
      }));

      console.log('=== Mapped Facts ===');
      console.log('Mapped:', JSON.stringify(mappedFacts, null, 2));

      setFacts(mappedFacts);
    } catch (error) {
      console.error('Error loading fact history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInteractionEmoji = (type: string) => {
    switch (type) {
      case 'like': return '👍';
      case 'love': return '❤️';
      case 'dislike': return '👎';
      default: return '';
    }
  };

  const renderFactCard = ({ item }: { item: FactWithInteraction }) => (
    <View style={styles.factCard}>
      <View style={styles.factHeader}>
        <Text style={styles.factTopic}>{item.topic}</Text>
        <Text style={styles.factEmoji}>
          {getInteractionEmoji(item.interaction_type)}
        </Text>
      </View>
      <Text style={styles.factContent}>{item.content}</Text>
      <Text style={styles.factDate}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading your fact history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {route.params.filter === 'like' ? 'Nice Facts' :
           route.params.filter === 'love' ? 'Woah Facts' :
           'Meh Facts'}
        </Text>
      </View>
      {facts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No {route.params.filter === 'like' ? 'nice' :
                route.params.filter === 'love' ? 'woah' :
                'meh'} facts yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={facts}
          renderItem={renderFactCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    color: '#000',
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
  listContainer: {
    padding: 16,
  },
  factCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  factHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  factTopic: {
    fontSize: 14,
    color: '#4285F4',
    fontFamily: 'AvenirNext-Medium',
  },
  factEmoji: {
    fontSize: 20,
  },
  factContent: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
    marginBottom: 8,
    fontFamily: 'AvenirNext-Regular',
  },
  factDate: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'AvenirNext-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'AvenirNext-Regular',
  },
}); 