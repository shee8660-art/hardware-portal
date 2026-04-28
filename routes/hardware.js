const express = require('express');
const { db, query, get, run, logActivity, isProduction } = require('../models/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper function for database operations
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

// Generate ticket number
function generateTicketNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TKT-${year}${month}${day}-${random}`;
}

// Create hardware request
router.post('/hardware-requests', requireAuth, async (req, res) => {
    const {
        ticket_no, branch_code, branch_name, date_reported, asset_category, brand, model,
        serial_number, hardware_age, status, description, remarks, trf_number
    } = req.body;
    
    try {
        // Check if ticket exists
        if (ticket_no && ticket_no.trim() !== '') {
            const existing = await executeGet(
                isProduction ? 'SELECT id FROM hardware_requests WHERE ticket_no = $1' : 'SELECT id FROM hardware_requests WHERE ticket_no = ?',
                [ticket_no]
            );
            if (existing) {
                return res.json({ success: false, error: 'Ticket number already exists. Please use a different ticket number.' });
            }
        }
        
        const finalTicketNo = (ticket_no && ticket_no.trim() !== '') ? ticket_no : generateTicketNo();
        const reportedDate = date_reported || new Date().toISOString();
        
        const insertSql = isProduction ?
            `INSERT INTO hardware_requests (
                ticket_no, user_id, branch_code, branch_name, date_reported,
                asset_category, brand, model, serial_number, hardware_age, status, description, remarks, trf_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)` :
            `INSERT INTO hardware_requests (
                ticket_no, user_id, branch_code, branch_name, date_reported,
                asset_category, brand, model, serial_number, hardware_age, status, description, remarks, trf_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        await executeRun(insertSql, [
            finalTicketNo, req.session.userId, branch_code, branch_name, reportedDate,
            asset_category, brand, model, serial_number, hardware_age, status || 'For DM Approval', 
            description || '', remarks || 'Pending', trf_number || ''
        ]);
        
        await logActivity(req.session.userId, 'CREATE_REQUEST', `Created request: ${finalTicketNo}`);
        res.json({ success: true, ticket_no: finalTicketNo });
    } catch (err) {
        console.error('Error creating request:', err);
        res.json({ success: false, error: err.message });
    }
});

// Get all hardware requests (with role-based filtering)
router.get('/hardware-requests', requireAuth, async (req, res) => {
    try {
        let sql = `
            SELECT r.*, u.username, u.fullname 
            FROM hardware_requests r
            JOIN users u ON r.user_id = u.id
        `;
        let params = [];
        let conditionAdded = false;
        
        if (req.session.userRole === 'bit') {
            sql += isProduction ? ' WHERE r.branch_code = $1' : ' WHERE r.branch_code = ?';
            params = [req.session.branchCode];
            conditionAdded = true;
        } else if (req.session.userRole === 'dit') {
            const user = await executeGet(
                isProduction ? 'SELECT assigned_branches FROM users WHERE id = $1' : 'SELECT assigned_branches FROM users WHERE id = ?',
                [req.session.userId]
            );
            
            if (user && user.assigned_branches) {
                try {
                    const assignedBranches = JSON.parse(user.assigned_branches);
                    const branchCodes = assignedBranches.map(b => b.branch_code);
                    if (branchCodes.length > 0) {
                        const placeholders = branchCodes.map((_, i) => isProduction ? `$${i + 1}` : '?').join(',');
                        sql += ` WHERE r.branch_code IN (${placeholders})`;
                        params = branchCodes;
                        conditionAdded = true;
                    }
                } catch(e) {
                    console.error('Error parsing assigned_branches:', e);
                }
            }
        }
        
        sql += ' ORDER BY r.created_at DESC';
        const rows = await executeQuery(sql, params);
        res.json(rows || []);
    } catch (err) {
        console.error('Error fetching requests:', err);
        res.json([]);
    }
});

