// ========== REPORTS TAB ==========
let reportData = [];

async function loadReports() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    
    // Get branches for filter
    let branches = [];
    try {
        const usersRes = await fetch('/api/users');
        const users = await usersRes.json();
        branches = users.filter(u => u.role === 'bit').map(u => ({ code: u.branch_code, name: u.branch_name }));
    } catch(e) {}
    
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50">
                <h2 class="text-xl font-bold"><i class="fas fa-chart-bar mr-2 text-blue-600"></i>Generate Reports</h2>
                <p class="text-sm text-gray-500 mt-1">Export hardware deployment reports in CSV or PDF format</p>
            </div>
            <div class="p-6">
                <!-- Filters -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                        <select id="reportType" class="w-full px-3 py-2 border rounded-lg">
                            <option value="deployed">Deployed Hardware Report</option>
                            <option value="requests">Request Summary Report</option>
                            <option value="branch">Branch Performance Report</option>
                            <option value="bit">BIT Performance Report</option>
                            <option value="timeliness">Timeliness Report</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input type="date" id="startDate" class="w-full px-3 py-2 border rounded-lg" value="${new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input type="date" id="endDate" class="w-full px-3 py-2 border rounded-lg" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Branch Filter</label>
                        <select id="branchFilter" class="w-full px-3 py-2 border rounded-lg">
                            <option value="">All Branches</option>
                            ${branches.map(b => `<option value="${b.code}">${b.code} - ${b.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex gap-3 mb-6">
                    <button onclick="generateReport()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <i class="fas fa-chart-line mr-2"></i>Generate Report
                    </button>
                    <button onclick="exportToCSV()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <i class="fas fa-file-csv mr-2"></i>Export to CSV
                    </button>
                    <button onclick="exportToPDF()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        <i class="fas fa-file-pdf mr-2"></i>Export to PDF
                    </button>
                </div>
                
                <!-- Report Results -->
                <div id="reportResults" class="overflow-x-auto">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-chart-line text-4xl mb-2"></i>
                        <p>Select report type and click "Generate Report"</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========== GENERATE REPORT ==========
async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const branchFilter = document.getElementById('branchFilter').value;
    
    const resultsDiv = document.getElementById('reportResults');
    resultsDiv.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">Generating report...</p></div>';
    
    try {
        // Fetch data based on report type
        let data = [];
        let headers = [];
        
        if (reportType === 'deployed') {
            const res = await fetch('/api/deployed-units');
            let units = await res.json();
            
            // Apply filters
            units = units.filter(u => {
                const deployDate = new Date(u.deployment_date);
                const inDateRange = (!startDate || deployDate >= new Date(startDate)) && (!endDate || deployDate <= new Date(endDate));
                const inBranch = !branchFilter || u.branch_code === branchFilter;
                return inDateRange && inBranch;
            });
            
            headers = ['Ticket #', 'Branch', 'Brand', 'Model', 'Serial #', 'Deployment Date', 'Timeliness Grade', 'Deployment Grade', 'Average Grade', 'Comment'];
            data = units.map(u => [
                u.ticket_no || 'N/A',
                u.branch_name || u.branch_code,
                u.brand,
                u.model,
                u.serial_number,
                new Date(u.deployment_date).toLocaleDateString(),
                u.timeliness_grade || 'N/A',
                u.deployment_grade || 'N/A',
                u.average_grade ? u.average_grade + '%' : 'N/A',
                u.grade_comment || 'N/A'
            ]);
            
            reportData = { headers, data, title: 'Deployed Hardware Report' };
            
        } else if (reportType === 'requests') {
            const res = await fetch('/api/hardware-requests');
            let requests = await res.json();
            
            requests = requests.filter(r => {
                const createdDate = new Date(r.created_at);
                const inDateRange = (!startDate || createdDate >= new Date(startDate)) && (!endDate || createdDate <= new Date(endDate));
                const inBranch = !branchFilter || r.branch_code === branchFilter;
                return inDateRange && inBranch;
            });
            
            headers = ['Ticket #', 'Branch', 'Asset Category', 'Brand', 'Model', 'Status', 'Date Reported', 'Date Deployed', 'Average Grade'];
            data = requests.map(r => [
                r.ticket_no || 'N/A',
                r.branch_name || r.branch_code,
                r.asset_category,
                r.brand,
                r.model,
                r.status,
                new Date(r.created_at).toLocaleDateString(),
                r.deployed_date ? new Date(r.deployed_date).toLocaleDateString() : 'N/A',
                r.average_grade ? r.average_grade + '%' : 'N/A'
            ]);
            
            reportData = { headers, data, title: 'Request Summary Report' };
            
        } else if (reportType === 'branch') {
            const unitsRes = await fetch('/api/deployed-units');
            let units = await unitsRes.json();
            
            // Group by branch
            const branchStats = {};
            units.forEach(u => {
                const branchKey = u.branch_code;
                if (!branchStats[branchKey]) {
                    branchStats[branchKey] = {
                        branch_code: branchKey,
                        branch_name: u.branch_name,
                        total: 0,
                        graded: 0,
                        avg_grade: 0,
                        total_grade: 0
                    };
                }
                branchStats[branchKey].total++;
                if (u.average_grade) {
                    branchStats[branchKey].graded++;
                    branchStats[branchKey].total_grade += u.average_grade;
                }
            });
            
            Object.values(branchStats).forEach(b => {
                b.avg_grade = b.graded > 0 ? (b.total_grade / b.graded).toFixed(1) : 'N/A';
            });
            
            headers = ['Branch Code', 'Branch Name', 'Total Deployments', 'Graded Deployments', 'Average Grade'];
            data = Object.values(branchStats).map(b => [
                b.branch_code,
                b.branch_name || b.branch_code,
                b.total,
                b.graded,
                b.avg_grade !== 'N/A' ? b.avg_grade + '%' : 'N/A'
            ]);
            
            reportData = { headers, data, title: 'Branch Performance Report' };
            
        } else if (reportType === 'bit') {
            const usersRes = await fetch('/api/users');
            const users = await usersRes.json();
            const bitUsers = users.filter(u => u.role === 'bit');
            
            const bitStats = [];
            for (const user of bitUsers) {
                const requestsRes = await fetch('/api/hardware-requests');
                let requests = await requestsRes.json();
                const userRequests = requests.filter(r => r.user_id === user.id);
                const completed = userRequests.filter(r => r.status === 'Deployed on Store');
                const avgGrade = completed.reduce((sum, r) => sum + (r.average_grade || 0), 0) / (completed.length || 1);
                
                bitStats.push({
                    username: user.username,
                    fullname: user.fullname || user.username,
                    branch: user.branch_name || user.branch_code,
                    total_requests: userRequests.length,
                    completed: completed.length,
                    avg_grade: avgGrade || 0
                });
            }
            
            headers = ['Username', 'Full Name', 'Branch', 'Total Requests', 'Completed Deployments', 'Average Grade'];
            data = bitStats.map(b => [
                b.username,
                b.fullname,
                b.branch || 'N/A',
                b.total_requests,
                b.completed,
                b.avg_grade ? b.avg_grade.toFixed(1) + '%' : 'N/A'
            ]);
            
            reportData = { headers, data, title: 'BIT Performance Report' };
            
        } else if (reportType === 'timeliness') {
            const res = await fetch('/api/hardware-requests');
            let requests = await res.json();
            
            requests = requests.filter(r => r.status === 'Deployed on Store' && r.created_at && r.deployed_at);
            
            const timelinessData = requests.map(r => {
                const created = new Date(r.created_at);
                const deployed = new Date(r.deployed_at);
                const daysDiff = Math.ceil((deployed - created) / (1000 * 60 * 60 * 24));
                return {
                    ticket_no: r.ticket_no,
                    branch: r.branch_name || r.branch_code,
                    created_date: created,
                    deployed_date: deployed,
                    days_to_deploy: daysDiff,
                    grade: r.timeliness_grade || 'N/A'
                };
            }).filter(t => {
                if (startDate && new Date(t.created_date) < new Date(startDate)) return false;
                if (endDate && new Date(t.created_date) > new Date(endDate)) return false;
                if (branchFilter && t.branch !== branchFilter) return false;
                return true;
            });
            
            headers = ['Ticket #', 'Branch', 'Date Requested', 'Date Deployed', 'Days to Deploy', 'Timeliness Grade'];
            data = timelinessData.map(t => [
                t.ticket_no,
                t.branch,
                t.created_date.toLocaleDateString(),
                t.deployed_date.toLocaleDateString(),
                t.days_to_deploy,
                t.grade !== 'N/A' ? t.grade + '%' : 'N/A'
            ]);
            
            reportData = { headers, data, title: 'Timeliness Report' };
        }
        
        // Display report
        if (data.length === 0) {
            resultsDiv.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-4xl mb-2"></i><p>No data found for selected filters</p></div>';
            return;
        }
        
        resultsDiv.innerHTML = `
            <div class="border rounded-lg overflow-hidden">
                <div class="bg-gray-50 px-4 py-2 border-b">
                    <h3 class="font-semibold">${reportData.title} - ${new Date().toLocaleDateString()}</h3>
                    <p class="text-xs text-gray-500">Total records: ${data.length}</p>
                </div>
                <div class="overflow-x-auto max-h-[500px]">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100 sticky top-0">
                            <tr>
                                ${headers.map(h => `<th class="px-4 py-2 text-left border-b">${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr class="hover:bg-gray-50 border-b">
                                    ${row.map(cell => `<td class="px-4 py-2">${escapeHtml(String(cell))}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Report error:', error);
        resultsDiv.innerHTML = '<div class="text-center py-8 text-red-500">Error generating report. Please try again.</div>';
    }
}

// ========== EXPORT TO CSV ==========
function exportToCSV() {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
        showToast('No data to export. Please generate a report first.', 'error');
        return;
    }
    
    // Create CSV content
    let csvContent = reportData.headers.join(',') + '\n';
    
    reportData.data.forEach(row => {
        const escapedRow = row.map(cell => {
            // Escape commas and quotes
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',');
        csvContent += escapedRow + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `${reportData.title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('CSV exported successfully!', 'success');
}

// ========== EXPORT TO PDF ==========
async function exportToPDF() {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
        showToast('No data to export. Please generate a report first.', 'error');
        return;
    }
    
    // Dynamically load html2pdf library if not already loaded
    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        document.head.appendChild(script);
        
        script.onload = () => {
            generatePDF();
        };
    } else {
        generatePDF();
    }
    
    function generatePDF() {
        // Create PDF content
        const pdfContent = document.createElement('div');
        pdfContent.style.padding = '20px';
        pdfContent.style.fontFamily = 'Arial, sans-serif';
        
        // Header
        pdfContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
                <h1 style="color: #1e40af; margin: 0;">IT Hardware Portal</h1>
                <h2 style="color: #374151; margin: 5px 0;">${reportData.title}</h2>
                <p style="color: #6b7280; margin: 5px 0;">Generated on: ${new Date().toLocaleString()}</p>
                <p style="color: #6b7280; margin: 0;">Total Records: ${reportData.data.length}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        ${reportData.headers.map(h => `<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${reportData.data.map(row => `
                        <tr>
                            ${row.map(cell => `<td style="border: 1px solid #d1d5db; padding: 6px;">${escapeHtml(String(cell))}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px;">
                <p>This is a system-generated report from IT Hardware Portal</p>
            </div>
        `;
        
        // PDF options
        const opt = {
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `${reportData.title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, letterRendering: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        
        html2pdf().set(opt).from(pdfContent).save();
        showToast('PDF exported successfully!', 'success');
    }
}

// Make functions available globally
window.generateReport = generateReport;
window.exportToCSV = exportToCSV;
window.exportToPDF = exportToPDF;