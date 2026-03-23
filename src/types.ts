export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'student';
  createdAt: any;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  imageUrl?: string;
}

export interface Exam {
  id: string;
  title: string;
  teacherId: string;
  questions: Question[];
  duration: number; // in minutes
  createdAt: any;
}

export interface Submission {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string>;
  score: number;
  wrongQuestionIds: string[];
  submittedAt: any;
}
