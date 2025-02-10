import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const initializeFirebase = async () => {
  // Configure Google Sign In
  GoogleSignin.configure({
    webClientId: '300660316911-vhtc63tst95sucke51dsp5s7f2po9vi9.apps.googleusercontent.com',
    iosClientId: '300660316911-vhtc63tst95sucke51dsp5s7f2po9vi9.apps.googleusercontent.com',
    offlineAccess: true,
  });

  try {
    return auth();
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};