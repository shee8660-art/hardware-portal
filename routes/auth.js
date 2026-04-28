const express = require('express');
const bcrypt = require('bcryptjs');
const { db, get, run, query, logActivity, isProduction } = require('../models/database');

const router = express.Router();

// Login - Updated for async/await and PostgreSQL compatibility
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log(`Login attempt: ${username}`);
    
    try {
        let user;
        
        if (isProduction) {
            // PostgreSQL syntax (Supabase)
            const result = await query('SELECT * FROM users WHERE username = $1', [username]);
            user = result[0];
        } else {
            // SQLite syntax (development)
            user = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
        
        if (!user) {
            console.log(`User not found: ${username}`);
            return res.json({ success: false, message: 'User not found' });
        }
        
        console.log(`User found: ${username}, role: ${user.role}`);
        
        // Compare password using bcryptjs
        const result = bcrypt.compareSync(password, user.password);
        
        if (result) {
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.username = user.username;
            req.session.branchCode = user.branch_code;
            req.session.branchName = user.branch_name;
            
            // Log activity - works with both databases
            await logActivity(user.id, 'LOGIN', 'User logged in', req.ip);
            
            console.log(`Login successful: ${username}`);
            res.json({ success: true, role: user.role });
        } else {
            console.log(`Invalid password for: ${username}`);
            res.json({ success: false, message: 'Invalid password' });
        }
    } catch (err) {
        console.error('Database error during login:', err);
        res.json({ success: false, message: 'Database error' });
    }
});

// Get current user - Updated for PostgreSQL compatibility
router.get('/user', async (req, res) => {
    if (!req.session.userId) {
        return res.json({ loggedIn: false });
    }
    
    try {
        let user;
        
        if (isProduction) {
            // PostgreSQL syntax (Supabase)
            const result = await query(
                'SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id FROM users WHERE id = $1',
                [req.session.userId]
            );
            user = result[0];
        } else {
            // SQLite syntax (development)
            user = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id FROM users WHERE id = ?',
                    [req.session.userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
        
        res.json({ loggedIn: true, user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.json({ loggedIn: false });
    }
});

// Get statistics - Updated for PostgreSQL compatibility
router.get('/stats', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        let total, pending, approved, received, highUrgency;
        
        if (isProduction) {
            // PostgreSQL syntax (Supabase)
            const totalResult = await query('SELECT COUNT(*) as count FROM hardware_requests');
            total = parseInt(totalResult[0]?.count || 0);
            
            const pendingResult = await query("SELECT COUNT(*) as count FROM hardware_requests WHERE status = 'For DM Approval'");
            pending = parseInt(pendingResult[0]?.count || 0);
            
            const approvedResult = await query("SELECT COUNT(*) as count FROM hardware_requests WHERE status = 'Deployed on Store'");
            approved = parseInt(approvedResult[0]?.count || 0);
            
            const receivedResult = await query("SELECT COUNT(*) as count FROM hardware_requests WHERE status = 'Received on Store'");
            received = parseInt(receivedResult[0]?.count || 0);
            
            const highUrgencyResult = await query("SELECT COUNT(*) as count FROM hardware_requests WHERE status = 'For DM Approval'");
            highUrgency = parseInt(highUrgencyResult[0]?.count || 0);
        } else {
            // SQLite syntax (development)
            total = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as total FROM hardware_requests', (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.total : 0);
                });
            });
            
            pending = await new Promise((resolve, reject) => {
                db.get("SELECT COUNT(*) as pending FROM hardware_requests WHERE status = 'For DM Approval'", (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.pending : 0);
                });
            });
            
            approved = await new Promise((resolve, reject) => {
                db.get("SELECT COUNT(*) as approved FROM hardware_requests WHERE status = 'Deployed on Store'", (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.approved : 0);
                });
            });
            
            received = await new Promise((resolve, reject) => {
                db.get("SELECT COUNT(*) as received FROM hardware_requests WHERE status = 'Received on Store'", (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.received : 0);
                });
            });
            
            highUrgency = await new Promise((resolve, reject) => {
                db.get("SELECT COUNT(*) as highUrgency FROM hardware_requests WHERE status = 'For DM Approval'", (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.highUrgency : 0);
                });
            });
        }
        
        res.json({
            total,
            pending,
            approved,
            received,
            highUrgency
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;