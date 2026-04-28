// ========== USER MANAGEMENT TAB ==========
async function loadUsers() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-4 text-gray-500">Loading users...</p></div>';
    
    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`/api/users?_=${timestamp}`);
        const users = await res.json();
        
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="mb-6 flex justify-between items-center">
                    <div><h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-users mr-2 text-blue-600"></i>User Management</h2><p class="text-sm text-gray-500 mt-1">Create and manage system users (Admin only)</p></div>
                    <button onclick="openSelectUserTypeModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition flex items-center"><i class="fas fa-user-plus mr-2"></i>Add New User</button>
                </div>
                <div class="bg-white rounded-lg shadow p-12 text-center"><i class="fas fa-users text-6xl text-gray-300 mb-4"></i><p class="text-gray-500">No users found.</p></div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <div><h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-users mr-2 text-blue-600"></i>User Management</h2><p class="text-sm text-gray-500 mt-1">Create and manage system users (Admin only)</p></div>
                <button onclick="openSelectUserTypeModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition flex items-center"><i class="fas fa-user-plus mr-2"></i>Add New User</button>
            </div>
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch/District</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Branches</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${users.map(u => {
                                let assignedBranchesHtml = '-';
                                if (u.role === 'dit' && u.assigned_branches) {
                                    try {
                                        const branches = JSON.parse(u.assigned_branches);
                                        if (branches.length > 0) {
                                            assignedBranchesHtml = `<div class="flex flex-wrap gap-1">${branches.map(b => `<span class="px-1 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">${escapeHtml(b.branch_code)}</span>`).join('')}</div>`;
                                        }
                                    } catch(e) {}
                                } else if (u.role === 'bit' && u.branch_code) {
                                    assignedBranchesHtml = `<span class="px-1 py-0.5 text-xs bg-green-100 text-green-800 rounded">${escapeHtml(u.branch_code)}</span>`;
                                }
                                return `
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-6 py-4 text-sm">${escapeHtml(u.username)}</td>
                                        <td class="px-6 py-4 text-sm">${escapeHtml(u.fullname) || '-'}</td>
                                        <td class="px-6 py-4"><span class="px-2 py-1 text-xs rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-800' : u.role === 'dit' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}">${u.role.toUpperCase()}</span></td>
                                        <td class="px-6 py-4 text-sm">${escapeHtml(u.branch_code || '-')}</td>
                                        <td class="px-6 py-4 text-sm">${assignedBranchesHtml}</td>
                                        <td class="px-6 py-4 text-sm">${new Date(u.created_at).toLocaleDateString()}</td>
                                        <td class="px-6 py-4"><button onclick="editUser(${u.id})" class="edit-btn"><i class="fas fa-edit"></i> Edit</button><button onclick="deleteUser(${u.id})" class="delete-btn"><i class="fas fa-trash"></i> Delete</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = '<div class="text-center py-8 text-red-500">Error loading users</div>';
    }
}

async function deleteUser(userId) {
    if (!confirm('⚠️ Are you sure you want to delete this user?')) return;
    
    try {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { 
            showToast('User deleted successfully!', 'success'); 
            await loadUsers();
            await loadBitBranches();
        } else {
            showToast(data.error || 'Delete failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

// ========== GET DIT USERS WITH BRANCHES (FOR ADMIN DASHBOARD) ==========
async function getDitUsersWithBranches() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const ditUsers = users.filter(u => u.role === 'dit');
        
        return ditUsers.map(dit => {
            let assignedBranches = [];
            try {
                assignedBranches = JSON.parse(dit.assigned_branches || '[]');
            } catch(e) {}
            return {
                ...dit,
                assigned_branches_parsed: assignedBranches
            };
        });
    } catch (error) {
        console.error('Error fetching DIT users:', error);
        return [];
    }
}

// Make functions available globally
window.getDitUsersWithBranches = getDitUsersWithBranches;