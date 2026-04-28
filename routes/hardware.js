const express = require('express');
const { db, logActivity } = require('../models/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate ticket number
function generateTicketNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TKT-${year}${month}${day}-${random}`;
}

// Check if ticket number exists
function checkTicketExists(ticketNo, callback) {
    db.get('SELECT id FROM hardware_requests WHERE ticket_no = ?', [ticketNo], (err, row) => {
        callback(err, row);
    });
}

// Create hardware request
router.post('/hardware-requests', requireAuth, (req, res) => {
    const {
        ticket_no, branch_code, branch_name, date_reported, asset_category, brand, model,
        serial_number, hardware_age, status, description, remarks, trf_number
    } = req.body;
    
    if (ticket_no && ticket_no.trim() !== '') {
        checkTicketExists(ticket_no, (err, existing) => {
            if (err) {
                return res.json({ success: false, error: 'Database error' });
            }
            if (existing) {
                return res.json({ success: false, error: 'Ticket number already exists. Please use a different ticket number.' });
            }
            createRequest();
        });
    } else {
        createRequest();
    }
    
    function createRequest() {
        const finalTicketNo = (ticket_no && ticket_no.trim() !== '') ? ticket_no : generateTicketNo();
        const reportedDate = date_reported || new Date().toISOString();
        
        db.run(`INSERT INTO hardware_requests (
            ticket_no, user_id, branch_code, branch_name, date_reported,
            asset_category, brand, model, serial_number, hardware_age, status, description, remarks, trf_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [finalTicketNo, req.session.userId, branch_code, branch_name, reportedDate,
             asset_category, brand, model, serial_number, hardware_age, status || 'For DM Approval', description || '', remarks || 'Pending', trf_number || ''],
            function(err) {
                if (err) {
                    console.error('Error creating request:', err);
                    res.json({ success: false, error: err.message });
                } else {
                    logActivity(req.session.userId, 'CREATE_REQUEST', `Created request: ${finalTicketNo}`);
                    res.json({ success: true, ticket_no: finalTicketNo });
                }
            });
    }
});

// Get all hardware requests (with role-based filtering)
router.get('/hardware-requests', requireAuth, (req, res) => {
    let query = `
        SELECT r.*, u.username, u.fullname 
        FROM hardware_requests r
        JOIN users u ON r.user_id = u.id
    `;
    
    let params = [];
    
    if (req.session.userRole === 'bit') {
        query += ' WHERE r.branch_code = ?';
        params = [req.session.branchCode];
    } else if (req.session.userRole === 'dit') {
        db.get('SELECT assigned_branches FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err || !user || !user.assigned_branches) {
                return res.json([]);
            }
            try {
                const assignedBranches = JSON.parse(user.assigned_branches);
                const branchCodes = assignedBranches.map(b => b.branch_code);
                if (branchCodes.length === 0) return res.json([]);
                const placeholders = branchCodes.map(() => '?').join(',');
                query += ` WHERE r.branch_code IN (${placeholders})`;
                db.all(query, branchCodes, (err, rows) => {
                    res.json(rows || []);
                });
            } catch(e) {
                res.json([]);
            }
        });
        return;
    }
    
    query += ' ORDER BY r.created_at DESC';
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching requests:', err);
            res.json([]);
        } else {
            res.json(rows || []);
        }
    });
});

// Update hardware request (Admin only) - Prevent editing if graded
router.put('/hardware-requests/:id', requireAdmin, (req, res) => {
    const requestId = req.params.id;
    const {
        branch_code, branch_name, asset_category, brand, model,
        serial_number, hardware_age, status, remarks, description, date_reported, trf_number
    } = req.body;
    
    // Check if request already has a grade (prevent editing)
    db.get('SELECT average_grade FROM hardware_requests WHERE id = ?', [requestId], (err, request) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        if (request && request.average_grade !== null) {
            return res.json({ success: false, error: 'Cannot edit a graded request' });
        }
        
        if (status === 'For Store Transfer' && (!trf_number || trf_number.trim() === '')) {
            return res.json({ success: false, error: 'TRF # is required when status is For Store Transfer' });
        }
        
        db.run(`UPDATE hardware_requests SET 
            branch_code = ?,
            branch_name = ?,
            asset_category = ?,
            brand = ?,
            model = ?,
            serial_number = ?,
            hardware_age = ?,
            status = ?,
            remarks = ?,
            description = ?,
            date_reported = ?,
            trf_number = ?
            WHERE id = ?`,
            [branch_code, branch_name, asset_category, brand, model,
             serial_number, hardware_age, status, remarks, description, date_reported, trf_number || '', requestId],
            function(err) {
                if (err) {
                    console.error('Error updating request:', err);
                    res.json({ success: false, error: err.message });
                } else {
                    logActivity(req.session.userId, 'UPDATE_REQUEST', `Updated request ID: ${requestId}`);
                    res.json({ success: true });
                }
            });
    });
});

