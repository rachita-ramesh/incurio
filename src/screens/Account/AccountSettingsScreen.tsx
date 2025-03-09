import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { supabase } from '../../api/supabase';
import { useTheme } from '../../theme/ThemeContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { backgroundTaskService } from '../../services/backgroundTaskService';

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
  const { theme, isDark, toggleTheme } = useTheme();
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUserEmail();
  }, []);

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
      icon: '📊',
      showToggle: false,
    },
    {
      title: 'Theme',
      subtitle: isDark ? 'Dark Mode' : 'Light Mode',
      onPress: toggleTheme,
      icon: isDark ? '🌙' : '☀️',
      showToggle: true,
      isToggled: isDark,
    }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <ScrollView style={styles.scrollContent}>
          {settingsItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.settingItem,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                }
              ]}
              onPress={item.onPress}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingIcon}>{item.icon}</Text>
                <View style={styles.settingText}>
                  <Text style={[
                    styles.settingTitle,
                    { color: theme.text.primary }
                  ]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.settingSubtitle, { color: theme.text.secondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
                {item.showToggle && (
                  <Switch
                    value={item.isToggled}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#767577', true: theme.primary }}
                    thumbColor={isDark ? '#fff' : '#f4f3f4'}
                    ios_backgroundColor="#767577"
                  />
                )}
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.profileSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.profileIcon}>🧙‍♂️</Text>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileLabel, { color: theme.text.secondary }]}>SIGNED IN AS</Text>
              <Text style={[styles.profileEmail, { color: theme.text.primary }]}>{userEmail}</Text>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.settingItem,
            styles.signOutItem,
            { 
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }
          ]}
          onPress={handleSignOut}
        >
          <View style={styles.settingContent}>
            <Text style={styles.settingIcon}>👋</Text>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, styles.signOutText]}>
                Sign Out
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.text.secondary }]}>
                See you next time
              </Text>
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
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    flex: 1,
    marginBottom: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  profileIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 12,
    fontFamily: 'AvenirNext-Medium',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  signOutItem: {
    borderStyle: 'dashed',
    marginBottom: 0,
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
    marginBottom: 4,
  },
  signOutText: {
    color: '#FF3B30',
  },
  settingSubtitle: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Regular',
  },
}); 