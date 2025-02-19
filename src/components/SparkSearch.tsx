import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabaseApi } from '../api/supabase';
import { useDebounce } from '../hooks/useDebounce';
import { useTheme } from '../theme/ThemeContext';

interface Spark {
  id: string;
  content: string;
  topic: string;
  details: string;
  created_at: string;
  user_interactions: Array<{ interaction_type: 'love' | 'like' | 'dislike' }>;
}

interface SparkSearchProps {
  userId: string;
  onSparkSelect: (spark: Spark) => void;
}

export const SparkSearch: React.FC<SparkSearchProps> = ({ userId, onSparkSelect }) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Spark[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedSearch) {
      searchSparks();
    } else {
      setResults([]);
    }
  }, [debouncedSearch]);

  const searchSparks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseApi.searchSparks(userId, debouncedSearch);
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Error searching sparks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInteractionEmoji = (type: 'love' | 'like' | 'dislike') => {
    switch (type) {
      case 'love': return '🤯';
      case 'like': return '😎';
      case 'dislike': return '😒';
    }
  };

  const renderSparkItem = ({ item }: { item: Spark }) => (
    <TouchableOpacity 
      style={[
        styles.sparkItem,
        { 
          backgroundColor: theme.card,
          borderColor: theme.cardBorder
        }
      ]}
      onPress={() => onSparkSelect(item)}
    >
      <View style={styles.sparkHeader}>
        <Text style={[styles.sparkTopic, { color: theme.primary }]}>{item.topic}</Text>
        <Text style={styles.interactionEmoji}>
          {getInteractionEmoji(item.user_interactions[0].interaction_type)}
        </Text>
      </View>
      <Text style={[styles.sparkContent, { color: theme.text.primary }]} numberOfLines={2}>
        {item.content}
      </Text>
      <Text style={[styles.sparkDate, { color: theme.text.secondary }]}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.searchContainer, { borderBottomColor: theme.divider }]}>
        <TextInput
          style={[
            styles.searchInput,
            { 
              backgroundColor: theme.card,
              color: theme.text.primary,
              borderColor: theme.cardBorder
            }
          ]}
          placeholder="Search your sparks..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.text.secondary}
        />
        {loading && (
          <ActivityIndicator 
            style={styles.loadingIndicator} 
            color={theme.primary}
          />
        )}
      </View>
      <FlatList
        data={results}
        renderItem={renderSparkItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.resultsList}
        ListEmptyComponent={
          searchQuery ? (
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              No sparks found matching your search
            </Text>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F8F5FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#000',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  resultsList: {
    padding: 16,
  },
  sparkItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sparkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    color: '#6B4EFF',
  },
  sparkTopic: {
    fontSize: 14,
    color: '#6B4EFF',
    fontFamily: 'AvenirNext-Medium',
  },
  interactionEmoji: {
    fontSize: 16,
  },
  sparkContent: {
    fontSize: 16,
    color: '#2F3542',
    fontFamily: 'AvenirNext-Regular',
    lineHeight: 22,
    marginBottom: 8,
  },
  sparkDate: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'AvenirNext-Regular',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontFamily: 'AvenirNext-Regular',
    fontSize: 16,
    marginTop: 32,
  },
}); 