// Mark as received (BIT and DIT can access for their branches)
router.put('/hardware-requests/:id/received', requireAuth, (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('photo')(req, res, (err) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        
        const requestId = req.params.id;
        const { branch_code } = req.body;
        let photoPath = null;
        
        if (req.file) {
            photoPath = '/uploads/' + req.file.filename;
        }
        
        // Verify user has permission (BIT can receive own branch, DIT can receive assigned branches)
        if (req.session.userRole === 'bit') {
            db.get('SELECT branch_code FROM hardware_requests WHERE id = ?', [requestId], (err, request) => {
                if (err || !request || request.branch_code !== req.session.branchCode) {
                    return res.status(403).json({ success: false, error: 'Permission denied' });
                }
                updateReceived();
            });
        } else if (req.session.userRole === 'dit') {
            db.get('SELECT assigned_branches FROM users WHERE id = ?', [req.session.userId], (err, user) => {
                if (err || !user || !user.assigned_branches) {
                    return res.status(403).json({ success: false, error: 'Permission denied' });
                }
                const assignedBranches = JSON.parse(user.assigned_branches);
                const branchCodes = assignedBranches.map(b => b.branch_code);
                db.get('SELECT branch_code FROM hardware_requests WHERE id = ?', [requestId], (err, request) => {
                    if (err || !request || !branchCodes.includes(request.branch_code)) {
                        return res.status(403).json({ success: false, error: 'Permission denied' });
                    }
                    updateReceived();
                });
            });
        } else {
            updateReceived();
        }
        
        function updateReceived() {
            let updateQuery = `UPDATE hardware_requests SET status = 'Received on Store', received_date = CURRENT_TIMESTAMP`;
            let params = [];
            
            if (photoPath) {
                updateQuery += `, received_photo = ?`;
                params.push(photoPath);
            }
            
            if (branch_code && req.session.userRole === 'dit') {
                updateQuery += `, branch_code = ?`;
                params.push(branch_code);
                db.get('SELECT branch_name FROM users WHERE branch_code = ?', [branch_code], (err, branch) => {
                    if (branch && branch.branch_name) {
                        updateQuery += `, branch_name = ?`;
                        params.push(branch.branch_name);
                    }
                    updateQuery += ` WHERE id = ?`;
                    params.push(requestId);
                    db.run(updateQuery, params, function(err) {
                        if (err) {
                            res.json({ success: false, error: err.message });
                        } else {
                            logActivity(req.session.userId, 'RECEIVE_REQUEST', `Received request ID: ${requestId}`);
                            res.json({ success: true, photo: photoPath });
                        }
                    });
                });
            } else {
                updateQuery += ` WHERE id = ?`;
                params.push(requestId);
                db.run(updateQuery, params, function(err) {
                    if (err) {
                        res.json({ success: false, error: err.message });
                    } else {
                        logActivity(req.session.userId, 'RECEIVE_REQUEST', `Received request ID: ${requestId}`);
                        res.json({ success: true, photo: photoPath });
                    }
                });
            }
        }
    });
});

// Deploy hardware (BIT and DIT can access for their branches)
router.post('/hardware-requests/:id/deploy', requireAuth, (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('deployment_photo')(req, res, (err) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        
        const requestId = req.params.id;
        const { branch_code, branch_name, brand, model, serial_number, deployment_date } = req.body;
        let photoPath = null;
        
        if (req.file) {
            photoPath = '/uploads/' + req.file.filename;
        }
        
        // Verify user has permission
        if (req.session.userRole === 'bit') {
            db.get('SELECT branch_code FROM hardware_requests WHERE id = ?', [requestId], (err, request) => {
                if (err || !request || request.branch_code !== req.session.branchCode) {
                    return res.status(403).json({ success: false, error: 'Permission denied' });
                }
                performDeploy();
            });
        } else if (req.session.userRole === 'dit') {
            db.get('SELECT assigned_branches FROM users WHERE id = ?', [req.session.userId], (err, user) => {
                if (err || !user || !user.assigned_branches) {
                    return res.status(403).json({ success: false, error: 'Permission denied' });
                }
                const assignedBranches = JSON.parse(user.assigned_branches);
                const branchCodes = assignedBranches.map(b => b.branch_code);
                db.get('SELECT branch_code FROM hardware_requests WHERE id = ?', [requestId], (err, request) => {
                    if (err || !request || !branchCodes.includes(request.branch_code)) {
                        return res.status(403).json({ success: false, error: 'Permission denied' });
                    }
                    performDeploy();
                });
            });
        } else {
            performDeploy();
        }
        
        function performDeploy() {
            db.run(`UPDATE hardware_requests SET 
                status = 'Deployed on Store', 
                deployed_date = ?,
                deployed_branch_code = ?,
                deployed_branch_name = ?,
                brand = COALESCE(?, brand),
                model = COALESCE(?, model),
                serial_number = COALESCE(?, serial_number),
                execution_photo = ?,
                deployed_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [deployment_date || new Date().toISOString(), branch_code, branch_name, 
                 brand, model, serial_number, photoPath, requestId],
                function(err) {
                    if (err) {
                        console.error('Error deploying:', err);
                        res.json({ success: false, error: err.message });
                    } else {
                        db.run(`INSERT INTO deployed_units (request_id, ticket_no, branch_code, branch_name, brand, model, serial_number, deployment_date, deployment_photo, deployed_by)
                                SELECT ?, ticket_no, ?, ?, ?, ?, ?, ?, ?, ? FROM hardware_requests WHERE id = ?`,
                            [requestId, branch_code, branch_name, brand, model, serial_number, deployment_date, photoPath, req.session.userId, requestId],
                            function(err2) {
                                if (err2) console.error('Error saving to deployed_units:', err2);
                            });
                        logActivity(req.session.userId, 'DEPLOY_REQUEST', `Deployed request ID: ${requestId}`);
                        res.json({ success: true, photo: photoPath });
                    }
                });
        }
    });
});

// Get deployed units
router.get('/deployed-units', requireAuth, (req, res) => {
    let query = `
        SELECT d.*, u.username as deployed_by_name
        FROM deployed_units d
        JOIN users u ON d.deployed_by = u.id
        ORDER BY d.deployment_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching deployed units:', err);
            res.json([]);
        } else {
            res.json(rows || []);
        }
    });
});

