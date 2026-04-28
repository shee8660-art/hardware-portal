const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Import database module (this handles both SQLite and PostgreSQL)
const { db, initDatabase, query, get, run, isProduction } = require('./models/database');

// Import routes
const authRoutes = require('./routes/auth');
const hardwareRoutes = require('./routes/hardware');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './public/uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });
app.locals.upload = upload;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// Session configuration - FIXED FOR RENDER
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000, // 1 hour
        httpOnly: true,
        sameSite: 'lax'  // Changed from 'strict' to 'lax' for better compatibility
    },
    proxy: true,  // Important for Render
    trust proxy: 1  // Trust first proxy (Render's load balancer)
}));

// Security headers
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Make db available to routes
app.use((req, res, next) => {
    req.db = db;
    req.query = query;
    req.get = get;
    req.run = run;
    next();
});

// Test endpoint to check database connection
app.get('/api/test', async (req, res) => {
    try {
        const users = await query('SELECT id, username, role FROM users LIMIT 5');
        res.json({
            success: true,
            message: 'Database connected!',
            userCount: users.length,
            users: users
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Routes
app.use('/api', authRoutes);
app.use('/api', hardwareRoutes);
app.use('/api', userRoutes);
app.use('/api', categoryRoutes);

// Page routes
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'views', 'login.html'));
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database tables and default data
        await initDatabase();
        console.log('✅ Database initialized successfully');
        
        // Start server - LISTEN ON 0.0.0.0 (CRITICAL for Render)
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${isProduction ? 'PRODUCTION (Supabase)' : 'DEVELOPMENT (SQLite)'}`);
            console.log(`📊 Default login: admin / admin123`);
            console.log(`✅ API Server Ready\n`);
        });
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    }
}

startServer();