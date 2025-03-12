import BackgroundFetch from 'react-native-background-fetch';
import { sparkGeneratorService } from './factGenerator';
import { supabase } from '../api/supabase';
import { notificationService } from './notificationService';

// Generation windows for sparks (in local time)
const GENERATION_TIMES = {
  INITIAL: 4, // 4 AM local time
  FIRST_RETRY: 5, // 5 AM local time
  FINAL_RETRY: 6, // 6 AM local time
};

class BackgroundTaskService {
  private lastGenerationAttempt: Date | null = null;

  async configure() {
    try {
      // Configure background fetch to run every 15 minutes
      const status = await BackgroundFetch.configure({
        minimumFetchInterval: 15, // Run every 15 minutes to ensure we don't miss generation windows
        stopOnTerminate: false,   // Continue background task when app is terminated
        startOnBoot: true,        // Run background task when device is rebooted
        enableHeadless: true,     // Enable background processing
        forceAlarmManager: true,  // More precise timing on Android
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, // Require network connectivity
      }, this.onBackgroundFetch, this.onBackgroundFetchTimeout);

      console.log('[BackgroundTaskService] configure status:', status);
    } catch (error) {
      console.error('[BackgroundTaskService] configure error:', error);
    }
  }

  private isGenerationWindow(): { shouldRun: boolean, isRetry: boolean, windowType: 'INITIAL' | 'FIRST_RETRY' | 'FINAL_RETRY' | null } {
    const now = new Date();
    const localHour = now.getHours();
    const localMinutes = now.getMinutes();

    // Convert current time to a decimal hour for easier comparison
    const currentTimeDecimal = localHour + (localMinutes / 60);

    // Check if we're in any of the generation windows
    // Allow a 45-minute window for each generation time to account for potential delays
    const isInitialWindow = Math.abs(currentTimeDecimal - GENERATION_TIMES.INITIAL) <= 0.75;
    const isFirstRetryWindow = Math.abs(currentTimeDecimal - GENERATION_TIMES.FIRST_RETRY) <= 0.75;
    const isFinalRetryWindow = Math.abs(currentTimeDecimal - GENERATION_TIMES.FINAL_RETRY) <= 0.75;

    // Determine which window we're in
    let windowType: 'INITIAL' | 'FIRST_RETRY' | 'FINAL_RETRY' | null = null;
    if (isInitialWindow) windowType = 'INITIAL';
    else if (isFirstRetryWindow) windowType = 'FIRST_RETRY';
    else if (isFinalRetryWindow) windowType = 'FINAL_RETRY';

    // Check if we've already attempted generation in this window
    const shouldSkip = this.lastGenerationAttempt && 
      this.lastGenerationAttempt.getDate() === now.getDate() &&
      Math.abs(this.lastGenerationAttempt.getHours() - localHour) < 1;

    return {
      shouldRun: (isInitialWindow || isFirstRetryWindow || isFinalRetryWindow) && !shouldSkip,
      isRetry: isFirstRetryWindow || isFinalRetryWindow,
      windowType
    };
  }

  private async generateSparksForAllUsers(isRetry: boolean = false) {
    const now = new Date();
    console.log(`[BackgroundTaskService] Starting ${isRetry ? 'retry' : 'initial'} spark generation for all users`);
    console.log(`[BackgroundTaskService] Local time: ${now.toLocaleString()}`);
    
    try {
      // Update last generation attempt
      this.lastGenerationAttempt = now;

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

      // Get today's and tomorrow's date in local time
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Process each user sequentially
      for (const user of users) {
        try {
          console.log(`[BackgroundTaskService] Processing user: ${user.id}`);
          
          // Check if user has sparks for today
          const hasSparkForToday = await sparkGeneratorService.hasSparkForDate(
            user.id,
            today
          );

          // Check if user has sparks for tomorrow
          const hasSparkForTomorrow = await sparkGeneratorService.hasSparkForDate(
            user.id,
            tomorrow
          );

          // Generate today's sparks if needed (during first window only)
          if (!hasSparkForToday && !isRetry) {
            console.log(`[BackgroundTaskService] Generating today's sparks for user: ${user.id}`);
            await sparkGeneratorService.generateDailySpark(
              user.id,
              user.preferences || [],
              'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
            );
          }

          // Generate tomorrow's sparks if needed
          if (!hasSparkForTomorrow || isRetry) {
            console.log(`[BackgroundTaskService] Generating tomorrow's sparks for user: ${user.id}`);
            await sparkGeneratorService.generateDailySpark(
              user.id,
              user.preferences || [],
              'Prefer concise, interesting sparks that are easy to understand and ignite curiosity.'
            );
          }
            
          // Schedule notification for this user
          await notificationService.scheduleDailyNotification();
          console.log(`[BackgroundTaskService] Successfully processed user: ${user.id}`);
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
    console.log('[BackgroundTaskService] Current local time:', new Date().toLocaleString());
    
    try {
      const { shouldRun, isRetry, windowType } = this.isGenerationWindow();
      
      if (shouldRun) {
        console.log(`[BackgroundTaskService] Running in ${windowType} window`);
        await this.generateSparksForAllUsers(isRetry);
      } else {
        console.log('[BackgroundTaskService] Not in a generation window or already attempted, skipping');
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