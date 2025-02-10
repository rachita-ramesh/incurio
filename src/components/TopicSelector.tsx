import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';

const TOPICS = [
  'Science',
  'History',
  'Technology',
  'Art',
  'Literature',
  'Philosophy',
  'Psychology',
  'Space',
  'Nature',
  'Culture',
];

interface TopicSelectorProps {
  onTopicsSelected: (topics: string[]) => void;
}

export const TopicSelector: React.FC<TopicSelectorProps> = ({ onTopicsSelected }) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const handleTopicPress = (topic: string) => {
    setSelectedTopics(prevTopics => {
      if (prevTopics.includes(topic)) {
        // Remove topic if already selected
        return prevTopics.filter(t => t !== topic);
      } else if (prevTopics.length < 2) {
        // Add topic only if less than 2 are selected
        return [...prevTopics, topic];
      } else {
        // If trying to add a third topic, show alert and return unchanged
        Alert.alert(
          'Maximum Topics Selected',
          'You can only select 2 topics. Please deselect a topic before selecting a new one.'
        );
        return prevTopics;
      }
    });
  };

  const handleContinue = () => {
    if (selectedTopics.length !== 2) {
      Alert.alert(
        'Select Two Topics',
        'Please select exactly 2 topics to continue.'
      );
      return;
    }
    onTopicsSelected(selectedTopics);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Interests</Text>
      <Text style={styles.subtitle}>Select 2 topics you'd like to learn about</Text>
      
      <ScrollView 
        contentContainerStyle={styles.topicsContainer}
        showsVerticalScrollIndicator={false}
      >
        {TOPICS.map((topic) => (
          <TouchableOpacity
            key={topic}
            style={[
              styles.topicButton,
              selectedTopics.includes(topic) && styles.selectedTopic,
            ]}
            onPress={() => handleTopicPress(topic)}
          >
            <Text 
              style={[
                styles.topicText,
                selectedTopics.includes(topic) && styles.selectedTopicText,
              ]}
            >
              {topic}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.continueButton,
          selectedTopics.length !== 2 && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={selectedTopics.length !== 2}
      >
        <Text style={styles.continueButtonText}>
          Continue ({selectedTopics.length}/2 Selected)
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 20,
  },
  topicButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    minWidth: '45%',
    alignItems: 'center',
  },
  selectedTopic: {
    backgroundColor: '#4285F4',
  },
  topicText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedTopicText: {
    color: '#fff',
  },
  continueButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
