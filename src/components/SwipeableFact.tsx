import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_UP_THRESHOLD = 100;

interface SwipeableFactProps {
  fact: {
    content: string;
    topic: string;
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
          <Text style={styles.topicLabel}>TODAY'S FACT ABOUT</Text>
          <Text style={styles.topic}>{fact.topic.toUpperCase()}</Text>
          <Text style={styles.content}>{fact.content}</Text>
          
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructions}>
              ← Swipe left to skip{'\n'}
              → Swipe right to like{'\n'}
              ↑ Swipe up to love
            </Text>
          </View>
        </Animated.View>
      </PanGestureHandler>
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
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topicLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  topic: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4285F4',
    marginBottom: 24,
  },
  content: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
    marginBottom: 20,
  },
  instructionsContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
