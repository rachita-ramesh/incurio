import PushNotification, { Importance } from 'react-native-push-notification';
import PushNotificationIOS, { PushNotificationPermissions } from '@react-native-community/push-notification-ios';

interface NotificationToken {
  token: string;
  os: string;
}

class NotificationService {
  constructor() {
    this.configure();
  }

  configure = () => {
    // Configure the notification channel
    PushNotification.configure({
      onRegister: function (token: NotificationToken) {
        console.log('TOKEN:', token);
      },
      onNotification: function (notification: any) {
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
        channelId: 'daily-facts',
        channelName: 'Daily Facts',
        channelDescription: 'Daily notification for new facts',
        playSound: true,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created: boolean) => console.log(`Channel 'daily-facts' created: ${created}`)
    );
  };

  scheduleDailyNotification = () => {
    // Cancel any existing notifications
    PushNotification.cancelAllLocalNotifications();

    // Schedule reminder notification for 9 AM if user hasn't interacted
    PushNotification.localNotificationSchedule({
      channelId: 'daily-facts',
      title: "🧠 Don't Miss Today's Spark!",
      message: "Your daily spark is waiting to ignite your curiosity!",
      date: this.getNextNotificationDate(),
      repeatType: 'day',
      allowWhileIdle: true,
      importance: 'high',
      playSound: true,
      soundName: 'default',
    });
  };

  getNextNotificationDate = () => {
    const now = new Date();
    const nextNotification = new Date();
    
    // Set notification time to 9 AM
    nextNotification.setHours(9, 0, 0, 0);
    
    // If it's already past 9 AM, schedule for tomorrow
    if (now.getHours() >= 9) {
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
      console.log('Notification permissions:', permissions);
      return permissions;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return null;
    }
  };
}

export const notificationService = new NotificationService(); 