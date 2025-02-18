import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

const AVAILABLE_TOPICS = [
  'Science',
  'History',
  'Technology',
  'Art',
  'Literature',
  'Philosophy',
  'Psychology',
  'Space',
  'Nature',
  'Culture'
];

interface TopicSelectorProps {
  onTopicsSelected: (topics: string[]) => void;
  initialTopics?: string[];
}

export const TopicSelector: React.FC<TopicSelectorProps> = ({
  onTopicsSelected,
  initialTopics = []
}) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialTopics);

  const toggleTopic = (topic: string) => {
    const newTopics = selectedTopics.includes(topic)
      ? selectedTopics.filter(t => t !== topic)
      : [...selectedTopics, topic];
    setSelectedTopics(newTopics);
  };

  const handleContinue = () => {
    if (selectedTopics.length > 0) {
      onTopicsSelected(selectedTopics);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.topicsContainer}>
        <View style={styles.topicsGrid}>
          {AVAILABLE_TOPICS.map(topic => (
            <TouchableOpacity
              key={topic}
              style={[
                styles.topicButton,
                selectedTopics.includes(topic) && styles.selectedTopic
              ]}
              onPress={() => toggleTopic(topic)}
            >
              <Text
                style={[
                  styles.topicText,
                  selectedTopics.includes(topic) && styles.selectedTopicText
                ]}
              >
                {topic}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            selectedTopics.length === 0 && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={selectedTopics.length === 0}
        >
          <Text style={styles.continueButtonText}>
            {selectedTopics.length === 0
              ? 'Select at least one topic'
              : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topicsContainer: {
    flex: 1,
    padding: 16,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  topicButton: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  selectedTopic: {
    backgroundColor: '#6B4EFF',
    borderColor: '#6B4EFF',
  },
  topicText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#2F3542',
    textAlign: 'center',
  },
  selectedTopicText: {
    color: '#fff',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  continueButton: {
    backgroundColor: '#6B4EFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6B4EFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
});
