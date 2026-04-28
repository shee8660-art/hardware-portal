const express = require('express');
const bcrypt = require('bcrypt');
const { db, logActivity } = require('../models/database');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log(`Login attempt: ${username}`);
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.json({ success: false, message: 'Database error' });
        }
        
        if (!user) {
            console.log(`User not found: ${username}`);
            return res.json({ success: false, message: 'User not found' });
        }
        
        console.log(`User found: ${username}, role: ${user.role}`);
        
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('Password comparison error:', err);
                return res.json({ success: false, message: 'Error verifying password' });
            }
            
            if (result) {
                req.session.userId = user.id;
                req.session.userRole = user.role;
                req.session.username = user.username;
                req.session.branchCode = user.branch_code;
                req.session.branchName = user.branch_name;
                logActivity(user.id, 'LOGIN', 'User logged in', req.ip);
                console.log(`Login successful: ${username}`);
                res.json({ success: true, role: user.role });
            } else {
                console.log(`Invalid password for: ${username}`);
                res.json({ success: false, message: 'Invalid password' });
            }
        });
    });
});

// Get current user
router.get('/user', (req, res) => {
    if (!req.session.userId) {
        return res.json({ loggedIn: false });
    }
    
    db.get('SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id FROM users WHERE id = ?', 
        [req.session.userId], (err, user) => {
            if (err) {
                console.error('Error fetching user:', err);
                return res.json({ loggedIn: false });
            }
            res.json({ loggedIn: true, user });
        });
});

// Get statistics
router.get('/stats', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const stats = {};
    
    db.get('SELECT COUNT(*) as total FROM hardware_requests', (err, row) => {
        stats.total = row ? row.total : 0;
        db.get("SELECT COUNT(*) as pending FROM hardware_requests WHERE status = 'For DM Approval'", (err, row) => {
            stats.pending = row ? row.pending : 0;
            db.get("SELECT COUNT(*) as approved FROM hardware_requests WHERE status = 'Deployed on Store'", (err, row) => {
                stats.approved = row ? row.approved : 0;
                db.get("SELECT COUNT(*) as received FROM hardware_requests WHERE status = 'Received on Store'", (err, row) => {
                    stats.received = row ? row.received : 0;
                    db.get("SELECT COUNT(*) as highUrgency FROM hardware_requests WHERE status = 'For DM Approval'", (err, row) => {
                        stats.highUrgency = row ? row.highUrgency : 0;
                        res.json(stats);
                    });
                });
            });
        });
    });
});

module.exports = router;