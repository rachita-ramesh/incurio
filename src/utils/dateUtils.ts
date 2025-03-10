/**
 * Converts a UTC date string to local date string with proper formatting
 * @param utcDate - UTC date string from the database
 * @returns Formatted local date string
 */
export function formatLocalDate(utcDate: string): string {
  const date = new Date(utcDate);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Converts a UTC date string to local time
 * @param utcDate - UTC date string from the database
 * @returns Formatted local time string
 */
export function formatLocalTime(utcDate: string): string {
  const date = new Date(utcDate);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Gets the local date components from a UTC date string
 * @param utcDate - UTC date string from the database
 * @returns Object with local date components
 */
export function getLocalDateComponents(utcDate: string) {
  const date = new Date(utcDate);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes()
  };
} 