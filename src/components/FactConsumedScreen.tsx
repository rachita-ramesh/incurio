import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

const MESSAGES = [
  "Brain Boost Complete! 🧠✨",
  "Knowledge Level Up! 🎮⬆️",
  "Curiosity Satisfied! 🌟",
  "Wisdom Acquired! 🎓✨",
  "Mind = Blown! 🤯",
  "Achievement Unlocked! 🏆",
];

export const FactConsumedScreen: React.FC = () => {
  // Randomly select a message
  const randomMessage = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{randomMessage}</Text>
        <Text style={styles.message}>
          See you tomorrow! Check your account for past facts.
        </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontFamily: 'AvenirNext-Bold',
    color: '#5B3FD1',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
}); 