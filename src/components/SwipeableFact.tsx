import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useTheme } from '../theme/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_UP_THRESHOLD = 100;

interface SwipeableSparkProps {
  spark: {
    content: string;
    topic: string;
    details: string;
    sparkIndex: number;  // Index of current spark (1-5)
  };
  onSwipeLeft: () => void;   // Skip
  onSwipeRight: () => void;  // Like
  onSwipeUp: () => void;     // Love
}

export const SwipeableSpark: React.FC<SwipeableSparkProps> = ({
  spark,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}) => {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const translateX = new Animated.Value(0);
  const translateY = new Animated.Value(0);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      const { translationX, translationY } = nativeEvent;

      // Handle vertical swipe (Love)
      if (translationY < -SWIPE_UP_THRESHOLD) {
        Animated.timing(translateY, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onSwipeUp();
          resetPosition();
        });
        return;
      }

      // Handle horizontal swipes
      if (Math.abs(translationX) > SWIPE_THRESHOLD) {
        const direction = translationX > 0 ? 1 : -1;
        Animated.timing(translateX, {
          toValue: direction * SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          if (direction > 0) {
            onSwipeRight();
          } else {
            onSwipeLeft();
          }
          resetPosition();
        });
      } else {
        resetPosition();
      }
    }
  };

  const resetPosition = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View 
          style={[
            styles.card,
            { 
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              transform: [
                { translateX },
                { translateY },
              ] 
            }
          ]}
        >
          <View style={[styles.header, { 
            borderBottomColor: theme.cardBorder,
            backgroundColor: theme.surface
          }]}>
            <View style={styles.headerContent}>
              <View style={styles.topicContainer}>
                <Text style={[styles.topicLabel, { color: theme.primary }]}>SPARK OF</Text>
                <Text style={[styles.topic, { color: theme.primary }]}>{spark.topic.toUpperCase()}</Text>
              </View>
            </View>
          </View>
          
          <View style={[styles.contentContainer, { backgroundColor: theme.surface }]}>
            <Text style={[styles.content, { color: theme.text.primary }]}>{spark.content}</Text>
            <TouchableOpacity 
              style={[styles.readMoreButton, { backgroundColor: theme.primary }]}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.readMoreText}>Dive Deeper 🔥</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.instructionsContainer, { 
            borderTopColor: theme.cardBorder,
            backgroundColor: theme.surface
          }]}>
            <View style={styles.instructionRow}>
              <Text style={[styles.instructionIcon, { color: theme.primary }]}>←</Text>
              <Text style={[styles.instructionText, { color: theme.text.primary }]}>meh 😒</Text>
            </View>
            <View style={styles.instructionRow}>
              <Text style={[styles.instructionIcon, { color: theme.primary }]}>↑</Text>
              <Text style={[styles.instructionText, { color: theme.text.primary }]}>woah! 🤯</Text>
            </View>
            <View style={styles.instructionRow}>
              <Text style={[styles.instructionIcon, { color: theme.primary }]}>→</Text>
              <Text style={[styles.instructionText, { color: theme.text.primary }]}>nice 😎</Text>
            </View>
          </View>
        </Animated.View>
      </PanGestureHandler>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { 
              borderBottomColor: theme.cardBorder,
              backgroundColor: theme.surface
            }]}>
              <Text style={[styles.modalTopic, { color: theme.primary }]}>
                EXPLORE THIS {spark.topic.toUpperCase()} SPARK
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.closeButtonText, { color: theme.primary }]}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <Text style={[styles.modalDetails, { color: theme.text.primary }]}>{spark.details}</Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT - 180,
    backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E1FF',
    backgroundColor: '#F8F5FF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  topicContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  topicLabel: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#6B4EFF',
    marginBottom: 4,
    letterSpacing: 1,
  },
  topic: {
    fontSize: 32,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: 'bold',
    color: '#6B4EFF',
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  content: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Medium',
    lineHeight: 40,
    color: '#2F3542',
    textAlign: 'center',
    marginBottom: 24,
  },
  readMoreButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#6B4EFF',
    borderRadius: 20,
    shadowColor: '#6B4EFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  readMoreText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'AvenirNext-Bold',
  },
  instructionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E6E1FF',
    backgroundColor: '#F8F5FF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  instructionRow: {
    alignItems: 'center',
  },
  instructionIcon: {
    fontSize: 28,
    color: '#6B4EFF',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#2F3542',
    fontWeight: '500',
  },
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
  modalTopic: {
    fontSize: 20,
    fontFamily: 'AvenirNext-Bold',
    color: '#4A2EFF',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 32,
    color: '#6B4EFF',
    lineHeight: 32,
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
    paddingBottom: 60,
  },
  modalDetails: {
    fontSize: 18,
    fontFamily: 'AvenirNext-Regular',
    color: '#2F3542',
    lineHeight: 28,
    textAlign: 'left',
    paddingBottom: 80,
  },
});
