import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
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
  Account: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Account'>;
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
    },
    {
      title: 'Sign Out',
      subtitle: 'Thanks for exploring with us',
      onPress: handleSignOut,
      icon: '👋'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.lastMenuItem,
                index === menuItems.length - 1 && styles.signOutMenuItem
              ]}
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  menuContainer: {
    padding: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  lastMenuItem: {
    marginBottom: 0,
  },
  signOutMenuItem: {
    marginTop: 24,
    borderColor: '#eee',
    backgroundColor: '#fff',
    borderWidth: 1,
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