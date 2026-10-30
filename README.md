# IntelliPrep 🧠⚡

> **Cognitive SDE Interview Mentor with Persistent Memory & Adaptive Pedagogical Feedback**  
> *Built for UNCHARTED 2026 — Track 1 (Persistent Memory & Adaptive AI Agents)*

---

## 🌟 Executive Overview

Technical interview preparation on traditional platforms suffers from **amnesia**: platforms evaluate code in complete isolation. When a student fails a recursion problem due to a missing base case, struggles with two-pointer edge conditions in strings, or grasps concepts faster through call-stack diagrams, the platform forgets the moment the tab is closed.

**IntelliPrep** transforms this dynamic. It pairs candidates with an empathetic, memory-augmented AI mentor that tracks *why* a student fails, preserves evidence-backed cognitive memories across practice sessions, and visibly shifts its explanation strategy (analogies, visual call stacks, theory, dry runs) based on past interactions.

Candidates retain complete sovereignty over their learning profile via the **Memory Vault**—auditing, editing, and purging memories with full transparency.

---

## 🏆 UNCHARTED 2026: Track 1 Mapping

| Track 1 Requirement | IntelliPrep Implementation |
|---|---|
| **Persistent Cognitive Memory** | Indexed Mongoose schemas (`Memory.js`) storing typed traits: `strength`, `weakness`, `mistake`, `learning_preference`, `concept_understood`, and `revision_needed`. |
| **Evidence & Provenance** | Every memory includes an evidence log linking observations to exact problem submissions (`CodingAttempt.js`), chat interactions, or manual corrections with timestamps and sources. |
| **Memory Lifecycle & Superseding** | Misconceptions transition from `active` → `superseded` when a candidate masters a topic. Superseded records remain visible for auditability with explicit links (`supersededBy`). |
| **Temporal Relevance & TTL** | Revision flags support time-to-live (`expiresAt`) backed by MongoDB TTL indexes (`expireAfterSeconds: 0`), ensuring stale suggestions naturally decay. |
| **Visible Pedagogical Adaptation** | The AI mentor consults memory traits to select explanation styles (`theory` → `simple` → `analogy` → `visual` → `dry_run`) and provides explicit justifications (e.g., *"Selected visual style because call stacks aided your recursion understanding previously"*). |
| **Human-in-the-Loop Sovereignty** | The **Memory Vault** allows candidates to inspect, correct (`confidence = 0.95`), filter, or permanently forget memory traits. |

---

## 🏗️ Architecture & Memory Engine Design

```
                     ┌───────────────────────────────────────────────┐
                     │           IntelliPrep Frontend (Vite)         │
                     │  React 18 • Tailwind CSS • Lucide Icons       │
                     └──────────────────────┬────────────────────────┘
                                            │
                                 REST API & x-user-id
                                            │
                     ┌──────────────────────▼────────────────────────┐
                     │          Express Backend Server (Node.js)     │
                     │  Auth Middleware • Error Handler • API Routes │
                     └──────┬───────────────────┬────────────────────┘
                            │                   │
                  Mongoose / ODM                │ Gemini SDK
                            │                   │
             ┌──────────────▼──────────┐ ┌──────▼─────────────────────┐
             │   MongoDB Atlas Cluster │ │      Google Gemini AI      │
             │  • Users                │ │  • Gemini 1.5 Flash        │
             │  • Student Memories     │ │  • Mentor & Judge Prompts  │
             │  • Topic Mastery        │ │  • Structured JSON Output  │
             │  • Coding Attempts      │ └────────────────────────────┘
             │  • Chat Sessions        │
             └─────────────────────────┘
```

### The 4 Pillars of the Cognitive Engine

1. **Extraction Pipeline**: Analyzes student dialogue and code submissions to extract granular cognitive artifacts (e.g. error types like `wrong_base_case`, `off_by_one`, `edge_case_missed`).
2. **Topic Mastery Ladder**: Tracks 10 canonical DSA topics (`arrays`, `strings`, `linked-list`, `stacks-queues`, `hashing`, `sorting`, `recursion`, `trees`, `graphs`, `dp`) scoring each from 0–100 with a rolling 10-score history.
3. **Adaptive Explanation Ladder**: Five progressive pedagogical styles:
   - `theory`: Formal algorithmic foundations and asymptotic complexity.
   - `simple`: Plain, accessible breakdown for beginners.
   - `analogy`: Real-world metaphors (e.g., Matryoshka nesting dolls for recursion).
   - `visual`: Text-based call-stack and memory diagramming.
   - `dry_run`: Line-by-line variable tracing.
