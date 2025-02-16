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

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_UP_THRESHOLD = 100;

interface SwipeableFactProps {
  fact: {
    content: string;
    topic: string;
    details: string;
  };
  onSwipeLeft: () => void;   // Skip
  onSwipeRight: () => void;  // Like
  onSwipeUp: () => void;     // Love
}

export const SwipeableFact: React.FC<SwipeableFactProps> = ({
  fact,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}) => {
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
              transform: [
                { translateX },
                { translateY },
              ] 
            }
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.topicLabel}>TODAY'S FACT ABOUT</Text>
            <Text style={styles.topic}>{fact.topic.toUpperCase()}</Text>
          </View>
          
          <View style={styles.contentContainer}>
            <Text style={styles.content}>{fact.content}</Text>
            <TouchableOpacity 
              style={styles.readMoreButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.readMoreText}>Read More</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.instructionsContainer}>
            <View style={styles.instructionRow}>
              <Text style={styles.instructionIcon}>←</Text>
              <Text style={styles.instructionText}>meh 😒</Text>
            </View>
            <View style={styles.instructionRow}>
              <Text style={styles.instructionIcon}>↑</Text>
              <Text style={styles.instructionText}>woah 🤯</Text>
            </View>
            <View style={styles.instructionRow}>
              <Text style={styles.instructionIcon}>→</Text>
              <Text style={styles.instructionText}>nice 😎</Text>
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
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTopic}>MORE ABOUT THIS {fact.topic.toUpperCase()}</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalDetails}>{fact.details}</Text>
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
    borderBottomColor: '#f0f0f0',
  },
  topicLabel: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
    marginBottom: 4,
    letterSpacing: 1,
  },
  topic: {
    fontSize: 32,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: 'bold',
    color: '#5B3FD1',
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  content: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Medium',
    lineHeight: 40,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  readMoreButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#5B3FD1',
    borderRadius: 20,
  },
  readMoreText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
  },
  instructionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  instructionRow: {
    alignItems: 'center',
  },
  instructionIcon: {
    fontSize: 28,
    color: '#5B3FD1',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    color: '#666',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
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
    borderBottomColor: '#f0f0f0',
  },
  modalTopic: {
    fontSize: 20,
    fontFamily: 'AvenirNext-Bold',
    color: '#5B3FD1',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 32,
    color: '#666',
    lineHeight: 32,
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  modalDetails: {
    fontSize: 18,
    fontFamily: 'AvenirNext-Regular',
    color: '#333',
    lineHeight: 28,
    textAlign: 'left',
  },
});
