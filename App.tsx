/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './src/api/supabase';
import { AuthScreen } from './src/screens/Auth/AuthScreen';
import { HomeScreen } from './src/screens/Home/HomeScreen';
import { FactScreen } from './src/screens/Fact/FactScreen';
import { Session } from '@supabase/supabase-js';
import { AccountScreen } from './src/screens/Account/AccountScreen';
import { TopicPreferencesScreen } from './src/screens/Account/TopicPreferencesScreen';
import { FactHistoryScreen } from './src/screens/Account/FactHistoryScreen';
import { notificationService } from './src/services/notificationService';
import { TopicScreen } from './src/screens/Topic/TopicScreen';

type RootStackParamList = {
  Auth: undefined;
  Topic: undefined;
  Fact: {
    selectedTopics: string[];
  };
  CuriosityHub: undefined;
  TopicPreferences: undefined;
  FactHistory: { filter: 'like' | 'love' | 'dislike' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const setup = async () => {
      try {
        console.log('=== Starting App Setup ===');

        // Schedule daily notifications
        await notificationService.requestPermissions();
        notificationService.scheduleDailyNotification();

        // Set up deep link handling
        const handleDeepLink = async ({url}: {url: string}) => {
          console.log('=== Handling Deep Link ===');
          console.log('Received URL:', url);
          
          // Check for both formats of callback URL
          if (url.includes('auth-callback') || url.includes('auth.callback')) {
            console.log('Auth callback detected, refreshing session...');
            
            // Exchange the token
            const { data: { session: newSession }, error } = await supabase.auth.getSession();
            console.log('Session refresh result:', error ? 'Error' : 'Success');
            
            if (error) {
              console.error('Error getting session after callback:', error);
              return;
            }
            
            if (newSession) {
              console.log('New session received:', newSession.user?.id);
              console.log('Setting session and updating state...');
              setSession(newSession);
            } else {
              console.log('No session received after callback');
              // Try refreshing the session
              const { data: { session: refreshedSession }, error: refreshError } = 
                await supabase.auth.refreshSession();
              if (refreshedSession) {
                console.log('Session refreshed successfully');
                setSession(refreshedSession);
              } else {
                console.log('Could not refresh session:', refreshError);
              }
            }
          } else {
            console.log('URL does not contain auth callback');
          }
        };

        // Set up deep link listeners
        console.log('Setting up deep link listener...');
        Linking.addEventListener('url', handleDeepLink);

        // Check for initial URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('App opened with initial URL:', initialUrl);
          await handleDeepLink({url: initialUrl});
        } else {
          console.log('No initial URL');
        }

        // Get initial session
        console.log('Getting initial session...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting initial session:', error);
          throw error;
        }
        console.log('Initial session:', initialSession?.user?.id || 'None');
        setSession(initialSession);

        // Set up auth state listener
        console.log('Setting up auth state listener...');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          console.log('=== Auth State Changed ===');
          console.log('Event:', event);
          console.log('Session:', newSession?.user?.id || 'None');

          if (event === 'SIGNED_IN') {
            console.log('User signed in:', newSession?.user?.id);
            // Check if this is a new user (first time sign up)
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('id', newSession?.user?.id)
              .single();

            if (!existingUser && newSession?.user) {
              console.log('New user detected, creating profile...');
              const { error: profileError } = await supabase
                .from('users')
                .insert([
                  {
                    id: newSession.user.id,
                    email: newSession.user.email,
                    preferences: []
                  }
                ]);

              if (profileError) {
                console.error('Error creating user profile:', profileError);
              } else {
                console.log('User profile created successfully');
              }
            }
          }

          setSession(newSession);
        });

        setInitializing(false);
        console.log('=== App Setup Complete ===');
        
        return () => {
          console.log('Cleaning up auth subscription');
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('=== Setup Error ===');
        console.error('Error details:', error);
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
          {!session ? (
            <Stack.Screen 
              name="Auth" 
              component={AuthScreen} 
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen 
                name="Topic" 
                component={TopicScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Fact" 
                component={FactScreen}
                options={{ 
                  headerShown: true,
                  title: 'Daily Spark',
                  headerBackTitle: 'Back',
                }}
              />
              <Stack.Screen
                name="CuriosityHub"
                component={AccountScreen}
                options={{
                  headerShown: true,
                  title: 'Curiosity Hub',
                  headerBackTitle: 'Back',
                  headerTitleStyle: {
                    fontFamily: 'AvenirNext-Medium',
                    fontSize: 20,
                  },
                  headerBackTitleStyle: {
                    fontFamily: 'AvenirNext-Regular',
                  },
                }}
              />
              <Stack.Screen
                name="TopicPreferences"
                component={TopicPreferencesScreen}
                options={{
                  headerShown: true,
                  title: 'Topic Preferences',
                  headerBackTitle: 'Back',
                }}
              />
              <Stack.Screen
                name="FactHistory"
                component={FactHistoryScreen}
                options={{
                  headerShown: true,
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
