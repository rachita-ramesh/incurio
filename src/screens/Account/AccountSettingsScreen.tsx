import React from 'react';
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
  AccountSettings: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AccountSettings'>;
};

export const AccountSettingsScreen: React.FC<Props> = ({ navigation }) => {
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

  const settingsItems = [
    {
      title: 'Topic Preferences',
      subtitle: 'Customize your daily sparks',
      onPress: () => navigation.navigate('TopicPreferences'),
      icon: '📊'
    },
    {
      title: 'Dark Mode',
      subtitle: 'Toggle app theme',
      onPress: () => Alert.alert('Coming Soon', 'Dark mode will be available in the next update!'),
      icon: '🌓'
    },
    {
      title: 'Sign Out',
      subtitle: 'See you next time',
      onPress: handleSignOut,
      icon: '👋'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={item.title}
            style={[
              styles.settingItem,
              item.title === 'Sign Out' && styles.signOutItem
            ]}
            onPress={item.onPress}
          >
            <View style={styles.settingContent}>
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <View style={styles.settingText}>
                <Text style={[
                  styles.settingTitle,
                  item.title === 'Sign Out' && styles.signOutText
                ]}>
                  {item.title}
                </Text>
                <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
  settingItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  signOutItem: {
    marginTop: 'auto',
    borderStyle: 'dashed',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
    color: '#000',
    marginBottom: 4,
  },
  signOutText: {
    color: '#FF3B30',
  },
  settingSubtitle: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
  },
}); 