// Update hardware request (Admin only)
router.put('/hardware-requests/:id', requireAdmin, async (req, res) => {
    const requestId = req.params.id;
    const {
        branch_code, branch_name, asset_category, brand, model,
        serial_number, hardware_age, status, remarks, description, date_reported, trf_number
    } = req.body;
    
    try {
        // Check if request already has a grade
        const request = await executeGet(
            isProduction ? 'SELECT average_grade FROM hardware_requests WHERE id = $1' : 'SELECT average_grade FROM hardware_requests WHERE id = ?',
            [requestId]
        );
        
        if (request && request.average_grade !== null) {
            return res.json({ success: false, error: 'Cannot edit a graded request' });
        }
        
        if (status === 'For Store Transfer' && (!trf_number || trf_number.trim() === '')) {
            return res.json({ success: false, error: 'TRF # is required when status is For Store Transfer' });
        }
        
        const updateSql = isProduction ?
            `UPDATE hardware_requests SET 
                branch_code = $1, branch_name = $2, asset_category = $3, brand = $4,
                model = $5, serial_number = $6, hardware_age = $7, status = $8,
                remarks = $9, description = $10, date_reported = $11, trf_number = $12
                WHERE id = $13` :
            `UPDATE hardware_requests SET 
                branch_code = ?, branch_name = ?, asset_category = ?, brand = ?,
                model = ?, serial_number = ?, hardware_age = ?, status = ?,
                remarks = ?, description = ?, date_reported = ?, trf_number = ?
                WHERE id = ?`;
        
        await executeRun(updateSql, [
            branch_code, branch_name, asset_category, brand, model,
            serial_number, hardware_age, status, remarks, description, date_reported, trf_number || '', requestId
        ]);
        
        await logActivity(req.session.userId, 'UPDATE_REQUEST', `Updated request ID: ${requestId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating request:', err);
        res.json({ success: false, error: err.message });
    }
});

// Mark as received
router.put('/hardware-requests/:id/received', requireAuth, async (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('photo')(req, res, async (err) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        
        const requestId = req.params.id;
        const { branch_code } = req.body;
        let photoPath = null;
        
        if (req.file) {
            photoPath = '/uploads/' + req.file.filename;
        }
        
        try {
            // Verify permissions
            if (req.session.userRole === 'bit') {
                const request = await executeGet(
                    isProduction ? 'SELECT branch_code FROM hardware_requests WHERE id = $1' : 'SELECT branch_code FROM hardware_requests WHERE id = ?',
                    [requestId]
                );
                if (!request || request.branch_code !== req.session.branchCode) {
                    return res.status(403).json({ success: false, error: 'Permission denied' });
                }
            } else if (req.session.userRole === 'dit') {
                const user = await executeGet(
                    isProduction ? 'SELECT assigned_branches FROM users WHERE id = $1' : 'SELECT assigned_branches FROM users WHERE id = ?',
                    [req.session.userId]
                );
                if (user && user.assigned_branches) {
                    const assignedBranches = JSON.parse(user.assigned_branches);
                    const branchCodes = assignedBranches.map(b => b.branch_code);
                    const request = await executeGet(
                        isProduction ? 'SELECT branch_code FROM hardware_requests WHERE id = $1' : 'SELECT branch_code FROM hardware_requests WHERE id = ?',
                        [requestId]
                    );
                    if (!request || !branchCodes.includes(request.branch_code)) {
                        return res.status(403).json({ success: false, error: 'Permission denied' });
                    }
                }
            }
            
            let updateSql = `UPDATE hardware_requests SET status = 'Received on Store', received_date = CURRENT_TIMESTAMP`;
            let params = [];
            
            if (photoPath) {
                updateSql += `, received_photo = ${isProduction ? '$1' : '?'}`;
                params.push(photoPath);
            }
            
            if (branch_code && req.session.userRole === 'dit') {
                updateSql += `, branch_code = ${isProduction ? `$${params.length + 1}` : '?'}`;
                params.push(branch_code);
                
                const branch = await executeGet(
                    isProduction ? 'SELECT branch_name FROM users WHERE branch_code = $1' : 'SELECT branch_name FROM users WHERE branch_code = ?',
                    [branch_code]
                );
                if (branch && branch.branch_name) {
                    updateSql += `, branch_name = ${isProduction ? `$${params.length + 1}` : '?'}`;
                    params.push(branch.branch_name);
                }
            }
            
            updateSql += ` WHERE id = ${isProduction ? `$${params.length + 1}` : '?'}`;
            params.push(requestId);
            
            await executeRun(updateSql, params);
            await logActivity(req.session.userId, 'RECEIVE_REQUEST', `Received request ID: ${requestId}`);
            res.json({ success: true, photo: photoPath });
        } catch (error) {
            console.error('Error in receive:', error);
            res.json({ success: false, error: error.message });
        }
    });
});

// Deploy hardware
router.post('/hardware-requests/:id/deploy', requireAuth, async (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('deployment_photo')(req, res, async (err) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        
        const requestId = req.params.id;
        const { branch_code, branch_name, brand, model, serial_number, deployment_date } = req.body;
        let photoPath = null;
        
        if (req.file) {
            photoPath = '/uploads/' + req.file.filename;
        }
        
        try {
            // Verify permissions
            if (req.session.userRole === 'bit') {
                const request = await executeGet(
                    isProduction ? 'SELECT branch_code FROM hardware_requests WHERE id = $1' : 'SELECT branch_code FROM hardware_requests WHERE id = ?',
                    [requestId]
                );
                if (!request || request.branch_code !== req.session.branchCode) {
                    return res.status(403).json({ success: false, error: 'Permission denied' });
                }
            } else if (req.session.userRole === 'dit') {
                const user = await executeGet(
                    isProduction ? 'SELECT assigned_branches FROM users WHERE id = $1' : 'SELECT assigned_branches FROM users WHERE id = ?',
                    [req.session.userId]
                );
                if (user && user.assigned_branches) {
                    const assignedBranches = JSON.parse(user.assigned_branches);
                    const branchCodes = assignedBranches.map(b => b.branch_code);
                    const request = await executeGet(
                        isProduction ? 'SELECT branch_code FROM hardware_requests WHERE id = $1' : 'SELECT branch_code FROM hardware_requests WHERE id = ?',
                        [requestId]
                    );
                    if (!request || !branchCodes.includes(request.branch_code)) {
                        return res.status(403).json({ success: false, error: 'Permission denied' });
                    }
                }
            }
            
            const deploySql = isProduction ?
                `UPDATE hardware_requests SET 
                    status = 'Deployed on Store', deployed_date = $1, deployed_branch_code = $2,
                    deployed_branch_name = $3, brand = COALESCE($4, brand), model = COALESCE($5, model),
                    serial_number = COALESCE($6, serial_number), execution_photo = $7, deployed_at = CURRENT_TIMESTAMP
                    WHERE id = $8` :
                `UPDATE hardware_requests SET 
                    status = 'Deployed on Store', deployed_date = ?, deployed_branch_code = ?,
                    deployed_branch_name = ?, brand = COALESCE(?, brand), model = COALESCE(?, model),
                    serial_number = COALESCE(?, serial_number), execution_photo = ?, deployed_at = CURRENT_TIMESTAMP
                    WHERE id = ?`;
            
            await executeRun(deploySql, [
                deployment_date || new Date().toISOString(), branch_code, branch_name,
                brand, model, serial_number, photoPath, requestId
            ]);
            
            // Insert into deployed_units
            const insertDeployedSql = isProduction ?
                `INSERT INTO deployed_units (request_id, ticket_no, branch_code, branch_name, brand, model, serial_number, deployment_date, deployment_photo, deployed_by)
                 SELECT $1, ticket_no, $2, $3, $4, $5, $6, $7, $8, $9 FROM hardware_requests WHERE id = $10` :
                `INSERT INTO deployed_units (request_id, ticket_no, branch_code, branch_name, brand, model, serial_number, deployment_date, deployment_photo, deployed_by)
                 SELECT ?, ticket_no, ?, ?, ?, ?, ?, ?, ?, ? FROM hardware_requests WHERE id = ?`;
            
            await executeRun(insertDeployedSql, [
                requestId, branch_code, branch_name, brand, model, serial_number,
                deployment_date, photoPath, req.session.userId, requestId
            ]);
            
            await logActivity(req.session.userId, 'DEPLOY_REQUEST', `Deployed request ID: ${requestId}`);
            res.json({ success: true, photo: photoPath });
        } catch (error) {
            console.error('Error deploying:', error);
            res.json({ success: false, error: error.message });
        }
    });
});

// Get deployed units
router.get('/deployed-units', requireAuth, async (req, res) => {
    try {
        const sql = `
            SELECT d.*, u.username as deployed_by_name
            FROM deployed_units d
            JOIN users u ON d.deployed_by = u.id
            ORDER BY d.deployment_date DESC
        `;
        const rows = await executeQuery(sql, []);
        res.json(rows || []);
    } catch (err) {
        console.error('Error fetching deployed units:', err);
        res.json([]);
    }
});

// Get DIT branches
router.get('/dit-branches', requireAuth, async (req, res) => {
    if (req.session.userRole !== 'dit') {
        return res.json([]);
    }
    
    try {
        const user = await executeGet(
            isProduction ? 'SELECT assigned_branches FROM users WHERE id = $1' : 'SELECT assigned_branches FROM users WHERE id = ?',
            [req.session.userId]
        );
        if (user && user.assigned_branches) {
            const assignedBranches = JSON.parse(user.assigned_branches);
            res.json(assignedBranches);
        } else {
            res.json([]);
        }
    } catch(e) {
        res.json([]);
    }
});

// Get reports
router.get('/reports/delivered', requireAuth, async (req, res) => {
    if (req.session.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { period } = req.query;
    
    let dateCondition = '';
    switch(period) {
        case 'week':
            dateCondition = isProduction ? 
                "approved_at >= NOW() - INTERVAL '7 days'" : 
                "datetime(approved_at) >= datetime('now', '-7 days')";
            break;
        case 'month':
            dateCondition = isProduction ?
                "approved_at >= NOW() - INTERVAL '30 days'" :
                "datetime(approved_at) >= datetime('now', '-30 days')";
            break;
        case 'sem':
            dateCondition = isProduction ?
                "approved_at >= NOW() - INTERVAL '180 days'" :
                "datetime(approved_at) >= datetime('now', '-180 days')";
            break;
        default:
            dateCondition = "1=1";
    }
    
    const sql = `
        SELECT r.*, u.username, u.fullname, u.branch_code, u.branch_name
        FROM hardware_requests r
        JOIN users u ON r.user_id = u.id
        WHERE ${dateCondition} AND r.status = 'Deployed on Store'
        ORDER BY r.approved_at DESC
    `;
    
    try {
        const rows = await executeQuery(sql, []);
        res.json(rows || []);
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.json([]);
    }
});

// Add grade to deployed unit
router.post('/deployed-units/:id/grade', requireAdmin, async (req, res) => {
    const unitId = req.params.id;
    const { timeliness_grade, deployment_grade, comment } = req.body;
    
    if (timeliness_grade < 1 || timeliness_grade > 100 || deployment_grade < 1 || deployment_grade > 100) {
        return res.status(400).json({ success: false, error: 'Grades must be between 1 and 100' });
    }
    
    if (!comment || comment.trim() === '') {
        return res.status(400).json({ success: false, error: 'Comment is required before grading' });
    }
    
    const average_grade = (timeliness_grade + deployment_grade) / 2;
    
    try {
        const updateDeployedSql = isProduction ?
            `UPDATE deployed_units SET timeliness_grade = $1, deployment_grade = $2, average_grade = $3, grade_comment = $4 WHERE id = $5` :
            `UPDATE deployed_units SET timeliness_grade = ?, deployment_grade = ?, average_grade = ?, grade_comment = ? WHERE id = ?`;
        
        await executeRun(updateDeployedSql, [timeliness_grade, deployment_grade, average_grade, comment, unitId]);
        
        const updateRequestSql = isProduction ?
            `UPDATE hardware_requests SET timeliness_grade = $1, deployment_grade = $2, average_grade = $3, grade_comment = $4
             WHERE id = (SELECT request_id FROM deployed_units WHERE id = $5)` :
            `UPDATE hardware_requests SET timeliness_grade = ?, deployment_grade = ?, average_grade = ?, grade_comment = ?
             WHERE id = (SELECT request_id FROM deployed_units WHERE id = ?)`;
        
        await executeRun(updateRequestSql, [timeliness_grade, deployment_grade, average_grade, comment, unitId]);
        await logActivity(req.session.userId, 'ADD_GRADE', `Added grade to deployed unit ID: ${unitId}`);
        res.json({ success: true, average_grade: average_grade });
    } catch (err) {
        console.error('Error updating grade:', err);
        res.json({ success: false, error: err.message });
    }
});

// Get BIT user statistics
router.get('/bit-stats', requireAuth, async (req, res) => {
    if (req.session.userRole !== 'bit') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const userId = req.session.userId;
    
    try {
        const sql = isProduction ?
            `SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'Deployed on Store' THEN 1 ELSE 0 END) as completed,
                AVG(CASE WHEN average_grade IS NOT NULL THEN average_grade ELSE NULL END) as average_grade
                FROM hardware_requests WHERE user_id = $1` :
            `SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'Deployed on Store' THEN 1 ELSE 0 END) as completed,
                AVG(CASE WHEN average_grade IS NOT NULL THEN average_grade ELSE NULL END) as average_grade
                FROM hardware_requests WHERE user_id = ?`;
        
        const stats = await executeQuery(sql, [userId]);
        res.json(stats[0] || { total_requests: 0, completed: 0, average_grade: null });
    } catch (err) {
        console.error('Error fetching bit stats:', err);
        res.json({ error: err.message });
    }
});

module.exports = router;