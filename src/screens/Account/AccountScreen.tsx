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
  Home: undefined;
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
      subtitle: 'Modify your interests',
      onPress: () => navigation.navigate('TopicPreferences'),
      icon: '🎯'
    },
    {
      title: 'Nice Facts',
      subtitle: 'Facts you thought were nice',
      onPress: () => navigation.navigate('FactHistory', { filter: 'like' }),
      icon: '😎'
    },
    {
      title: 'Woah Facts',
      subtitle: 'Facts that blew your mind',
      onPress: () => navigation.navigate('FactHistory', { filter: 'love' }),
      icon: '🤯'
    },
    {
      title: 'Meh Facts',
      subtitle: 'Facts you weren\'t into',
      onPress: () => navigation.navigate('FactHistory', { filter: 'dislike' }),
      icon: '😒'
    },
    {
      title: 'Sign Out',
      subtitle: 'Log out of your account',
      onPress: handleSignOut,
      icon: '👋'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.lastMenuItem
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
  menuContainer: {
    padding: 16,
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