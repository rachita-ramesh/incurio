export const lightTheme = {
  background: '#FFFFFF',
  surface: '#F8F5FF',
  primary: '#6B4EFF',
  text: {
    primary: '#000000',
    secondary: '#666666',
  },
  border: '#EEEEEE',
  card: '#FFFFFF',
  cardBorder: '#EEEEEE',
  success: '#34C759',
  error: '#FF3B30',
  divider: '#EEEEEE',
};

export const darkTheme = {
  background: '#1A1A1A',
  surface: '#2A2A2A',
  primary: '#8B6FFF', // Slightly lighter purple for dark mode
  text: {
    primary: '#FFFFFF',
    secondary: '#AAAAAA',
  },
  border: '#333333',
  card: '#2A2A2A',
  cardBorder: '#333333',
  success: '#32D74B',
  error: '#FF453A',
  divider: '#333333',
};

export type Theme = typeof lightTheme; 