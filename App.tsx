/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, Linking } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './src/api/supabase';
import { AuthScreen } from './src/screens/Auth/AuthScreen';
import { TopicScreen } from './src/screens/Topic/TopicScreen';
import { FactScreen } from './src/screens/Fact/FactScreen';
import { CuriosityHubScreen } from './src/screens/Account/CuriosityHubScreen';
import { SparkSearchScreen } from './src/screens/Search/SparkSearchScreen';
import { notificationService } from './src/services/notificationService';
import { Session } from '@supabase/supabase-js';
import { TopicPreferencesScreen } from './src/screens/Account/TopicPreferencesScreen';
import { FactHistoryScreen } from './src/screens/Account/FactHistoryScreen';
import { AccountSettingsScreen } from './src/screens/Account/AccountSettingsScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { lightTheme, darkTheme } from './src/theme/colors';

export type RootStackParamList = {
  Auth: undefined;
  Topic: undefined;
  Fact: {
    selectedTopics: string[];
  };
  CuriosityHub: undefined;
  TopicPreferences: undefined;
  FactHistory: { filter: 'like' | 'love' | 'dislike' };
  SparkSearch: undefined;
  AccountSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AuthStateHandler = ({ session }: { session: Session | null }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const handleAuthChange = async () => {
      if (session?.user) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, preferences')
          .eq('id', session.user.id)
          .single();

        if (!userData) {
          console.log('New user detected, creating profile...');
          const { error: profileError } = await supabase
            .from('users')
            .insert([
              {
                id: session.user.id,
                email: session.user.email,
                preferences: [],
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
              }
            ]);

          if (profileError) {
            console.error('Error creating user profile:', profileError);
          } else {
            console.log('User profile created successfully');
            navigation.navigate('TopicPreferences');
          }
        } else {
          // Update last login for existing users
          const { error: updateError } = await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', session.user.id);

          if (updateError) {
            console.error('Error updating last login:', updateError);
          } else {
            console.log('Updated last login timestamp');
            // Check if user has preferences set
            if (userData.preferences && userData.preferences.length > 0) {
              // User has preferences, navigate to Fact screen
              navigation.navigate('Fact', { selectedTopics: userData.preferences });
            } else {
              // User needs to set preferences
              navigation.navigate('TopicPreferences');
            }
          }
        }
      }
    };

    handleAuthChange();
  }, [session, navigation]);

  return null;
};

function AppContent(): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const { isDark, theme } = useTheme();

  console.log('=== AppContent Render ===');
  console.log('Initializing:', initializing);
  console.log('Session:', session ? 'exists' : 'null');
  console.log('Theme:', isDark ? 'dark' : 'light');

  // Customize navigation theme
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text.primary,
      border: theme.border,
    },
  };

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
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
  
  return (
    <NavigationContainer theme={navigationTheme}>
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
                headerTintColor: theme.primary,
                headerTitleStyle: {
                  fontFamily: 'AvenirNext-Medium',
                  color: theme.primary
                },
              }}
            />
            <Stack.Screen
              name="CuriosityHub"
              component={CuriosityHubScreen}
              options={{
                headerShown: true,
                title: 'Curiosity Hub',
                headerBackTitle: 'Back',
                headerTintColor: theme.primary,
                headerTitleStyle: {
                  fontFamily: 'AvenirNext-Medium',
                  fontSize: 20,
                  color: theme.primary
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
                headerBackTitle: 'Back',
                title: '',
                headerTintColor: theme.primary,
                headerTitleStyle: {
                  fontFamily: 'AvenirNext-Medium',
                },
              }}
            />
            <Stack.Screen
              name="FactHistory"
              component={FactHistoryScreen}
              options={{
                headerShown: true,
                headerBackTitle: 'Back',
                title: '',
                headerTintColor: theme.primary,
                headerTitleStyle: {
                  fontFamily: 'AvenirNext-Medium',
                },
              }}
            />
            <Stack.Screen
              name="SparkSearch"
              component={SparkSearchScreen}
              options={{
                headerShown: true,
                headerBackTitle: 'Back',
                title: 'Search Sparks',
                headerTintColor: theme.primary,
                headerTitleStyle: {
                  fontFamily: 'AvenirNext-Medium',
                  fontSize: 20,
                  color: theme.primary
                },
                headerBackTitleStyle: {
                  fontFamily: 'AvenirNext-Regular',
                },
              }}
            />
            <Stack.Screen
              name="AccountSettings"
              component={AccountSettingsScreen}
              options={{
                headerShown: true,
                title: 'Account',
                headerBackTitle: 'Back',
                headerTintColor: theme.primary,
                headerTitleStyle: {
                  fontFamily: 'AvenirNext-Medium',
                  fontSize: 20,
                  color: theme.primary
                },
                headerBackTitleStyle: {
                  fontFamily: 'AvenirNext-Regular',
                },
              }}
            />
          </>
        )}
      </Stack.Navigator>
      <AuthStateHandler session={session} />
    </NavigationContainer>
  );
}

function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContent />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

export default App;
