import BackgroundFetch from 'react-native-background-fetch';
import { sparkGeneratorService } from './factGenerator';
import { supabase } from '../api/supabase';
import { notificationService } from './notificationService';

class BackgroundTaskService {
  async configure() {
    try {
      // Configure background fetch
      const status = await BackgroundFetch.configure({
        minimumFetchInterval: 15, // minutes
        stopOnTerminate: false,    // Continue background task when app is terminated
        startOnBoot: true,         // Run background task when device is rebooted
        enableHeadless: true,      // Enable background processing
        forceAlarmManager: false,  // More precise timing on Android
      }, this.onBackgroundFetch, this.onBackgroundFetchTimeout);

      console.log('[BackgroundTaskService] configure status:', status);
    } catch (error) {
      console.error('[BackgroundTaskService] configure error:', error);
    }
  }

  private onBackgroundFetch = async (taskId: string) => {
    console.log('[BackgroundTaskService] onBackgroundFetch start:', taskId);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      if (user) {
        // Get user preferences
        const { data: userData, error: prefsError } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .single();
        
        if (prefsError) throw prefsError;

        // Check if we should generate a new spark
        const shouldGenerate = await sparkGeneratorService.shouldGenerateNewSpark();
        const hasSparkForToday = await sparkGeneratorService.hasSparkForToday(user.id);

        console.log('[BackgroundTaskService] Check:', {
          shouldGenerate,
          hasSparkForToday,
          userId: user.id,
          preferences: userData.preferences
        });

        if (shouldGenerate && !hasSparkForToday) {
          // Generate new spark
          await sparkGeneratorService.getTodaysSpark(
            user.id,
            userData.preferences || [],
            'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
          );
          
          // Ensure notification is scheduled
          notificationService.scheduleDailyNotification();
        }
      }

      // Signal completion of background task
      BackgroundFetch.finish(taskId);
    } catch (error) {
      console.error('[BackgroundTaskService] task error:', error);
      BackgroundFetch.finish(taskId);
    }
  };

  private onBackgroundFetchTimeout = async (taskId: string) => {
    // Handle timeout
    console.warn('[BackgroundTaskService] TIMEOUT task:', taskId);
    BackgroundFetch.finish(taskId);
  };

  // Method to manually start a background fetch (useful for testing)
  async startBackgroundFetch() {
    try {
      const status = await BackgroundFetch.status();
      console.log('[BackgroundTaskService] status:', status);
      
      // Start a background task
      await BackgroundFetch.start();
      console.log('[BackgroundTaskService] start success');
    } catch (error) {
      console.error('[BackgroundTaskService] start error:', error);
    }
  }
}

export const backgroundTaskService = new BackgroundTaskService(); 