import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';

interface Spark {
  id: string;
  content: string;
  topic: string;
  details: string;
  created_at: string;
  user_interactions: Array<{ interaction_type: 'love' | 'like' | 'dislike' }>;
}

interface SparkDetailModalProps {
  spark: Spark | null;
  visible: boolean;
  onClose: () => void;
}

export const SparkDetailModal: React.FC<SparkDetailModalProps> = ({
  spark,
  visible,
  onClose,
}) => {
  if (!spark) return null;

  const getInteractionEmoji = (type: 'love' | 'like' | 'dislike') => {
    switch (type) {
      case 'love': return '🤯 Woah';
      case 'like': return '😎 Nice';
      case 'dislike': return '😒 Meh';
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <Text style={styles.topic}>{spark.topic.toUpperCase()}</Text>
              <Text style={styles.interaction}>
                {getInteractionEmoji(spark.user_interactions[0].interaction_type)}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollView}>
            <Text style={styles.content}>{spark.content}</Text>
            <View style={styles.divider} />
            <Text style={styles.detailsTitle}>DIVE DEEPER</Text>
            <Text style={styles.details}>{spark.details}</Text>
            <Text style={styles.date}>
              Discovered on {new Date(spark.created_at).toLocaleDateString()}
            </Text>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E1FF',
    backgroundColor: '#F8F5FF',
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  topic: {
    fontSize: 14,
    color: '#6B4EFF',
    fontFamily: 'AvenirNext-Medium',
    marginBottom: 4,
  },
  interaction: {
    fontSize: 16,
    color: '#2F3542',
    fontFamily: 'AvenirNext-Medium',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 32,
    color: '#6B4EFF',
    lineHeight: 32,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  content: {
    fontSize: 24,
    color: '#2F3542',
    fontFamily: 'AvenirNext-Medium',
    lineHeight: 32,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#E6E1FF',
    marginVertical: 24,
  },
  detailsTitle: {
    fontSize: 14,
    color: '#6B4EFF',
    fontFamily: 'AvenirNext-Medium',
    marginBottom: 16,
  },
  details: {
    fontSize: 16,
    color: '#2F3542',
    fontFamily: 'AvenirNext-Regular',
    lineHeight: 24,
    marginBottom: 24,
  },
  date: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'AvenirNext-Regular',
    marginBottom: 40,
  },
}); 