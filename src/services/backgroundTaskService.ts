import BackgroundFetch from 'react-native-background-fetch';
import { sparkGeneratorService } from './factGenerator';
import { supabase } from '../api/supabase';
import { notificationService } from './notificationService';

// Generation windows for sparks
const GENERATION_TIMES = {
  INITIAL: 4, // 4 AM
  FIRST_RETRY: 5, // 5 AM
  FINAL_RETRY: 6, // 6 AM
};

class BackgroundTaskService {
  async configure() {
    try {
      // Configure background fetch to run hourly
      const status = await BackgroundFetch.configure({
        minimumFetchInterval: 60, // Run hourly to check for generation windows
        stopOnTerminate: false,   // Continue background task when app is terminated
        startOnBoot: true,        // Run background task when device is rebooted
        enableHeadless: true,     // Enable background processing
        forceAlarmManager: false, // More precise timing on Android
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, // Require network connectivity
      }, this.onBackgroundFetch, this.onBackgroundFetchTimeout);

      console.log('[BackgroundTaskService] configure status:', status);
    } catch (error) {
      console.error('[BackgroundTaskService] configure error:', error);
    }
  }

  private isGenerationWindow(): { shouldRun: boolean, isRetry: boolean } {
    const now = new Date();
    const currentHour = now.getHours();

    return {
      shouldRun: [GENERATION_TIMES.INITIAL, GENERATION_TIMES.FIRST_RETRY, GENERATION_TIMES.FINAL_RETRY].includes(currentHour),
      isRetry: currentHour === GENERATION_TIMES.FIRST_RETRY || currentHour === GENERATION_TIMES.FINAL_RETRY
    };
  }

  private async generateSparksForAllUsers(isRetry: boolean = false) {
    console.log(`[BackgroundTaskService] Starting ${isRetry ? 'retry' : 'initial'} spark generation for all users`);
    
    try {
      // Fetch all active users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, preferences')
        .order('id');

      if (usersError) throw usersError;
      if (!users || users.length === 0) {
        console.log('[BackgroundTaskService] No users found');
        return;
      }

      console.log(`[BackgroundTaskService] Found ${users.length} users for processing`);

      // Process each user sequentially
      for (const user of users) {
        try {
          console.log(`[BackgroundTaskService] Processing user: ${user.id}`);
          
          // Check if user already has sparks for tomorrow
          const hasSparkForTomorrow = await sparkGeneratorService.hasSparkForDate(
            user.id,
            new Date(Date.now() + 24 * 60 * 60 * 1000)
          );

          if (!hasSparkForTomorrow || isRetry) {
            // Generate sparks for tomorrow
            await sparkGeneratorService.generateDailySpark(
              user.id,
              user.preferences || [],
              'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
            );
            
            // Schedule notification for this user
            await notificationService.scheduleDailyNotification();
            
            console.log(`[BackgroundTaskService] Successfully generated sparks for user: ${user.id}`);
          } else {
            console.log(`[BackgroundTaskService] Sparks already exist for user: ${user.id}`);
          }
        } catch (error) {
          console.error(`[BackgroundTaskService] Error generating sparks for user ${user.id}:`, error);
          // Individual user errors don't stop the batch - continue with next user
        }
      }
    } catch (error) {
      console.error('[BackgroundTaskService] Batch generation error:', error);
      throw error;
    }
  }

  private onBackgroundFetch = async (taskId: string) => {
    console.log('[BackgroundTaskService] onBackgroundFetch start:', taskId);
    
    try {
      const { shouldRun, isRetry } = this.isGenerationWindow();
      
      if (shouldRun) {
        await this.generateSparksForAllUsers(isRetry);
      } else {
        console.log('[BackgroundTaskService] Not in a generation window, skipping');
      }

      // Signal completion of background task
      BackgroundFetch.finish(taskId);
    } catch (error) {
      console.error('[BackgroundTaskService] task error:', error);
      BackgroundFetch.finish(taskId);
    }
  };

  private onBackgroundFetchTimeout = async (taskId: string) => {
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

  // Temporary test method
  async testGenerationNow() {
    console.log('[BackgroundTaskService] Starting test generation');
    try {
      await this.generateSparksForAllUsers(false);
      console.log('[BackgroundTaskService] Test generation completed');
    } catch (error) {
      console.error('[BackgroundTaskService] Test generation failed:', error);
      throw error;
    }
  }
}

export const backgroundTaskService = new BackgroundTaskService(); 