import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { GeneratedRecommendation } from '../api/openai';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Golden theme colors
const COLORS = {
  primary: '#d97706',    // Main amber color
  secondary: '#b45309',  // Darker amber for better contrast on light backgrounds
  accent: '#fbbf24',     // Lighter amber for borders and accents
  text: '#92400e',       // Warm brown for text
};

interface RecommendationModalProps {
  visible: boolean;
  onClose: () => void;
  topic: string;
  milestone: number;
  recommendation: GeneratedRecommendation & { id: string };
}

export const RecommendationModal: React.FC<RecommendationModalProps> = ({
  visible,
  onClose,
  topic,
  milestone,
  recommendation,
}) => {
  const { theme } = useTheme();

  const getRecommendationEmoji = (type: 'book' | 'movie' | 'documentary') => {
    switch (type) {
      case 'book': return '📚';
      case 'movie': return '🎬';
      case 'documentary': return '🎥';
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={[styles.content, { backgroundColor: theme.background }]}>
          {/* Celebration Header */}
          <View style={[styles.header, { backgroundColor: theme.surface }]}>
            <View style={styles.milestone}>
              <Text style={[styles.milestoneText, { color: COLORS.secondary }]}>
                🎉 {milestone} LOVES
              </Text>
              <Text style={[styles.topicText, { color: COLORS.primary }]}>
                {topic.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={[styles.closeButtonText, { color: COLORS.primary }]}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            {/* Recommendation Card */}
            <View style={[styles.card, styles.cardGoldBorder, { backgroundColor: theme.surface }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.typeLabel, { color: COLORS.text }]}>
                  CURIOSITY TRAILS
                </Text>
                <Text style={styles.typeEmoji}>
                  {getRecommendationEmoji(recommendation.type)}
                </Text>
              </View>
              
              <Text style={[styles.title, { color: COLORS.primary }]}>
                {recommendation.title}
              </Text>
              
              <Text style={[styles.whyRecommended, { color: COLORS.text }]}>
                {recommendation.whyRecommended}
              </Text>
              
              <Text style={[styles.details, { color: theme.text.primary }]}>
                {recommendation.details}
              </Text>
            </View>
          </ScrollView>

          {/* Action Button */}
          <View style={[styles.footer, { backgroundColor: theme.surface }]}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: COLORS.primary }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Continue Exploring</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  milestone: {
    flex: 1,
  },
  milestoneText: {
    fontSize: 24,
    fontFamily: 'AvenirNext-Bold',
    marginBottom: 4,
  },
  topicText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-DemiBold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 32,
    lineHeight: 32,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardGoldBorder: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeLabel: {
    fontSize: 14,
    fontFamily: 'AvenirNext-DemiBold',
    letterSpacing: 1,
  },
  typeEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'AvenirNext-Bold',
    marginBottom: 16,
  },
  whyRecommended: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  details: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.accent,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontFamily: 'AvenirNext-DemiBold',
  },
});