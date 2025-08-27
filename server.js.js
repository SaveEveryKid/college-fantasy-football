// 🏈 COLLEGE FANTASY FOOTBALL 2025 - COMPLETE SERVER
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Configuration
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'college_fantasy_football_2025_secret_key';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Database initialization
const db = new sqlite3.Database('./data/fantasy_football.db', (err) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        // Create data directory if it doesn't exist
        require('fs').mkdirSync('./data', { recursive: true });
        // Try again
        const db2 = new sqlite3.Database('./data/fantasy_football.db', (err2) => {
            if (err2) {
                console.error('❌ Database creation failed:', err2);
                process.exit(1);
            } else {
                console.log('✅ Database created and connected');
                initializeDatabase();
            }
        });
    } else {
        console.log('✅ Database connected');
        initializeDatabase();
    }
});

// Global state
const connectedUsers = new Map();

function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            team_name TEXT NOT NULL,
            favorite_college_team TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Players table
        db.run(`CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            position TEXT NOT NULL,
            team TEXT NOT NULL,
            conference TEXT NOT NULL,
            projected_ppg REAL DEFAULT 0,
            season_points REAL DEFAULT 0,
            week_points REAL DEFAULT 0,
            tier TEXT DEFAULT 'Solid',
            injury_status TEXT DEFAULT 'Healthy',
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Fantasy teams table
        db.run(`CREATE TABLE IF NOT EXISTS fantasy_teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            points_for REAL DEFAULT 0,
            points_against REAL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Roster table
        db.run(`CREATE TABLE IF NOT EXISTS roster (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fantasy_team_id INTEGER,
            player_id INTEGER,
            position_slot TEXT,
            is_starting BOOLEAN DEFAULT 0,
            FOREIGN KEY (fantasy_team_id) REFERENCES fantasy_teams (id),
            FOREIGN KEY (player_id) REFERENCES players (id)
        )`);

        // Trades table
        db.run(`CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_team_id INTEGER,
            to_team_id INTEGER,
            from_players TEXT,
            to_players TEXT,
            status TEXT DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);