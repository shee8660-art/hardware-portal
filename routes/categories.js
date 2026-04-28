const express = require('express');
const { db, query, run, logActivity, isProduction } = require('../models/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

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

// Get all categories
router.get('/asset-categories', requireAuth, async (req, res) => {
    try {
        const rows = await executeQuery('SELECT * FROM asset_categories ORDER BY category_name', []);
        res.json(rows || []);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.json([]);
    }
});

// Add category
router.post('/asset-categories', requireAdmin, async (req, res) => {
    const { category_name } = req.body;
    
    if (!category_name || category_name.trim() === '') {
        return res.json({ success: false, error: 'Category name is required' });
    }
    
    try {
        const insertSql = isProduction ?
            `INSERT INTO asset_categories (category_name, created_by) VALUES ($1, $2)` :
            `INSERT INTO asset_categories (category_name, created_by) VALUES (?, ?)`;
        
        await executeRun(insertSql, [category_name, req.session.userId]);
        await logActivity(req.session.userId, 'ADD_CATEGORY', `Added category: ${category_name}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding category:', err);
        res.json({ success: false, error: err.message });
    }
});

// Delete category
router.delete('/asset-categories/:id', requireAdmin, async (req, res) => {
    const categoryId = req.params.id;
    
    try {
        const deleteSql = isProduction ?
            'DELETE FROM asset_categories WHERE id = $1' :
            'DELETE FROM asset_categories WHERE id = ?';
        
        const result = await executeRun(deleteSql, [categoryId]);
        
        if (result.changes > 0) {
            await logActivity(req.session.userId, 'DELETE_CATEGORY', `Deleted category ID: ${categoryId}`);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Category not found' });
        }
    } catch (err) {
        console.error('Error deleting category:', err);
        res.json({ success: false, error: err.message });
    }
});

module.exports = router;