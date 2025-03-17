/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView, TouchableOpacity } from 'react-native-gesture-handler';
import { View, ActivityIndicator, Linking, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './src/api/supabase';
import { AuthScreen } from './src/screens/Auth/AuthScreen';
import { TopicScreen } from './src/screens/Topic/TopicScreen';
import { FactScreen } from './src/screens/Fact/FactScreen';
import { CuriosityHubScreen } from './src/screens/Account/CuriosityHubScreen';
import { SparkSearchScreen } from './src/screens/Search/SparkSearchScreen';
import { notificationService } from './src/services/notificationService';
import { backgroundTaskService } from './src/services/backgroundTaskService';
import { Session } from '@supabase/supabase-js';
import { TopicPreferencesScreen } from './src/screens/Account/TopicPreferencesScreen';
import { FactHistoryScreen } from './src/screens/Account/FactHistoryScreen';
import { AccountSettingsScreen } from './src/screens/Account/AccountSettingsScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { lightTheme, darkTheme } from './src/theme/colors';
import { UserProvider } from './src/contexts/UserContext';
import { CuriosityTrailsScreen } from './src/screens/Account/CuriosityTrailsScreen';

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
  CuriosityTrails: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent(): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Auth');
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
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
        
        // Initialize and start background task service
        await backgroundTaskService.configure();
        await backgroundTaskService.startBackgroundFetch();
        
        // Get initial session and user data
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (initialSession?.user) {
          console.log('Found existing session for user:', initialSession.user.id);
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('preferences, created_at')
            .eq('id', initialSession.user.id)
            .single();
          
          if (userError) throw userError;

          // Update last login
          await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', initialSession.user.id);

          setSession(initialSession);
          
          if (!userData) {
            console.log('No user data found, creating new profile');
            await supabase
              .from('users')
              .insert([{
                id: initialSession.user.id,
                preferences: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]);
            setInitialRoute('Topic');
          } else {
            console.log('Found existing user with preferences:', userData.preferences);
            setUserPreferences(userData.preferences || []);
            setInitialRoute(userData.preferences?.length > 0 ? 'Fact' : 'Topic');
          }
        }

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          console.log('Auth State Changed:', event);
          if (!newSession) {
            console.log('No session, returning to Auth');
            setSession(null);
            setInitialRoute('Auth');
            return;
          }

          try {
            console.log('Checking user data for:', newSession.user.id);
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('preferences, created_at')
              .eq('id', newSession.user.id)
              .single();

            if (userError) throw userError;

            setSession(newSession);
            if (!userData) {
              console.log('Creating new user profile');
              await supabase
                .from('users')
                .insert([{
                  id: newSession.user.id,
                  preferences: [],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }]);
              setInitialRoute('Topic');
            } else {
              console.log('Found existing user, preferences:', userData.preferences);
              setUserPreferences(userData.preferences || []);
              setInitialRoute(userData.preferences?.length > 0 ? 'Fact' : 'Topic');
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
            setInitialRoute('Auth');
          }
        });

        setInitializing(false);
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Setup Error:', error);
        setInitializing(false);
        setInitialRoute('Auth');
      }
    };
    
    setup();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }
  
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen 
          name="Auth" 
          component={AuthScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Topic" 
          component={TopicScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Fact" 
          component={FactScreen}
          initialParams={{ selectedTopics: userPreferences }}
          options={({ navigation }) => ({ 
            headerShown: true,
            title: 'Daily Spark',
            headerBackVisible: false,
            headerLeft: () => null,
            headerRight: () => (
              <TouchableOpacity 
                onPress={() => navigation.navigate('CuriosityHub')}
                style={{ marginRight: 8 }}
              >
                <Text style={{ fontSize: 24 }}>🧠</Text>
              </TouchableOpacity>
            ),
            headerTintColor: theme.primary,
            headerTitleStyle: {
              fontFamily: 'AvenirNext-Medium',
              color: theme.primary
            },
          })}
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
            title: '',
            headerTintColor: theme.primary,
            headerTitleStyle: {
              fontFamily: 'AvenirNext-Medium',
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
        <Stack.Screen
          name="CuriosityTrails"
          component={CuriosityTrailsScreen}
          options={{
            headerShown: true,
            title: '',
            headerBackTitle: 'Back',
            headerTintColor: theme.primary,
            headerTitleStyle: {
              fontFamily: 'AvenirNext-Medium',
            },
            headerBackTitleStyle: {
              fontFamily: 'AvenirNext-Regular',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <UserProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppContent />
        </GestureHandlerRootView>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
