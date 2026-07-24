import type { TextDocument } from "../content/schema";
import type { Card } from "ts-fsrs";

export type WordStatus = "learning" | "known";

export interface ProfileRow {
  id: string;
  display_name: string;
  xp: number;
  streak_current: number;
  streak_best: number;
  last_active_date: string | null;
  daily_goal: number;
  new_word_ratio: number;
  can_read_script: boolean | null;
  level_estimate: string;
  onboarded_at: string | null;
  chat_notifications: boolean;
  reminder_notifications: boolean;
  last_chat_push_at: string | null;
  prior_words_decision: "seeded" | "manual" | null;
  created_at: string;
}

export interface UserWordRow {
  user_id: string;
  lexeme_id: string;
  status: WordStatus;
  due: string | null;
  fsrs: Card | null;
  context_dari: string | null;
  context_translit: string | null;
  context_en: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserLetterRow {
  user_id: string;
  letter_char: string;
  due: string | null;
  fsrs: Card | null;
  created_at: string;
  updated_at: string;
}

export interface TextRow {
  id: string;
  level: string;
  vocab_hash: string | null;
  theme: string | null;
  source: "seed" | "generated";
  doc: TextDocument;

  created_at: string;
}

export interface UserTextRow {
  user_id: string;
  text_id: string;
  read_at: string;
  words_tapped: number;
}

export interface AlphabetProgressRow {
  user_id: string;
  unit_id: string;
  completed_at: string | null;
  correct: number;
  total: number;
}

export interface GrammarProgressRow {
  user_id: string;
  lesson_id: string;
  completed_at: string | null;
  correct: number;
  total: number;
}

export interface ChatMessageRow {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  translit: string | null;
  translation: string | null;
  correction: {
    corrected: string;
    issues: { before: string; after: string; whyEn: string }[];
  } | null;
  created_at: string;
}

export interface DailyActivityRow {
  user_id: string;
  date: string;
  xp: number;
  reviews_done: number;
  texts_read: number;
  words_learned: number;
}

export type ExerciseType = "cloze" | "unscramble" | "realia" | "grammar_detective";

export interface ExerciseRow {
  id: string;
  type: ExerciseType;
  data: any; // Stored as jsonb, can be typed more specifically later
  lexeme_ids: string[];
  level: string;
  created_at: string;
}

export interface UserExerciseRow {
  user_id: string;
  exercise_id: string;
  completed_at: string;
  is_correct: boolean;
}

export interface SentenceExplanationRow {
  sentence_hash: string;
  explanation: any; // Stored as jsonb
  created_at: string;
}

export interface WrongAnswerExplanationRow {
  exercise_id: string;
  chosen_answer: string;
  explanation_en: string;
  created_at: string;
}
