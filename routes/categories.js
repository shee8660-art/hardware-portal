const express = require('express');
const { db, logActivity } = require('../models/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all categories
router.get('/asset-categories', requireAuth, (req, res) => {
    db.all('SELECT * FROM asset_categories ORDER BY category_name', (err, rows) => {
        res.json(rows || []);
    });
});

// Add category
router.post('/asset-categories', requireAdmin, (req, res) => {
    const { category_name } = req.body;
    
    db.run(`INSERT INTO asset_categories (category_name, created_by) VALUES (?, ?)`,
        [category_name, req.session.userId],
        function(err) {
            if (err) {
                res.json({ success: false, error: err.message });
            } else {
                logActivity(req.session.userId, 'ADD_CATEGORY', `Added category: ${category_name}`);
                res.json({ success: true });
            }
        });
});

// Delete category
router.delete('/asset-categories/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM asset_categories WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.json({ success: false });
        } else {
            res.json({ success: true });
        }
    });
});

module.exports = router;