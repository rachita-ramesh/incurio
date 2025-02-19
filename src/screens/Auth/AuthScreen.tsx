import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../../api/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { notificationService } from '../../services/notificationService';
import { useTheme } from '../../theme/ThemeContext';

type RootStackParamList = {
  Auth: undefined;
  Topic: undefined;
  Fact: { selectedTopics: string[] };
  CuriosityHub: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
};

type AuthMode = 'signin' | 'signup' | 'reset';

export const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('signin');

  const handleEmailAuth = async () => {
    try {
      setLoading(true);
      console.log('=== Starting Email Auth ===');
      console.log('Mode:', mode);

      if (mode === 'reset') {
        console.log('Attempting password reset for:', email);
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
          console.error('Password reset error:', error);
          throw error;
        }
        console.log('Password reset email sent successfully');
        Alert.alert('Success', 'Password reset email has been sent.');
        setMode('signin');
        return;
      }

      if (mode === 'signup') {
        console.log('Attempting signup for:', email);
        if (password !== confirmPassword) {
          console.log('Password mismatch');
          Alert.alert('Error', 'Passwords do not match');
          return;
        }
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          console.error('Signup error:', error);
          throw error;
        }
        console.log('Signup successful:', data);
        Alert.alert('Success', 'Please check your email to verify your account.');
        setMode('signin');
        return;
      }

      // Sign in mode
      console.log('Attempting signin for:', email);
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error('Sign in error:', error);
        throw error;
      }
      console.log('Sign in successful:', data);
      
    } catch (error: any) {
      console.error('=== Email Auth Error ===');
      console.error('Error details:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateNonce = async (): Promise<string> => {
    // Generate random bytes
    const randomValues = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
    // Convert to characters
    const chars = randomValues.map(byte => String.fromCharCode(byte)).join('');
    // Convert to base64 using btoa
    return btoa(chars).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const handleGoogleAuth = async () => {
    try {
      console.log('=== Starting Google Auth ===');
      console.log('Mode:', mode);
      setLoading(true);

      // Configure Google Sign In
      GoogleSignin.configure({
        iosClientId: '853554015668-pm7cucqhra01lphok4og1bo5ddfu1ff9.apps.googleusercontent.com',
        webClientId: '853554015668-4ge6b4dg17fdq1nbii481ka7fpoaqfhh.apps.googleusercontent.com',
      });

      // Sign in with Google
      console.log('Starting Google Sign In...');
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign In response:', JSON.stringify(userInfo));

      // Validate user info
      if (!userInfo?.data?.user?.email) {
        throw new Error('No email received from Google Sign In');
      }

      // Get tokens
      const { idToken } = await GoogleSignin.getTokens();
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      console.log(`Attempting to ${mode} with Supabase...`);
      
      // Sign in to Supabase using the Google ID token
      const { data: { user, session }, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (signInError) {
        console.error('Supabase sign in error:', signInError);
        throw signInError;
      }

      if (user) {
        // Check if user profile exists
        const { data: existingProfile, error: checkError } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .single();

        if (!existingProfile) {
          console.log('Creating new user profile...');
          const { error: profileError } = await supabase
            .from('users')
            .insert([
              {
                id: user.id,
                email: user.email,
                preferences: [],
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
              }
            ]);

          if (profileError) {
            console.error('Error creating user profile:', profileError);
          } else {
            // Schedule notifications for new users
            await notificationService.requestPermissions();
            notificationService.scheduleDailyNotification();
          }
          navigation.replace('Topic');
        } else {
          console.log('User profile exists with preferences:', existingProfile.preferences);
          // Update last login
          await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

          if (existingProfile.preferences?.length > 0) {
            navigation.replace('Fact', { selectedTopics: existingProfile.preferences });
          } else {
            navigation.replace('Topic');
          }
        }
      }

    } catch (error: any) {
      console.error('=== Google Auth Error ===');
      console.error('Detailed error:', error);
      
      // Sign out from Google to clean up state
      try {
        await GoogleSignin.signOut();
      } catch (signOutError) {
        console.error('Error signing out from Google:', signOutError);
      }

      Alert.alert(
        'Authentication Error',
        `Unable to ${mode} with Google. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              {mode === 'signin' ? 'Welcome Back' : 'Join Incurio'}
            </Text>

            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              {mode === 'signin' 
                ? 'Sign in to continue to your account' 
                : 'Create an account to get started'}
            </Text>

            <TouchableOpacity 
              style={[
                styles.googleButton,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder
                },
                loading && styles.buttonDisabled
              ]}
              onPress={handleGoogleAuth}
              disabled={loading}
            >
              <Text style={[styles.googleButtonText, { color: theme.text.primary }]}>
                {mode === 'signin' 
                  ? 'Sign in with Google'
                  : 'Sign up with Google'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
              <Text style={[styles.dividerText, { color: theme.text.secondary }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
            </View>

            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  color: theme.text.primary
                }
              ]}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={theme.text.secondary}
            />

            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  color: theme.text.primary
                }
              ]}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={theme.text.secondary}
            />

            <TouchableOpacity 
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                loading && styles.buttonDisabled
              ]}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Please wait...' : 
                 mode === 'signin' ? 'Sign in with Email' : 'Sign up with Email'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              {mode === 'signin' ? (
                <>
                  <Text style={[styles.footerLabel, { color: theme.text.secondary }]}>
                    Don't have an account?
                  </Text>
                  <TouchableOpacity onPress={() => setMode('signup')}>
                    <Text style={[styles.footerAction, { color: theme.primary }]}>
                      Sign up
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[styles.footerLabel, { color: theme.text.secondary }]}>
                    Already have an account?
                  </Text>
                  <TouchableOpacity onPress={() => setMode('signin')}>
                    <Text style={[styles.footerAction, { color: theme.primary }]}>
                      Sign in
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
    marginBottom: 32,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    fontFamily: 'AvenirNext-Regular',
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6B4EFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLabel: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Regular',
  },
  footerAction: {
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
}); 