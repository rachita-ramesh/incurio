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
import { SparkDetailModal } from '../../components/SparkDetailModal';
import { useTheme } from '../../theme/ThemeContext';

type RootStackParamList = {
  Account: undefined;
  FactHistory: { filter: 'like' | 'love' | 'dislike' };
};

type Props = NativeStackScreenProps<RootStackParamList, 'FactHistory'>;

interface SparkWithInteraction {
  id: string;
  content: string;
  topic: string;
  details: string;
  created_at: string;
  interaction_type: 'like' | 'love' | 'dislike';
}

export const FactHistoryScreen: React.FC<Props> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [sparks, setSparks] = useState<SparkWithInteraction[]>([]);
  const [selectedSpark, setSelectedSpark] = useState<SparkWithInteraction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadSparkHistory();
  }, [route.params.filter]);

  const loadSparkHistory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sparks')
        .select(`
          id,
          content,
          topic,
          details,
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
      
      const mappedSparks = data.map(item => ({
        id: item.id,
        content: item.content,
        topic: item.topic,
        details: item.details,
        created_at: item.created_at,
        interaction_type: item.user_interactions[0].interaction_type
      }));

      console.log('=== Mapped Sparks ===');
      console.log('Mapped:', JSON.stringify(mappedSparks, null, 2));

      setSparks(mappedSparks);
    } catch (error) {
      console.error('Error loading spark history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSparkSelect = (spark: SparkWithInteraction) => {
    setSelectedSpark(spark);
    setModalVisible(true);
  };

  const renderSparkCard = ({ item }: { item: SparkWithInteraction }) => (
    <TouchableOpacity 
      style={[
        styles.sparkCard,
        { 
          backgroundColor: theme.card,
          borderColor: theme.cardBorder
        }
      ]}
      onPress={() => handleSparkSelect(item)}
    >
      <View style={styles.sparkHeader}>
        <Text style={styles.sparkTopic}>{item.topic}</Text>
      </View>
      <Text style={[styles.sparkContent, { color: theme.text.primary }]}>{item.content}</Text>
      <Text style={[styles.sparkDate, { color: theme.text.secondary }]}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text.primary }]}>Loading your spark history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {route.params.filter === 'like' ? 'Nice Sparks 😎' :
           route.params.filter === 'love' ? 'Woah Sparks 🤯' :
           'Meh Sparks 😒'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          {sparks.length} {sparks.length === 1 ? 'spark' : 'sparks'}
        </Text>
      </View>
      {sparks.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No {route.params.filter === 'like' ? 'nice 😎' :
                route.params.filter === 'love' ? 'woah 🤯' :
                'meh 😒'} sparks yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={sparks}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.sparkCard,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder
                }
              ]}
              onPress={() => handleSparkSelect(item)}
            >
              <View style={styles.sparkHeader}>
                <Text style={styles.sparkTopic}>{item.topic}</Text>
              </View>
              <Text style={[styles.sparkContent, { color: theme.text.primary }]}>{item.content}</Text>
              <Text style={[styles.sparkDate, { color: theme.text.secondary }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContainer, { padding: 20 }]}
        />
      )}

      <SparkDetailModal
        spark={selectedSpark ? {
          ...selectedSpark,
          user_interactions: [{ interaction_type: selectedSpark.interaction_type }]
        } : null}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedSpark(null);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    marginBottom: 4,
    color: '#6B4EFF',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
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
  listContainer: {
    padding: 16,
  },
  sparkCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sparkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sparkTopic: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
    color: '#6B4EFF',
  },
  sparkContent: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
    marginBottom: 8,
    fontFamily: 'AvenirNext-Regular',
  },
  sparkDate: {
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