import React from 'react';
import { SafeAreaView } from 'react-native';
import auth from '@react-native-firebase/auth';
import { TopicSelector } from '../../components/TopicSelector';
import { supabaseApi } from '../../api/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Fact: {
    selectedTopics: string[];
  };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const handleTopicsSelected = async (selectedTopics: string[]) => {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return;

      await supabaseApi.saveUserPreferences(userId, selectedTopics);
      navigation.replace('Fact', { selectedTopics });
    } catch (error) {
      console.error('Error saving topics:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <TopicSelector onTopicsSelected={handleTopicsSelected} />
    </SafeAreaView>
  );
}; 