// Get DIT branches
router.get('/dit-branches', requireAuth, (req, res) => {
    if (req.session.userRole !== 'dit') {
        return res.json([]);
    }
    
    db.get('SELECT assigned_branches FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user || !user.assigned_branches) {
            return res.json([]);
        }
        try {
            const assignedBranches = JSON.parse(user.assigned_branches);
            res.json(assignedBranches);
        } catch(e) {
            res.json([]);
        }
    });
});

// Get reports
router.get('/reports/delivered', requireAuth, (req, res) => {
    if (req.session.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { period } = req.query;
    
    let dateCondition = '';
    switch(period) {
        case 'week':
            dateCondition = "datetime(approved_at) >= datetime('now', '-7 days')";
            break;
        case 'month':
            dateCondition = "datetime(approved_at) >= datetime('now', '-30 days')";
            break;
        case 'sem':
            dateCondition = "datetime(approved_at) >= datetime('now', '-180 days')";
            break;
        default:
            dateCondition = "1=1";
    }
    
    db.all(`
        SELECT r.*, u.username, u.fullname, u.branch_code, u.branch_name
        FROM hardware_requests r
        JOIN users u ON r.user_id = u.id
        WHERE ${dateCondition} AND r.status = 'Deployed on Store'
        ORDER BY r.approved_at DESC
    `, (err, rows) => {
        res.json(rows || []);
    });
});

// ========== ADD GRADE TO DEPLOYED UNIT (Admin only) with comment ==========
router.post('/deployed-units/:id/grade', requireAdmin, (req, res) => {
    const unitId = req.params.id;
    const { timeliness_grade, deployment_grade, comment } = req.body;
    
    if (timeliness_grade < 1 || timeliness_grade > 100 || deployment_grade < 1 || deployment_grade > 100) {
        return res.status(400).json({ success: false, error: 'Grades must be between 1 and 100' });
    }
    
    if (!comment || comment.trim() === '') {
        return res.status(400).json({ success: false, error: 'Comment is required before grading' });
    }
    
    const average_grade = (timeliness_grade + deployment_grade) / 2;
    
    db.run(`UPDATE deployed_units SET 
        timeliness_grade = ?,
        deployment_grade = ?,
        average_grade = ?,
        grade_comment = ?
        WHERE id = ?`,
        [timeliness_grade, deployment_grade, average_grade, comment, unitId],
        function(err) {
            if (err) {
                console.error('Error updating grade:', err);
                res.json({ success: false, error: err.message });
            } else {
                db.run(`UPDATE hardware_requests SET 
                    timeliness_grade = ?,
                    deployment_grade = ?,
                    average_grade = ?,
                    grade_comment = ?
                    WHERE id = (SELECT request_id FROM deployed_units WHERE id = ?)`,
                    [timeliness_grade, deployment_grade, average_grade, comment, unitId],
                    function(err2) {
                        if (err2) console.error('Error updating request grade:', err2);
                        logActivity(req.session.userId, 'ADD_GRADE', `Added grade to deployed unit ID: ${unitId}`);
                        res.json({ success: true, average_grade: average_grade });
                    });
            }
        });
});

// ========== GET BIT USER STATISTICS ==========
router.get('/bit-stats', requireAuth, (req, res) => {
    if (req.session.userRole !== 'bit') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const userId = req.session.userId;
    
    db.all(`SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'Deployed on Store' THEN 1 ELSE 0 END) as completed,
        AVG(CASE WHEN average_grade IS NOT NULL THEN average_grade ELSE NULL END) as average_grade
        FROM hardware_requests 
        WHERE user_id = ?`, [userId], (err, stats) => {
        if (err) {
            res.json({ error: err.message });
        } else {
            res.json(stats[0] || { total_requests: 0, completed: 0, average_grade: null });
        }
    });
});

module.exports = router;