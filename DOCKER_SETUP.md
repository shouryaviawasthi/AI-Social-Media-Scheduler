# Docker Setup Guide - AI Social Media Scheduler

## Prerequisites

- Docker: https://docs.docker.com/get-docker/
- Docker Compose: https://docs.docker.com/compose/install/

## Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd Social-Media
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
# MongoDB
MONGODB_USERNAME=admin
MONGODB_PASSWORD=your_secure_password

# API Keys
GEMINI_API_KEY=your_key_here
POLLINATIONS_API_KEY=your_key_here

# OAuth Credentials
META_APP_ID=your_id_here
META_APP_SECRET=your_secret_here
```

### 3. Build and Start All Services
```bash
docker compose up --build -d
```

### 4. Verify Services
```bash
# Check all containers
docker compose ps

# View logs
docker compose logs -f
```

### 5. Access Application
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **MongoDB:** localhost:27017

## Architecture

```
┌─────────────────────────────────────────────┐
│     Your Browser (http://localhost:5173)    │
└─────────────────┬───────────────────────────┘
                  │
         ┌────────▼────────┐
         │   Frontend      │
         │   (React/Vite)  │
         │   Port: 5173    │
         └────────┬────────┘
                  │ (API calls)
         ┌────────▼────────┐
         │   Backend       │
         │  (Express/TS)   │
         │   Port: 3000    │
         └────────┬────────┘
                  │ (Database)
         ┌────────▼────────┐
         │   MongoDB       │
         │   Port: 27017   │
         └─────────────────┘
```

## Services Explained

### Frontend Container
- **Image:** Node.js 20 Alpine
- **Port:** 5173
- **Purpose:** React application (production build served via Serve)
- **Build:** Multi-stage build for optimized image size

### Backend Container
- **Image:** Node.js 20 Alpine
- **Port:** 3000
- **Purpose:** Express.js API server
- **TypeScript:** Compiled to JavaScript before runtime
- **Health Check:** Every 30 seconds

### MongoDB Container
- **Image:** Mongo 7.0 Official
- **Port:** 27017
- **Storage:** Named volume `mongodb_data` (persists data)
- **Authentication:** Admin user configured via ENV
- **Health Check:** Database connectivity check

## File Structure

```
Social-Media/
├── client/
│   ├── Dockerfile          # Frontend container definition
│   ├── .dockerignore       # Excludes files from Docker build
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── Dockerfile          # Backend container definition
│   ├── .dockerignore       # Excludes files from Docker build
│   ├── server.ts           # Entry point
│   ├── package.json
│   └── config/db.ts
├── docker-compose.yml      # Docker Compose configuration
├── .env.example            # Environment template
└── DOCKER_SETUP.md         # This file
```

## Common Commands

### Start All Services
```bash
docker compose up --build -d
```

### Stop All Services
```bash
docker compose down
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
```

### Rebuild Specific Service
```bash
docker compose build backend --no-cache
docker compose up -d backend
```

### Access Container Shell
```bash
docker compose exec backend sh
docker compose exec frontend sh
docker compose exec mongodb mongosh
```

### Remove All Volumes (Reset Database)
```bash
docker compose down -v
```

## Troubleshooting

### Issue: "Connection refused" on Backend

**Cause:** MongoDB is not ready  
**Solution:** MongoDB has a health check. Wait 10-15 seconds for full startup.

```bash
docker compose logs mongodb
```

### Issue: Frontend shows "Cannot reach backend"

**Cause:** CORS or network issue  
**Solution:** 
1. Check FRONTEND_URL in .env matches actual frontend URL
2. Verify backend is running: `docker compose logs backend`

### Issue: MongoDB data lost after restart

**Cause:** Volume not properly configured  
**Solution:** Check volume exists:

```bash
docker volume ls | grep mongodb_data
```

### Issue: "Address already in use" error

**Cause:** Port already bound on host machine  
**Solution:** Change ports in docker-compose.yml or stop conflicting service:

```bash
# Find process on port
lsof -i :3000
# Kill process or change Docker port mapping
```

### Issue: OAuth redirects not working in Docker

**Cause:** BACKEND_URL points to localhost  
**Solution:** For production, set BACKEND_URL to your public domain:

```env
BACKEND_URL=https://yourdomain.com
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/facebook/callback
INSTAGRAM_REDIRECT_URI=https://yourdomain.com/api/instagram/callback
```

## Environment Variables Reference

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| MONGODB_USERNAME | Yes | admin | MongoDB user |
| MONGODB_PASSWORD | Yes | - | MongoDB password |
| MONGODB_DB_NAME | No | social_scheduler | Database name |
| GEMINI_API_KEY | Yes | - | Google Gemini API key |
| POLLINATIONS_API_KEY | Yes | - | Image generation API |
| META_APP_ID | Yes | - | Facebook App ID |
| META_APP_SECRET | Yes | - | Facebook App Secret |
| FRONTEND_URL | No | http://localhost:5173 | Frontend origin |
| VITE_API_URL | No | http://localhost:3000 | API endpoint |
| SOCIAL_TOKEN_ENCRYPTION_KEY | Yes | - | Encryption key (32+ chars) |

## Database Persistence

MongoDB data persists in the `mongodb_data` volume. This survives:
- Container restarts
- docker compose restart
- docker compose down (volume remains)

Only removed with `docker compose down -v`.

## Production Deployment

For production, update `.env`:

```env
# Use strong password
MONGODB_PASSWORD=your_very_secure_password_min_16_chars

# Use production domains
FRONTEND_URL=https://yourdomain.com
VITE_API_URL=https://yourdomain.com/api
BACKEND_URL=https://yourdomain.com

# Update OAuth redirects
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/facebook/callback
INSTAGRAM_REDIRECT_URI=https://yourdomain.com/api/instagram/callback

# Generate secure encryption key
SOCIAL_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

Then deploy:
```bash
docker compose up --build -d
```

## Performance Notes

- **Frontend:** Served via Nginx-like Serve (optimized production build)
- **Backend:** Uses Node.js Alpine image (lightweight)
- **MongoDB:** Official MongoDB image (production-ready)
- **Network:** Internal Docker network (no external ports exposed except mapped ones)

## Support

For issues, check:
1. Container logs: `docker compose logs`
2. Environment variables: Check `.env` is correct
3. Port conflicts: Verify ports 3000, 5173, 27017 are available
4. Database: Verify MongoDB container is healthy
