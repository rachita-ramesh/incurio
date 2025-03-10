import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Animated,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../api/supabase';
import { SparkDetailModal } from '../../components/SparkDetailModal';
import { useDebounce } from '../../hooks/useDebounce';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { formatLocalDate } from '../../utils/dateUtils';

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
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<Spark[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpark, setSelectedSpark] = useState<Spark | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const debouncedSearch = useDebounce(searchQuery, 300);
  const navigation = useNavigation();
  const [userTopics, setUserTopics] = useState<string[]>([]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerTintColor: '#6B4EFF',
    });
  }, []);

  useEffect(() => {
    clearRecentSearches().then(() => {
      loadRecentSearches();
    });
    
    fetchUserTopics();
  }, []);

  const fetchUserTopics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sparks')
        .select(`
          topic,
          user_interactions!inner (user_id)
        `)
        .eq('user_interactions.user_id', user.id);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const topicsSet = new Set(data.map((item: { topic: string }) => item.topic));
        const uniqueTopics = Array.from(topicsSet).sort();
        setUserTopics(uniqueTopics);
      }
    } catch (error) {
      console.error('Error fetching user topics:', error);
    }
  };

  useEffect(() => {
    if (debouncedSearch) {
      searchSparks();
    } else {
      setResults([]);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    Animated.timing(underlineAnim, {
      toValue: isFocused || searchQuery.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, searchQuery]);

  const loadRecentSearches = async () => {
    try {
      const searches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (searches) {
        const parsedSearches = JSON.parse(searches);
        const limitedSearches = parsedSearches.slice(0, MAX_RECENT_SEARCHES);
        setRecentSearches(limitedSearches);
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

      let query = supabase
        .from('sparks')
        .select(`
          id,
          content,
          topic,
          details,
          created_at,
          user_interactions!inner (interaction_type)
        `)
        .eq('user_interactions.user_id', user.id);
      
      if (selectedTopic && selectedTopic !== 'All') {
        query = query.eq('topic', selectedTopic);
      }
      
      if (debouncedSearch) {
        query = query.textSearch('content', debouncedSearch, {
          type: 'websearch',
          config: 'english'
        });
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Error searching sparks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic === selectedTopic ? null : topic);
  };

  useEffect(() => {
    searchSparks();
  }, [selectedTopic, debouncedSearch]);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.primary }]}>Search Sparks ✨</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Ignite your curiosity
        </Text>
      </View>

      <View style={styles.searchAndFiltersContainer}>
        <View style={[styles.searchContainer, { 
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2
        }]}>
          <TextInput
            style={[
              styles.searchInput,
              { 
                color: theme.text.primary,
                borderColor: theme.cardBorder
              }
            ]}
            placeholder="Search your sparks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.text.secondary}
            autoFocus
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                saveRecentSearch(searchQuery.trim());
                searchSparks();
              }
            }}
            returnKeyType="search"
          />
          <TouchableOpacity 
            style={styles.searchIconContainer}
            onPress={() => {
              if (searchQuery.trim()) {
                saveRecentSearch(searchQuery.trim());
                searchSparks();
              }
            }}
          >
            <Text style={[styles.searchIconText, { color: theme.primary }]}>🔍</Text>
          </TouchableOpacity>
          {loading && (
            <ActivityIndicator 
              style={styles.loadingIndicator} 
              color={theme.primary}
            />
          )}
          <Animated.View
            style={[
              styles.underline,
              {
                backgroundColor: theme.primary,
                width: underlineAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {userTopics.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.topicFilterContainer}
            contentContainerStyle={styles.topicFilterContent}
          >
            <TouchableOpacity
              style={[
                styles.topicFilter,
                !selectedTopic && styles.selectedTopicFilter,
                { borderColor: !selectedTopic ? 'transparent' : theme.primary }
              ]}
              onPress={() => handleTopicSelect('All')}
            >
              <Text
                style={[
                  styles.topicFilterText,
                  !selectedTopic && { color: '#FFFFFF' },
                  selectedTopic && { color: theme.text.primary }
                ]}
              >
                All Topics
              </Text>
            </TouchableOpacity>
            {userTopics.map((topic) => (
              <TouchableOpacity
                key={topic}
                style={[
                  styles.topicFilter,
                  selectedTopic === topic && styles.selectedTopicFilter,
                  { borderColor: selectedTopic === topic ? 'transparent' : theme.primary }
                ]}
                onPress={() => handleTopicSelect(topic)}
              >
                <Text
                  style={[
                    styles.topicFilterText,
                    selectedTopic === topic && { color: '#FFFFFF' },
                    selectedTopic !== topic && { color: theme.text.primary }
                  ]}
                >
                  {topic}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {!searchQuery && !selectedTopic && (
        <>
          {recentSearches.length > 0 && (
            <View style={styles.recentSearchesContainer}>
              <Text style={[styles.recentSearchesTitle, { color: theme.text.secondary }]}>
                Recent Searches
              </Text>
              <FlatList
                data={recentSearches}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[
                      styles.recentSearchItem,
                      { borderBottomColor: theme.divider }
                    ]}
                    onPress={() => setSearchQuery(item)}
                  >
                    <Text style={styles.recentSearchIcon}>🕒</Text>
                    <Text style={[styles.recentSearchText, { color: theme.text.primary }]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                keyExtractor={item => item}
              />
            </View>
          )}
        </>
      )}

      {(searchQuery || selectedTopic) && (
        <FlatList
          data={results}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.sparkItem,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder
                }
              ]}
              onPress={() => handleSparkSelect(item)}
            >
              <View style={styles.sparkHeader}>
                <Text style={[styles.sparkTopic, { color: theme.primary }]}>
                  {item.topic}
                </Text>
                <Text style={styles.interactionEmoji}>
                  {getInteractionEmoji(item.user_interactions[0].interaction_type)}
                </Text>
              </View>
              <Text 
                style={[styles.sparkContent, { color: theme.text.primary }]} 
                numberOfLines={2}
              >
                {item.content}
              </Text>
              <Text style={[styles.sparkDate, { color: theme.text.secondary }]}>
                {formatLocalDate(item.created_at)}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              No sparks found matching your search
            </Text>
          }
        />
      )}

      {!searchQuery && !selectedTopic && recentSearches.length === 0 && userTopics.length === 0 && (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateTitle, { color: theme.text.primary }]}>
            No sparks found
          </Text>
          <Text style={[styles.emptyStateText, { color: theme.text.secondary }]}>
            Start exploring new topics to collect sparks of knowledge!
          </Text>
        </View>
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
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  searchAndFiltersContainer: {
    marginHorizontal: 20,
  },
  searchContainer: {
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 24,
    height: 52,
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    backgroundColor: 'transparent',
  },
  searchIconContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 1,
    justifyContent: 'center',
    height: '100%',
  },
  searchIconText: {
    fontSize: 18,
  },
  underline: {
    height: 2,
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    maxWidth: '85%',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  topicFilterContainer: {
    marginTop: 0,
    marginBottom: 16,
    height: 44,
  },
  topicFilterContent: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  topicFilter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
    height: 40,
    justifyContent: 'center',
    minWidth: 100,
  },
  selectedTopicFilter: {
    backgroundColor: '#6B4EFF',
    borderWidth: 0,
  },
  topicFilterText: {
    fontFamily: 'AvenirNext-Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  recentSearchesContainer: {
    padding: 20,
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
    marginBottom: 12,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recentSearchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  recentSearchText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  resultsList: {
    padding: 20,
  },
  sparkItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
  },
  interactionEmoji: {
    fontSize: 16,
  },
  sparkContent: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    lineHeight: 22,
    marginBottom: 8,
  },
  sparkDate: {
    fontSize: 12,
    fontFamily: 'AvenirNext-Regular',
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'AvenirNext-Regular',
    fontSize: 16,
    marginTop: 32,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: 'AvenirNext-Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
}); 