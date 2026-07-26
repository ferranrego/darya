# 🌊 Darya - Learn Dari through Comprehensible Input

Darya (دریا) is an open-source, progressive web app (PWA) designed to help you learn **Dari** (Afghan Persian, Kabul standard) through **comprehensible input**. 

By reading adaptive, AI-generated texts tailored to your exact vocabulary level, you can naturally acquire the language. The app tracks the words you know and introduces new ones incrementally, ensuring that every text you read is challenging enough to teach you something new, but easy enough to understand from context.

## ✨ Features

- **📖 Adaptive Reading:** AI-generated texts are dynamically created to contain roughly ~2–10% new vocabulary based on your known words.
- **👆 Tap-to-Learn:** Simply tap any word to see its gloss, transliteration, and instantly add it to your learning queue.
- **🎨 Syntax Highlighting & Legends:** Visual aids including part-of-speech color-coding in texts and intuitive legends indicating word mastery states (To Discover, Learning, Known).
- **🧠 FSRS Spaced Repetition:** Built-in flashcard system using the modern Free Spaced Repetition Scheduler (FSRS). Includes context-rich cards with prominent target words, transliterations, and translation hints.
- **📝 Contextual Sentence Review:** Flashcards test each word inside a real sentence you've already read — or a freshly AI-generated one — with the target word highlighted so you recall it in context, not in isolation.
- **🧩 Interactive Exercises:** Practice sessions featuring dynamically generated cloze deletions, sentence building, grammar detective challenges, and cultural realia reading comprehension.
- **📚 Grammar Course (A1–C2):** A full CEFR-aligned grammar curriculum with bite-sized lessons and five interactive exercise types — fill-in-the-blank, build-the-sentence, translation, matching, and spot-the-error.
- **🔤 Alphabet Course:** Complete interactive course for non-readers to learn the Perso-Arabic script from scratch.
- **📊 Progress Dashboard:** A stats page with a study-streak heatmap, vocabulary-growth charts, level forecasting, and celebratory milestone animations.
- **💬 Community Chat:** A shared space to practice writing in Dari, with one-tap transliteration, translation, and gentle correction for any message.
- **🎮 Gamification & Streaks:** Daily goals, XP tracking, a leaderboard, and streak reminders keep you consistent.
- **📱 PWA & Offline Support:** Installable on iOS/Android with offline support for reading and reviewing.

## 🛠️ Tech Stack

Darya is built with a modern, fast, and completely free-tier compatible stack:
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database & Auth:** Supabase (Postgres, Row Level Security, Auth)
- **AI Generation:** Groq (primary) with OpenRouter fallback
- **Spaced Repetition:** `ts-fsrs`

---

## 🚀 Local Development & Forking

Want to run your own instance of Darya or contribute? Here's how to get started.

### Prerequisites
- Node.js & `pnpm`
- A free [Supabase](https://supabase.com/) account
- Free API keys for [Groq](https://console.groq.com/) and/or [OpenRouter](https://openrouter.ai/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ferranrego/darya.git
   cd darya
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your `.env.local` with your Supabase and AI provider keys. *(Note: `.env.local` is ignored by git, so your secrets are safe!)*

4. **Initialize the Database:**
   Ensure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed.
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

5. **Run the Development Server:**
   ```bash
   pnpm dev
   ```
   The app will be running at `http://localhost:3000`.

### Content Pipeline
Darya uses a file-based content architecture. Seed texts and lexicon are stored as JSON in the `content/` folder.
To validate and seed your database, use the provided scripts:
```bash
pnpm validate:content  # Verify schema and integrity
pnpm seed              # Push the lexicon and seed texts to Supabase
```

## 🗺️ Roadmap

Darya is continually evolving.

**✅ Recently shipped**
- **Sentence-Level SRS** — contextual flashcards that test vocabulary inside previously read sentences.
- **Data Visualization & UX** — a stats dashboard with vocabulary-growth charts and a study heatmap, plus celebratory milestone animations.
- **Grammar Course (A1–C2)** — a full CEFR grammar curriculum with five interactive exercise types.
- **Community Chat** — a shared practice space with on-demand transliteration, translation, and correction.

**🚧 On the horizon**
- **Text-Based Roleplay** — chatbots constrained to the user's exact known vocabulary.
- **Audio Integration** — word and sentence audio using high-quality TTS.

## 🤝 Contributing
Contributions are welcome! Whether it's fixing bugs, improving the UI, or adding new seed texts, please feel free to fork the repository, make your changes, and submit a pull request. 

## 📄 License
MIT License
