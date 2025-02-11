/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthScreen } from './src/screens/Auth/AuthScreen';
import { initializeFirebase } from './src/config/firebase';
import { HomeScreen } from './src/screens/Home/HomeScreen';
import { FactScreen } from './src/screens/Fact/FactScreen';

type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Fact: {
    selectedTopics: string[];
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AUTH_PERSISTENCE_KEY = '@auth_tokens';

function App(): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);

  const restoreAuthState = async () => {
    try {
      console.log('Attempting to restore auth state...');
      const storedAuth = await AsyncStorage.getItem(AUTH_PERSISTENCE_KEY);
      
      if (storedAuth) {
        console.log('Found stored auth data');
        const { idToken, timestamp } = JSON.parse(storedAuth);
        
        // Check if token is not too old (1 hour expiry)
        const now = Date.now();
        const tokenAge = now - timestamp;
        const ONE_HOUR = 60 * 60 * 1000;
        
        if (tokenAge > ONE_HOUR) {
          console.log('Stored token is expired, removing...');
          await AsyncStorage.removeItem(AUTH_PERSISTENCE_KEY);
          return;
        }

        if (idToken) {
          console.log('Attempting to sign in with stored token...');
          const credential = auth.GoogleAuthProvider.credential(idToken);
          await auth().signInWithCredential(credential);
          console.log('Successfully restored auth state');
        }
      } else {
        console.log('No stored auth data found');
      }
    } catch (error) {
      console.error('Error restoring auth state:', error);
      // Clear stored tokens if they're invalid
      await AsyncStorage.removeItem(AUTH_PERSISTENCE_KEY);
    }
  };

  useEffect(() => {
    const setup = async () => {
      try {
        console.log('Initializing app...');
        await initializeFirebase();
        
        // Set up auth state listener
        const subscriber = auth().onAuthStateChanged(currentUser => {
          console.log('Auth state changed:', currentUser ? 'User signed in' : 'No user');
          setUser(currentUser);
          if (initializing) setInitializing(false);
        });

        // Then try to restore auth state
        await restoreAuthState();
        
        return subscriber;
      } catch (error) {
        console.error('Setup error:', error);
        setInitializing(false);
      }
    };
    
    setup();
  }, []);

  if (initializing) return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    </GestureHandlerRootView>
  );
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator>
          {!user ? (
            <Stack.Screen 
              name="Auth" 
              component={AuthScreen} 
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen 
                name="Home" 
                component={HomeScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Fact" 
                component={FactScreen}
                options={{ 
                  headerShown: true,
                  title: 'Daily Fact',
                  headerBackTitle: 'Back',
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default App;
