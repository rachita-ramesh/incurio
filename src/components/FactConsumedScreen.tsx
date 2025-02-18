import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

const MESSAGES = [
  "Curiosity Sparked! ⚡",
  "Mind Blown! 🤯",
  "New Paths Found! 🌟",
  "Discovery Made! 🔮",
  "Spark Ignited! ✨",
];

export const SparkConsumedScreen: React.FC = () => {
  // Randomly select a message
  const randomMessage = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{randomMessage}</Text>
        <Text style={styles.message}>
          Come back tomorrow for another spark! Check your account to revisit past discoveries.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
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
    color: '#4A2EFF',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(74, 46, 255, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  message: {
    fontSize: 18,
    fontFamily: 'AvenirNext-Regular',
    color: '#2F3542',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
}); 