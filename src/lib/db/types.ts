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
  created_at: string;
}

export interface UserWordRow {
  user_id: string;
  lexeme_id: string;
  status: WordStatus;
  due: string | null;
  fsrs: Card | null;
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
