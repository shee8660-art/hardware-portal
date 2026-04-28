const express = require('express');
const bcrypt = require('bcryptjs');
const { query, logActivity, isProduction } = require('../models/database');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log(`Login attempt: ${username}`);
    
    try {
        // Query user from database using PostgreSQL syntax
        const users = await query('SELECT * FROM users WHERE username = $1', [username]);
        const user = users[0];
        
        if (!user) {
            console.log(`User not found: ${username}`);
            return res.json({ success: false, message: 'User not found' });
        }
        
        console.log(`User found: ${username}, role: ${user.role}`);
        
        // Compare password using bcryptjs
        const validPassword = bcrypt.compareSync(password, user.password);
        
        if (validPassword) {
            // Set session variables
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.username = user.username;
            req.session.branchCode = user.branch_code;
            req.session.branchName = user.branch_name;
            
            // Log activity
            await logActivity(user.id, 'LOGIN', 'User logged in', req.ip);
            
            console.log(`Login successful: ${username}`);
            
            // Return success response with role
            return res.json({ 
                success: true, 
                role: user.role,
                message: 'Login successful'
            });
        } else {
            console.log(`Invalid password for: ${username}`);
            return res.json({ success: false, message: 'Invalid password' });
        }
    } catch (err) {
        console.error('Database error during login:', err);
        return res.json({ success: false, message: 'Database error. Please try again.' });
    }
});

// Get current user
router.get('/user', async (req, res) => {
    if (!req.session.userId) {
        return res.json({ loggedIn: false });
    }
    
    try {
        const users = await query(
            'SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id FROM users WHERE id = $1',
            [req.session.userId]
        );
        const user = users[0];
        
        if (user) {
            res.json({ loggedIn: true, user });
        } else {
            res.json({ loggedIn: false });
        }
    } catch (err) {
        console.error('Error fetching user:', err);
        res.json({ loggedIn: false });
    }
});

// Get statistics for dashboard
router.get('/stats', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        // Get total requests
        const totalResult = await query('SELECT COUNT(*) as count FROM hardware_requests');
        const total = parseInt(totalResult[0]?.count || 0);
        
        // Get pending requests
        const pendingResult = await query("SELECT COUNT(*) as count FROM hardware_requests WHERE status = 'For DM Approval'");
        const pending = parseInt(pendingResult[0]?.count || 0);
        
        // Get approved/deployed requests
        const approvedResult = await query("SELECT COUNT(*) as count FROM hardware_requests WHERE status = 'Deployed on Store'");
        const approved = parseInt(approvedResult[0]?.count || 0);
        
        // Get received requests
        const receivedResult = await query("SELECT COUNT(*) as count FROM hardware_requests WHERE status = 'Received on Store'");
        const received = parseInt(receivedResult[0]?.count || 0);
        
        res.json({
            total,
            pending,
            approved,
            received,
            highUrgency: pending // Using pending as high urgency for now
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

module.exports = router;