// ========== DASHBOARD TAB ==========
async function loadDashboard() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-4 text-gray-500">Loading dashboard...</p></div>';
    
    try {
        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();
        const requestsRes = await fetch('/api/hardware-requests');
        const requests = await requestsRes.json();
        const recentRequests = requests.slice(0, 5);
        
        const isDit = currentUser && currentUser.role === 'dit';
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isBit = currentUser && currentUser.role === 'bit';
        
        let additionalHtml = '';
        let gradeHtml = '';
        
        // For BIT users - Show average grade
        if (isBit) {
            try {
                const bitStatsRes = await fetch('/api/bit-stats');
                const bitStats = await bitStatsRes.json();
                if (bitStats.average_grade) {
                    gradeHtml = `
                        <div class="bg-gradient-to-r from-green-50 to-white rounded-lg shadow p-6 border-l-4 border-green-500">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="text-gray-500 text-sm">Your Average Performance Grade</p>
                                    <p class="text-3xl font-bold text-green-600">${bitStats.average_grade.toFixed(1)}%</p>
                                    <p class="text-xs text-gray-500 mt-1">Based on ${bitStats.completed || 0} completed deployments</p>
                                </div>
                                <div class="w-20 h-20 rounded-full ${bitStats.average_grade >= 75 ? 'bg-green-100' : bitStats.average_grade >= 50 ? 'bg-yellow-100' : 'bg-red-100'} flex items-center justify-center">
                                    <i class="fas fa-chart-line text-3xl ${bitStats.average_grade >= 75 ? 'text-green-600' : bitStats.average_grade >= 50 ? 'text-yellow-600' : 'text-red-600'}"></i>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    gradeHtml = `
                        <div class="bg-gradient-to-r from-gray-50 to-white rounded-lg shadow p-6 border-l-4 border-gray-400">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="text-gray-500 text-sm">Your Average Performance Grade</p>
                                    <p class="text-3xl font-bold text-gray-600">N/A</p>
                                    <p class="text-xs text-gray-500 mt-1">No grades available yet</p>
                                </div>
                                <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i class="fas fa-chart-line text-3xl text-gray-400"></i>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch(e) {
                console.error('Error loading BIT stats:', e);
            }
        }
        
        // For DIT users - Show assigned branches
        if (isDit && ditBranches && ditBranches.length > 0) {
            additionalHtml = `
                <div class="bg-white rounded-lg shadow mt-6">
                    <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-50">
                        <h3 class="text-lg font-semibold flex items-center">
                            <i class="fas fa-code-branch mr-2 text-purple-600"></i>My Assigned Branches
                        </h3>
                        <p class="text-sm text-gray-500 mt-1">Branches under your district management</p>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            ${ditBranches.map(branch => `
                                <div class="bg-gradient-to-r from-purple-50 to-white rounded-lg p-4 border border-purple-200 hover:shadow-md transition-all">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                            <i class="fas fa-store text-purple-600"></i>
                                        </div>
                                        <div>
                                            <p class="font-bold text-gray-800">${escapeHtml(branch.branch_code)}</p>
                                            <p class="text-sm text-gray-600">${escapeHtml(branch.branch_name)}</p>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-4 text-right">
                            <span class="text-xs text-gray-500">Total: ${ditBranches.length} branch(es)</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // For Admin users - Show DIT users with their branches
        if (isAdmin) {
            const usersRes = await fetch('/api/users');
            const users = await usersRes.json();
            const ditUsers = users.filter(u => u.role === 'dit');
            
            if (ditUsers.length > 0) {
                additionalHtml = `
                    <div class="bg-white rounded-lg shadow mt-6">
                        <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-50">
                            <h3 class="text-lg font-semibold flex items-center">
                                <i class="fas fa-user-tie mr-2 text-purple-600"></i>DIT Users & Assigned Branches
                            </h3>
                            <p class="text-sm text-gray-500 mt-1">District IT Managers and their managed branches</p>
                        </div>
                        <div class="p-6">
                            <div class="space-y-6">
                                ${ditUsers.map(dit => {
                                    let assignedBranches = [];
                                    try {
                                        assignedBranches = JSON.parse(dit.assigned_branches || '[]');
                                    } catch(e) {}
                                    
                                    return `
                                        <div class="border rounded-lg overflow-hidden">
                                            <div class="bg-gray-50 px-4 py-3 flex justify-between items-center">
                                                <div>
                                                    <div class="flex items-center space-x-3">
                                                        <i class="fas fa-user-circle text-2xl text-purple-600"></i>
                                                        <div>
                                                            <p class="font-semibold text-gray-800">${escapeHtml(dit.fullname || dit.username)}</p>
                                                            <p class="text-xs text-gray-500">@${escapeHtml(dit.username)} | District: ${escapeHtml(dit.branch_name || dit.district || 'N/A')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span class="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">${assignedBranches.length} branches</span>
                                            </div>
                                            <div class="p-4">
                                                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                    ${assignedBranches.length > 0 ? assignedBranches.map(branch => `
                                                        <div class="bg-purple-50 rounded-lg p-3 border border-purple-100">
                                                            <div class="flex items-center space-x-2">
                                                                <i class="fas fa-store text-purple-500 text-sm"></i>
                                                                <div>
                                                                    <p class="font-medium text-sm text-gray-800">${escapeHtml(branch.branch_code)}</p>
                                                                    <p class="text-xs text-gray-500">${escapeHtml(branch.branch_name)}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    `).join('') : '<p class="text-gray-400 text-sm">No branches assigned yet</p>'}
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        container.innerHTML = `
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                        <div class="flex justify-between">
                            <div><p class="text-gray-500 text-sm">Total Requests</p><p class="text-3xl font-bold">${stats.total || 0}</p></div>
                            <i class="fas fa-clipboard-list text-4xl text-blue-500 opacity-50"></i>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                        <div class="flex justify-between">
                            <div><p class="text-gray-500 text-sm">Pending Approval</p><p class="text-3xl font-bold text-yellow-600">${stats.pending || 0}</p></div>
                            <i class="fas fa-clock text-4xl text-yellow-500 opacity-50"></i>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
                        <div class="flex justify-between">
                            <div><p class="text-gray-500 text-sm">Received</p><p class="text-3xl font-bold text-blue-600">${stats.received || 0}</p></div>
                            <i class="fas fa-check-circle text-4xl text-blue-500 opacity-50"></i>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                        <div class="flex justify-between">
                            <div><p class="text-gray-500 text-sm">Deployed</p><p class="text-3xl font-bold text-green-600">${stats.approved || 0}</p></div>
                            <i class="fas fa-rocket text-4xl text-green-500 opacity-50"></i>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                        <div class="flex justify-between">
                            <div><p class="text-gray-500 text-sm">Active Requests</p><p class="text-3xl font-bold text-red-600">${stats.highUrgency || 0}</p></div>
                            <i class="fas fa-exclamation-triangle text-4xl text-red-500 opacity-50"></i>
                        </div>
                    </div>
                </div>
                ${gradeHtml}
                <div class="bg-white rounded-lg shadow">
                    <div class="px-6 py-4 border-b"><h3 class="text-lg font-semibold">Recent Requests</h3></div>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr><th class="px-6 py-3 text-left text-xs">Ticket #</th><th class="px-6 py-3 text-left text-xs">Branch</th><th class="px-6 py-3 text-left text-xs">Category</th><th class="px-6 py-3 text-left text-xs">Status</th><th class="px-6 py-3 text-left text-xs">Date</th></tr></thead>
                            <tbody>
                                ${recentRequests.map(req => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-6 py-4 text-sm">${escapeHtml(req.ticket_no || 'N/A')}</td>
                                        <td class="px-6 py-4 text-sm">${escapeHtml(req.branch_name || req.branch_code)}</td>
                                        <td class="px-6 py-4 text-sm">${escapeHtml(req.asset_category)}</td>
                                        <td class="px-6 py-4"><span class="status-badge status-${req.status === 'Deployed on Store' ? 'deployed' : req.status === 'Received on Store' ? 'received' : 'pending'}">${escapeHtml(req.status)}</span></td>
                                        <td class="px-6 py-4 text-sm">${new Date(req.created_at).toLocaleDateString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ${additionalHtml}
            </div>
        `;
    } catch (error) {
        console.error('Dashboard error:', error);
        container.innerHTML = '<div class="text-center py-8 text-red-500">Error loading dashboard</div>';
    }
}