4. **Transparent Vault**: Provides candidates with full auditability, confidence metering, and one-click demo reseeding.

---

## 🔑 Test Credentials

For fast review and evaluation, use the pre-configured demo account:

* **Email**: `demo@intelliprep.dev`
* **Password**: None required (passwordless session loaded via `x-user-id`)
* **One-Click Demo**: Click **"Continue as Demo Student (demo@intelliprep.dev)"** on the Login screen, or trigger `POST /api/demo/reset` via the **"Reset Demo"** navbar button to restore the verified baseline.

---

## 🚀 Setup & Local Installation

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **MongoDB**: Atlas connection string or local MongoDB instance
* **Google Gemini API Key**: [Get key from Google AI Studio](https://aistudio.google.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/PrepPulse.git
cd PrepPulse
```

### 2. Configure Server
```bash
cd server
cp .env.example .env
npm install
```

Configure `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/intelliprep?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
CLIENT_ORIGIN=http://localhost:5173
```

Seed initial demo student data:
```bash
npm run seed
```

Start the backend:
```bash
# Production mode:
npm start

# Development mode (auto-reload):
npm run dev
```

### 3. Configure Frontend Client
In a new terminal:
```bash
cd client
cp .env.example .env
npm install
```

Configure `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend development server:
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## ⚙️ Environment Variables Reference

### Backend (`server/.env`)
| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `5000` | Port for Express server |
| `MONGODB_URI` | **Yes** | — | MongoDB Atlas connection URI with read/write access |
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key for pedagogical mentoring |
| `GEMINI_MODEL` | Optional | `gemini-1.5-flash` | Gemini model variant |
| `CLIENT_ORIGIN` | Optional | `http://localhost:5173` | Allowed frontend origin for CORS |

### Frontend (`client/.env`)
| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | Optional | `http://localhost:5000/api` | Base URL of the IntelliPrep Express API |

---

## 🌐 Deployment Configuration

### Frontend (Vercel)
The client includes [client/vercel.json](file:///c:/Users/Lenovo/Desktop/ChatterBox/PrepPulse/client/vercel.json) configuring SPA rewrites to `/index.html`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Set `VITE_API_URL` in the Vercel project environment variables pointing to your hosted API.

### Backend (Render / Railway / DigitalOcean)
* **Build Command**: `npm install`
* **Start Command**: `npm start` (`node index.js`)
* **CORS Compatibility**: [server/app.js](file:///c:/Users/Lenovo/Desktop/ChatterBox/PrepPulse/server/app.js) dynamically recognizes `localhost`, configured `CLIENT_ORIGIN`, and any `*.vercel.app` frontend domain with `credentials: true`.

---

## 📦 Third-Party Library Attributions

* **Google Gemini API** (`@google/genai`): Powers adaptive explanations, diagnostic feedback, and structured JSON intent classification.
* **Mongoose & MongoDB Atlas**: Document schemas, compound indexing, and TTL auto-expirations.
* **Tailwind CSS**: Utility-first responsive dark-mode styling and fluid layouts.
* **React & React Router**: Component rendering and single-page navigation.
* **Lucide React**: Clean, modern SVG iconography.
* **Axios**: HTTP client with request interceptors managing user context headers.

---

## 🔮 Future Scope & Roadmap

1. **Multi-Agent Mock Interview Panel**: Separate interviewer personas (System Architect, Rigorous Grader, Behavioral Lead) coordinating through shared candidate memory.
2. **WebAssembly Code Sandboxing**: In-browser sandboxed code execution for low-latency test suite evaluation without remote execution security risks.
3. **Decaying Spaced Repetition**: Dynamic push notifications scheduled when `revision_needed` TTL timestamps approach expiration.
4. **Voice & Multimodal Debugging**: Real-time spoken dialogue and whiteboard sketch analysis via Gemini Live API.
