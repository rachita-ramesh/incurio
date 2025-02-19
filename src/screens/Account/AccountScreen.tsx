import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { supabase } from '../../api/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Auth: undefined;
  Topic: undefined;
  Fact: { selectedTopics: string[] };
  TopicPreferences: undefined;
  FactHistory: { filter: 'like' | 'love' | 'dislike' };
  CuriosityHub: undefined;
  SparkSearch: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CuriosityHub'>;
};

export const AccountScreen: React.FC<Props> = ({ navigation }) => {
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace('Auth');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const menuItems = [
    {
      title: 'Search Sparks',
      subtitle: 'Find your past discoveries',
      onPress: () => navigation.navigate('SparkSearch'),
      icon: '🔍'
    },
    {
      title: 'Topic Preferences',
      subtitle: 'Your curiosity compass',
      onPress: () => navigation.navigate('TopicPreferences'),
      icon: '📊'
    },
    {
      title: 'Woah Sparks',
      subtitle: 'Mind-blowing discoveries',
      onPress: () => navigation.navigate('FactHistory', { filter: 'love' }),
      icon: '🤯'
    },
    {
      title: 'Nice Sparks',
      subtitle: 'Interesting finds',
      onPress: () => navigation.navigate('FactHistory', { filter: 'like' }),
      icon: '😎'
    },
    {
      title: 'Meh Sparks',
      subtitle: 'Less exciting ones',
      onPress: () => navigation.navigate('FactHistory', { filter: 'dislike' }),
      icon: '😒'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[styles.menuItem]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemIcon}>{item.icon}</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.signOutMenuItem}
          onPress={handleSignOut}
        >
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemIcon}>👋</Text>
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>Sign Out</Text>
              <Text style={styles.menuItemSubtitle}>Thanks for exploring with us</Text>
            </View>
          </View>
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
  },
  menuSection: {
    marginBottom: 24,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  signOutMenuItem: {
    marginTop: 'auto',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    fontSize: 24,
    marginRight: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
    color: '#000',
    marginBottom: 4,
  },
  menuItemSubtitle: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
  },
}); 