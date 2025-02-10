import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
};

const AUTH_PERSISTENCE_KEY = '@auth_tokens';

export const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);

  const onGoogleButtonPress = async () => {
    try {
      setLoading(true);
      console.log('Starting Google Sign-in process...');

      // Check Play Services
      await GoogleSignin.hasPlayServices();
      console.log('Play Services check passed');

      // Sign in with Google
      console.log('Attempting Google Sign-in...');
      await GoogleSignin.signIn();
      const { accessToken, idToken } = await GoogleSignin.getTokens();
      console.log('Google Sign-in successful, got tokens');

      if (!idToken) {
        throw new Error('No ID token received from Google Sign-in');
      }

      // Store tokens
      console.log('Storing auth tokens...');
      await AsyncStorage.setItem(AUTH_PERSISTENCE_KEY, JSON.stringify({
        idToken,
        timestamp: Date.now()
      }));

      // Sign in to Firebase
      console.log('Creating Firebase credential...');
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      
      console.log('Signing in to Firebase...');
      const userCredential = await auth().signInWithCredential(googleCredential);
      
      if (!userCredential.user) {
        throw new Error('Failed to sign in to Firebase');
      }

      console.log('Firebase sign-in successful:', userCredential.user.uid);
      
      // The navigation will be handled by the auth state listener in App.tsx
      console.log('Waiting for auth state change to trigger navigation...');
      
    } catch (error: any) {
      console.error('Detailed sign-up error:', error);
      
      let errorMessage = 'Failed to sign in with Google. Please try again.';
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in was cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign in is already in progress';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Play Services are not available';
      }

      Alert.alert('Sign-in Error', errorMessage);

      // Clean up on error
      try {
        await GoogleSignin.signOut();
        await AsyncStorage.removeItem(AUTH_PERSISTENCE_KEY);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create your Incurio Account</Text>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onGoogleButtonPress}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating account...' : 'Sign up with Google'}
          </Text>
        </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#000',
  },
  button: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
}); 