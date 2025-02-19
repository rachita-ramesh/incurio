import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../api/supabase';
import { SparkDetailModal } from '../../components/SparkDetailModal';
import { useDebounce } from '../../hooks/useDebounce';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 3;

interface Spark {
  id: string;
  content: string;
  topic: string;
  details: string;
  created_at: string;
  user_interactions: Array<{ interaction_type: 'love' | 'like' | 'dislike' }>;
}

export const SparkSearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<Spark[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpark, setSelectedSpark] = useState<Spark | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    // Clear existing searches and start fresh
    clearRecentSearches().then(() => {
      loadRecentSearches();
    });
  }, []);

  useEffect(() => {
    if (debouncedSearch) {
      searchSparks();
    } else {
      setResults([]);
    }
  }, [debouncedSearch]);

  const loadRecentSearches = async () => {
    try {
      const searches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (searches) {
        const parsedSearches = JSON.parse(searches);
        // Ensure only MAX_RECENT_SEARCHES are loaded
        const limitedSearches = parsedSearches.slice(0, MAX_RECENT_SEARCHES);
        setRecentSearches(limitedSearches);
        // Update storage if we had to limit the searches
        if (limitedSearches.length < parsedSearches.length) {
          await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limitedSearches));
        }
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const searches = new Set([query, ...recentSearches]);
      const newSearches = Array.from(searches).slice(0, MAX_RECENT_SEARCHES);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(newSearches));
      setRecentSearches(newSearches);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const searchSparks = async () => {
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
        .textSearch('content', debouncedSearch, {
          type: 'websearch',
          config: 'english'
        })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Error searching sparks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSparkSelect = (spark: Spark) => {
    setSelectedSpark(spark);
    setModalVisible(true);
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
      style={styles.sparkItem}
      onPress={() => handleSparkSelect(item)}
    >
      <View style={styles.sparkHeader}>
        <Text style={styles.sparkTopic}>{item.topic}</Text>
        <Text style={styles.interactionEmoji}>
          {getInteractionEmoji(item.user_interactions[0].interaction_type)}
        </Text>
      </View>
      <Text style={styles.sparkContent} numberOfLines={2}>
        {item.content}
      </Text>
      <Text style={styles.sparkDate}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderRecentSearch = ({ item }: { item: string }) => (
    <TouchableOpacity 
      style={styles.recentSearchItem}
      onPress={() => setSearchQuery(item)}
    >
      <Text style={styles.recentSearchIcon}>🕒</Text>
      <Text style={styles.recentSearchText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search Sparks</Text>
        <Text style={styles.subtitle}>Find your past discoveries</Text>
      </View>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your sparks..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
          autoFocus
          onSubmitEditing={() => {
            if (searchQuery.trim()) {
              saveRecentSearch(searchQuery.trim());
              searchSparks();
            }
          }}
          returnKeyType="search"
        />
        {loading && (
          <ActivityIndicator 
            style={styles.loadingIndicator} 
            color="#6B4EFF" 
          />
        )}
      </View>

      {!searchQuery && recentSearches.length > 0 && (
        <View style={styles.recentSearchesContainer}>
          <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
          <FlatList
            data={recentSearches}
            renderItem={renderRecentSearch}
            keyExtractor={item => item}
          />
        </View>
      )}

      {searchQuery && (
        <FlatList
          data={results}
          renderItem={renderSparkItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { display: loading ? 'none' : 'flex' }]}>
              No sparks found matching your search
            </Text>
          }
        />
      )}

      <SparkDetailModal
        spark={selectedSpark}
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
    color: '#6B4EFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  recentSearchesContainer: {
    padding: 16,
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
    color: '#666',
    marginBottom: 12,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  recentSearchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  recentSearchText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#2F3542',
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