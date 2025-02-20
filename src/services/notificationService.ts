import PushNotification, { Importance } from 'react-native-push-notification';
import PushNotificationIOS, { PushNotificationPermissions } from '@react-native-community/push-notification-ios';
import { SPARK_TIME } from './factGenerator';

class NotificationService {
  constructor() {
    this.configure();
  }

  configure = () => {
    // Configure the notification channel
    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
        notification.finish(PushNotificationIOS.FetchResult.NoData);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });

    // Create the notification channel (Android only)
    PushNotification.createChannel(
      {
        channelId: 'daily-sparks',
        channelName: 'Daily Sparks',
        channelDescription: 'Daily notification for your morning spark',
        playSound: true,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`Channel created: ${created}`)
    );
  };

  scheduleDailyNotification = () => {
    console.log('=== Notification Scheduling Debug ===');
    
    // Cancel any existing notifications
    PushNotification.cancelAllLocalNotifications();
    console.log('Cancelled existing notifications');

    const nextDate = this.getNextNotificationDate();
    console.log('Next notification details:', {
      date: nextDate.toLocaleString(),
      isoString: nextDate.toISOString(),
      hours: nextDate.getHours(),
      minutes: nextDate.getMinutes(),
      timestamp: nextDate.getTime()
    });

    // Schedule next notification
    PushNotification.localNotificationSchedule({
      channelId: 'daily-sparks',
      title: "🧠 Your Daily Spark",
      message: "Start your day with curiosity!",
      date: nextDate,
      repeatType: 'day',
      allowWhileIdle: true,
      importance: 'high',
      playSound: true,
      soundName: 'default',
    });
    
    console.log('Notification scheduled successfully');
  };

  getNextNotificationDate = () => {
    const now = new Date();
    const nextNotification = new Date();
    
    // Set to 3 minutes after spark time (9:03 AM)
    const hours = Math.floor(SPARK_TIME);
    const minutes = Math.round((SPARK_TIME - hours) * 60) + 3; // Add 3 minutes
    nextNotification.setHours(hours, minutes, 0, 0);
    
    console.log('Notification time calculation:', {
      sparkTime: SPARK_TIME,
      hours,
      minutes,
      currentTime: now.toLocaleString(),
      scheduledTime: nextNotification.toLocaleString()
    });
    
    // If it's already past notification time, schedule for tomorrow
    if (now > nextNotification) {
      console.log('Past notification time, scheduling for tomorrow');
      nextNotification.setDate(nextNotification.getDate() + 1);
    }
    
    return nextNotification;
  };

  cancelTodayNotification = () => {
    PushNotification.cancelAllLocalNotifications();
  };

  requestPermissions = async (): Promise<PushNotificationPermissions | null> => {
    try {
      const permissions = await PushNotification.requestPermissions();
      return permissions;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return null;
    }
  };
}

export const notificationService = new NotificationService(); 