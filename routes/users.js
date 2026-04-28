const express = require('express');
const bcrypt = require('bcryptjs')
const { db, logActivity } = require('../models/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ========== PROFILE UPDATE (FOR BIT/DIT USERS) - MUST BE BEFORE ADMIN ROUTES ==========
router.put('/users/profile', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { fullname, email, currentPassword, newPassword } = req.body;
    
    console.log(`Profile update request for user ID: ${userId}, Role: ${req.session.userRole}`);
    
    // First verify current password
    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user) {
            console.error('User not found:', err);
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            console.log('Current password is incorrect');
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }
        
        // Build update query
        let updateQuery = 'UPDATE users SET fullname = ?, email = ?';
        let params = [fullname || '', email || ''];
        
        if (newPassword && newPassword.trim() !== '') {
            // Validate new password
            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
            }
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
            if (hasSpecialChar) {
                return res.status(400).json({ success: false, error: 'Password cannot contain special characters' });
            }
            const hashedPassword = bcrypt.hashSync(newPassword, 10);
            updateQuery += ', password = ?';
            params.push(hashedPassword);
        }
        
        updateQuery += ' WHERE id = ?';
        params.push(userId);
        
        db.run(updateQuery, params, function(err) {
            if (err) {
                console.error('Error updating profile:', err);
                res.status(500).json({ success: false, error: err.message });
            } else {
                // Get updated user info
                db.get('SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches FROM users WHERE id = ?', [userId], (err, updatedUser) => {
                    if (err) {
                        console.error('Error fetching updated user:', err);
                        return res.json({ success: true });
                    }
                    logActivity(req.session.userId, 'UPDATE_PROFILE', `Updated profile`);
                    console.log('Profile updated successfully for user:', updatedUser.username);
                    res.json({ success: true, user: updatedUser });
                });
            }
        });
    });
});

// ========== ADMIN ONLY ROUTES ==========

// Get all users (Admin only)
router.get('/users', requireAdmin, (req, res) => {
    db.all('SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id, created_at FROM users ORDER BY created_at DESC', (err, users) => {
        if (err) {
            console.error('Error fetching users:', err);
            res.status(500).json({ error: err.message });
        } else {
            res.json(users || []);
        }
    });
});

// Create user (Admin only)
router.post('/users', requireAdmin, async (req, res) => {
    const { username, password, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id } = req.body;
    
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, error: 'Username, password, and role are required' });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }
    
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (hasSpecialChar) {
        return res.status(400).json({ success: false, error: 'Password cannot contain special characters' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username.toLowerCase(), hashedPassword, role, fullname || '', email || '', branch_code || '', branch_name || '', district || '', assigned_branches || '', wms_id || ''],
        function(err) {
            if (err) {
                console.error('Error creating user:', err);
                res.status(500).json({ success: false, error: err.message.includes('UNIQUE') ? 'Username already exists' : err.message });
            } else {
                logActivity(req.session.userId, 'CREATE_USER', `Created user: ${username}`);
                res.json({ success: true, id: this.lastID });
            }
        });
});

// Update user (Admin only)
router.put('/users/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id, password } = req.body;
    
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        let updateQuery = `UPDATE users SET username = ?, role = ?, fullname = ?, email = ?, branch_code = ?, branch_name = ?, district = ?, assigned_branches = ?, wms_id = ?`;
        let params = [username.toLowerCase(), role, fullname || '', email || '', branch_code || '', branch_name || '', district || '', assigned_branches || '', wms_id || ''];
        
        if (password && password.trim() !== '') {
            if (password.length < 8) {
                return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
            }
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
            if (hasSpecialChar) {
                return res.status(400).json({ success: false, error: 'Password cannot contain special characters' });
            }
            const hashedPassword = bcrypt.hashSync(password, 10);
            updateQuery += `, password = ?`;
            params.push(hashedPassword);
        }
        
        updateQuery += ` WHERE id = ?`;
        params.push(userId);
        
        db.run(updateQuery, params, function(err) {
            if (err) {
                console.error('Error updating user:', err);
                res.status(500).json({ success: false, error: err.message });
            } else {
                logActivity(req.session.userId, 'UPDATE_USER', `Updated user ID: ${userId}`);
                res.json({ success: true });
            }
        });
    });
});

// Delete user (Admin only)
router.delete('/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    if (parseInt(userId) === req.session.userId) {
        return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
                console.error('Error deleting user:', err);
                res.status(500).json({ success: false, error: err.message });
            } else {
                logActivity(req.session.userId, 'DELETE_USER', `Deleted user ID: ${userId} (${user.username})`);
                res.json({ success: true, message: 'User deleted successfully' });
            }
        });
    });
});

module.exports = router;