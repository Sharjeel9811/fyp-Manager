# FYP Manager - Setup and Deployment Guide

## Quick Start

### Backend
`ash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
`

### Frontend
`ash
cd frontend
npm install
npm run dev
`

## Default Login Credentials
- **Admin**: admin@fypmanager.com / password123
- **Supervisor**: supervisor@fypmanager.com / password123
- **Student**: student@fypmanager.com / password123

## Features Implemented
- User Authentication (Register, Login, Email Verification)
- Role-based Dashboards (Student, Supervisor, Admin)
- Project Proposal Management
- Milestone Tracking
- Project Health Monitor (Rule-based risk assessment)
- Admin Management Tools
- RESTful API with proper authorization

## Project Health Monitor Algorithm
Scoring rules:
- Overdue milestones: +20 per milestone
- No updates in 14+ days: +10
- 3+ revision requests: +15
- Risk levels: LOW (0-24), MEDIUM (25-49), HIGH (50+)
