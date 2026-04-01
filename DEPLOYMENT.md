# Deployment Guide

This project is easiest to deploy as 3 services:

1. `Client`
2. `Backend`
3. `ml-service`

Use MongoDB Atlas for the database.

## Recommended Architecture

- `Client`: static frontend on Vercel or any static host
- `Backend`: Node web service on Render, Railway, or a VPS
- `ml-service`: Python/FastAPI web service on Render, Railway, or a VPS
- `MongoDB`: Atlas cluster

## Environment Files

Copy and fill:

- [Backend/.env.example](/c:/Users/pradh/Desktop/Itinerary/Backend/.env.example)
- [Client/.env.example](/c:/Users/pradh/Desktop/Itinerary/Client/.env.example)
- [ml-service/.env.example](/c:/Users/pradh/Desktop/Itinerary/ml-service/.env.example)

## Backend

Root: `Backend`

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

Important env vars:

- `MONGO_URI`
- `JWT_SECRET`
- `ML_SERVICE_URL`
- `GOOGLE_MAPS_API_KEY`
- `CORS_ORIGIN`

Notes:

- Backend now respects `CORS_ORIGIN` as a comma-separated allowlist.
- If `CORS_ORIGIN` is empty, CORS is open.
- Startup still checks the Kerala seed path, so deploy with a populated DB instead of relying on first boot seeding.

## ML Service

Root: `ml-service`

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
python -m uvicorn app:app --host 0.0.0.0 --port $PORT
```

Important notes:

- Do not use the Windows-only npm scripts from [ml-service/package.json](/c:/Users/pradh/Desktop/Itinerary/ml-service/package.json) in production.
- Make sure these are present in deploy artifacts:
  - `models/`
  - `dataset/`
  - `dataset_expansion/`

## Client

Root: `Client`

Build command:

```bash
npm install
npm run build
```

Output directory:

```bash
dist
```

Important env vars:

- `VITE_API_BASE_URL`
- `VITE_GOOGLE_MAPS_API_KEY`

## Docker Option

Two service Dockerfiles are included:

- [Backend/Dockerfile](/c:/Users/pradh/Desktop/Itinerary/Backend/Dockerfile)
- [ml-service/Dockerfile](/c:/Users/pradh/Desktop/Itinerary/ml-service/Dockerfile)

These are useful if you want to deploy on a VPS, Coolify, or any Docker-based platform.

## Deployment Order

1. Create MongoDB Atlas cluster
2. Deploy `ml-service`
3. Deploy `Backend` with `ML_SERVICE_URL` pointing to the ML service
4. Deploy `Client` with `VITE_API_BASE_URL` pointing to the backend

## Post-Deploy Checklist

1. Open backend root route and confirm API is live
2. Open ML `/health` and confirm labels/models are loaded
3. Log in on the frontend
4. Create one curated trip
5. Create one expansion trip
6. Generate recommendations
7. Generate itinerary
8. Check maps, hotel suggestions, and auth flow

## Current Known Caveat

Local frontend builds on this machine still hit a Vite/esbuild `spawn EPERM` issue. That appears to be machine-specific, not a project architecture blocker, but it should still be verified once deployed or on a clean CI machine.
