import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { supabase } from '../../api/supabase';
import { useTheme } from '../../theme/ThemeContext';
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
  const { theme, isDark, toggleTheme } = useTheme();

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
    },
    {
      title: 'Sign Out',
      subtitle: 'See you next time',
      onPress: handleSignOut,
      icon: '👋',
      showToggle: false,
    }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={item.title}
            style={[
              styles.settingItem,
              { 
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
              item.title === 'Sign Out' && styles.signOutItem
            ]}
            onPress={item.onPress}
          >
            <View style={styles.settingContent}>
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <View style={styles.settingText}>
                <Text style={[
                  styles.settingTitle,
                  { color: theme.text.primary },
                  item.title === 'Sign Out' && styles.signOutText
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
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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