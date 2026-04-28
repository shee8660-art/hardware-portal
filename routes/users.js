const express = require('express');
const bcrypt = require('bcryptjs');
const { db, query, get, run, logActivity, isProduction } = require('../models/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper functions
async function executeQuery(sql, params = []) {
    if (isProduction) {
        const result = await query(sql, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

async function executeRun(sql, params = []) {
    if (isProduction) {
        const result = await run(sql, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
}

async function executeGet(sql, params = []) {
    if (isProduction) {
        const result = await get(sql, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

// ========== PROFILE UPDATE ==========
router.put('/users/profile', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { fullname, email, currentPassword, newPassword } = req.body;
    
    console.log(`Profile update request for user ID: ${userId}, Role: ${req.session.userRole}`);
    
    try {
        // First verify current password
        const user = await executeGet(
            isProduction ? 'SELECT * FROM users WHERE id = $1' : 'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Verify current password
        const isValid = bcrypt.compareSync(currentPassword, user.password);
        if (!isValid) {
            console.log('Current password is incorrect');
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }
        
        // Build update query
        let updateQuery = isProduction ? 
            'UPDATE users SET fullname = $1, email = $2' :
            'UPDATE users SET fullname = ?, email = ?';
        let params = [fullname || '', email || ''];
        let paramCounter = 3;
        
        if (newPassword && newPassword.trim() !== '') {
            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
            }
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
            if (hasSpecialChar) {
                return res.status(400).json({ success: false, error: 'Password cannot contain special characters' });
            }
            const hashedPassword = bcrypt.hashSync(newPassword, 10);
            updateQuery += isProduction ? `, password = $${paramCounter}` : ', password = ?';
            params.push(hashedPassword);
            paramCounter++;
        }
        
        updateQuery += isProduction ? ` WHERE id = $${paramCounter}` : ' WHERE id = ?';
        params.push(userId);
        
        await executeRun(updateQuery, params);
        
        // Get updated user info
        const updatedUser = await executeGet(
            isProduction ? 
                'SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches FROM users WHERE id = $1' :
                'SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches FROM users WHERE id = ?',
            [userId]
        );
        
        await logActivity(req.session.userId, 'UPDATE_PROFILE', `Updated profile`);
        console.log('Profile updated successfully for user:', updatedUser.username);
        res.json({ success: true, user: updatedUser });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========== ADMIN ONLY ROUTES ==========

// Get all users (Admin only)
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const sql = 'SELECT id, username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id, created_at FROM users ORDER BY created_at DESC';
        const users = await executeQuery(sql, []);
        res.json(users || []);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: err.message });
    }
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
    
    try {
        const insertSql = isProduction ?
            `INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)` :
            `INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const result = await executeRun(insertSql, [
            username.toLowerCase(), hashedPassword, role, fullname || '', email || '',
            branch_code || '', branch_name || '', district || '', assigned_branches || '', wms_id || ''
        ]);
        
        await logActivity(req.session.userId, 'CREATE_USER', `Created user: ${username}`);
        res.json({ success: true, id: isProduction ? result.lastID : result.lastID });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ success: false, error: err.message.includes('UNIQUE') ? 'Username already exists' : err.message });
    }
});

// Update user (Admin only)
router.put('/users/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { username, role, fullname, email, branch_code, branch_name, district, assigned_branches, wms_id, password } = req.body;
    
    try {
        const user = await executeGet(
            isProduction ? 'SELECT * FROM users WHERE id = $1' : 'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        let updateQuery = isProduction ?
            `UPDATE users SET username = $1, role = $2, fullname = $3, email = $4, branch_code = $5, branch_name = $6, district = $7, assigned_branches = $8, wms_id = $9` :
            `UPDATE users SET username = ?, role = ?, fullname = ?, email = ?, branch_code = ?, branch_name = ?, district = ?, assigned_branches = ?, wms_id = ?`;
        
        let params = [username.toLowerCase(), role, fullname || '', email || '', branch_code || '', branch_name || '', district || '', assigned_branches || '', wms_id || ''];
        let paramCounter = isProduction ? 10 : 10;
        
        if (password && password.trim() !== '') {
            if (password.length < 8) {
                return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
            }
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
            if (hasSpecialChar) {
                return res.status(400).json({ success: false, error: 'Password cannot contain special characters' });
            }
            const hashedPassword = bcrypt.hashSync(password, 10);
            updateQuery += isProduction ? `, password = $${paramCounter}` : ', password = ?';
            params.push(hashedPassword);
            paramCounter++;
        }
        
        updateQuery += isProduction ? ` WHERE id = $${paramCounter}` : ' WHERE id = ?';
        params.push(userId);
        
        await executeRun(updateQuery, params);
        await logActivity(req.session.userId, 'UPDATE_USER', `Updated user ID: ${userId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete user (Admin only)
router.delete('/users/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    
    if (parseInt(userId) === req.session.userId) {
        return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    
    try {
        const user = await executeGet(
            isProduction ? 'SELECT * FROM users WHERE id = $1' : 'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        await executeRun(
            isProduction ? 'DELETE FROM users WHERE id = $1' : 'DELETE FROM users WHERE id = ?',
            [userId]
        );
        
        await logActivity(req.session.userId, 'DELETE_USER', `Deleted user ID: ${userId} (${user.username})`);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;