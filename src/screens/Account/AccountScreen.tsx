import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Auth: undefined;
  Topic: undefined;
  Fact: { selectedTopics: string[] };
  TopicPreferences: undefined;
  FactHistory: { filter: 'like' | 'love' | 'dislike' };
  CuriosityHub: undefined;
  SparkSearch: undefined;
  AccountSettings: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CuriosityHub'>;
};

export const CuriosityHubScreen: React.FC<Props> = ({ navigation }) => {
  const menuItems = [
    {
      title: 'Search Sparks',
      subtitle: 'Find your past discoveries',
      onPress: () => navigation.navigate('SparkSearch'),
      icon: '🔍'
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
      title: 'Account',
      subtitle: 'Manage your preferences',
      onPress: () => navigation.navigate('AccountSettings'),
      icon: '⚙️'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
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
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
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