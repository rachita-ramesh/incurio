export const AVAILABLE_TOPICS = [
  'Science',
  'Technology',
  'History',
  'Nature',
  'Space',
  'Psychology',
  'Philosophy',
  'Art',
  'Music',
  'Literature',
  'Mathematics',
  'Medicine',
  'Biology',
  'Chemistry',
  'Physics',
  'Astronomy',
  'Geography',
  'Economics',
  'Politics',
  'Society',
  'Sports'
] as const;

export type Topic = typeof AVAILABLE_TOPICS[number]; 