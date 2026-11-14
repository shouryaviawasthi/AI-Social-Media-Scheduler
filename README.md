# Social Media Scheduler

## Project Overview
Social Media Scheduler is a full-stack web application designed to help users schedule and manage their social media content. It features a modern user interface and a robust backend to handle scheduling logic, content generation via AI, and data persistence.

## Architecture
The project follows a standard client-server architecture, separated into two main directories:
- **`client`**: The frontend application.
- **`server`**: The backend API.

---

## Frontend (Client)
The frontend is a single-page application (SPA) built to provide a seamless and responsive user experience.

### Key Technologies & Modules:
- **React (`react`, `react-dom`)**: Core UI library for building component-based user interfaces.
- **Vite (`vite`, `@vitejs/plugin-react`)**: Fast, modern frontend build tool and development server.
- **Tailwind CSS (`tailwindcss`, `@tailwindcss/vite`)**: Utility-first CSS framework for rapid and responsive styling.
- **React Router (`react-router-dom`)**: Handles client-side routing and navigation.
- **Icons (`lucide-react`, `@icons-pack/react-simple-icons`)**: Icon libraries for UI elements.
- **TypeScript**: Adds static typing for better developer experience and code reliability.

---

## Backend (Server)
The backend provides a RESTful API to serve data to the frontend, manage authentication, and handle AI integrations.

### Key Technologies & Modules:
- **Node.js & Express (`express`)**: The core server runtime and web framework for building the API.
- **TypeScript (`tsx`, `typescript`)**: Used for robust server-side development.
- **Database (`mongoose`)**: Object Data Modeling (ODM) library for MongoDB, used to store user data, schedules, and content.
- **Security & Authentication (`bcryptjs`)**: Used for securely hashing user passwords.
- **CORS (`cors`)**: Middleware to enable Cross-Origin Resource Sharing, allowing the frontend to communicate with the backend.
- **AI Integrations**:
  - `@google/genai`: Google GenAI integration for content generation.
  - `openai`: OpenAI integration for AI-powered features.
- **Environment Management (`dotenv`)**: Loads environment variables from a `.env` file.

---

## Frontend and Backend Communication
The communication between the frontend and backend is handled via standard **HTTP requests (REST API)**.

1. **API Endpoints**: The backend (Express) exposes various RESTful API endpoints (e.g., for authentication, managing schedules, or generating content).
2. **CORS Configuration**: The backend uses the `cors` middleware to explicitly allow HTTP requests originating from the frontend's local development server or production domain.
3. **HTTP Clients**: The frontend interacts with these endpoints using built-in browser APIs like `fetch` to send HTTP requests (GET, POST, PUT, DELETE) and receive JSON responses.
4. **Data Format**: Data exchanged between the client and server is strictly formatted as **JSON**.

## Getting Started

### Prerequisites
- Node.js installed
- MongoDB instance running

### Installation

1. **Install Client Dependencies:**
   ```bash
   npm --prefix client install
   ```

2. **Install Server Dependencies:**
   ```bash
   npm --prefix server install
   ```

### Environment Configuration

Create `server/.env` from `server/.env.example` and configure MongoDB, social OAuth, encryption, and AI provider credentials. Keep `.env` out of source control.

**📘 Meta (Facebook & Instagram) Setup**: See [`META_SETUP_GUIDE.md`](./META_SETUP_GUIDE.md) for detailed instructions on configuring your Meta Developer App, Instagram Business account, and OAuth settings.

- Facebook publishing requires the `pages_manage_posts` permission. Reconnect Facebook Pages after adding this permission so the saved token can publish.
- Instagram publishing requires an Instagram Business or Creator account linked to a Facebook Page. See the Meta setup guide for detailed instructions.
- LinkedIn publishing uses the `w_member_social` permission. The API version defaults to `202609`; override it with `LINKEDIN_API_VERSION` if needed.
- Gemini text generation defaults to `gemini-3.8-flash`, then falls back to `gemini-3.7-flash` and `gemini-3.5-flash-lite` when a model is temporarily unavailable. Override the sequence with `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, and `GEMINI_LAST_RESORT_MODEL`.
- Set `VITE_API_URL` in the client environment when the backend is not running at `http://localhost:3000`.

## Publishing and Scheduling

- The scheduler supports Facebook Pages, LinkedIn member profiles, and Instagram business accounts. X/Twitter is not currently available as a publishing target.
- Facebook and LinkedIn accept text-only posts and image posts. Instagram publishing requires an image; video posts are not supported by the current publisher.
- Connect each selected social account before scheduling. Facebook must be reconnected after granting `pages_manage_posts`.
- Due posts are checked every 45 seconds. A post is marked **Published** only after every selected platform reports a successful publish. If one platform fails, completed platforms are recorded and the remaining platforms are retried without reposting the successful ones.
- “Publish now” uses the same platform publishing flow as automatic scheduling. Account or provider errors leave the post scheduled and are shown to the user.

### Running the Application

1. **Start the Backend Server:**
   ```bash
   npm --prefix server run server
   ```
   *(Ensure you have your `.env` file configured properly based on `.env.example`)*

2. **Start the Frontend Development Server:**
   ```bash
   npm --prefix client run dev
   ```

3. Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).


---

## 🐳 Docker Setup (Recommended)

For the easiest setup, use Docker:

```bash
# 1. Clone and configure
git clone <repository-url>
cd Social-Media
cp .env.example .env

# 2. Edit .env with your credentials

# 3. Start all services
docker compose up --build -d

# 4. Access application at http://localhost:5173
```

**Complete Docker documentation:** See [DOCKER_SETUP.md](./DOCKER_SETUP.md)

### Docker Compose Services
- **Frontend** (React/Vite): Port 5173
- **Backend** (Express/Node): Port 3000
- **MongoDB**: Port 27017 (with persistent volume)





<!-- for ur team

git clone <your-repo>
cd Social-Media
cp .env.example .env
# Edit .env with their API keys
docker compose up --build -d
# App runs at http://localhost:5173 -->
