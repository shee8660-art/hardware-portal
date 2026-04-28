// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let allRequests = [];
let deployedUnits = [];
let selectedRole = null;
let isEditing = false;
let allBitBranches = [];
let currentTab = 'dashboard';
let ditBranches = [];

// ========== HELPER FUNCTIONS ==========
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-3 rounded-lg shadow-lg flex items-center`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function logout() { 
    await fetch('/logout'); 
    window.location.href = '/'; 
}

// ========== MODAL FUNCTIONS ==========
function closeDetailsModal() { 
    const modal = document.getElementById('detailsModal');
    if (modal) modal.classList.add('hidden'); 
}

function closeNewRequestModal() { 
    const modal = document.getElementById('newRequestModal');
    if (modal) modal.classList.add('hidden'); 
}

function closeSelectUserTypeModal() { 
    const modal = document.getElementById('selectUserTypeModal');
    if (modal) modal.classList.add('hidden'); 
}

function closeCreateUserModal() { 
    const modal = document.getElementById('createUserModal');
    if (modal) {
        modal.classList.add('hidden');
        const ditFields = document.getElementById('ditFields');
        const bitFields = document.getElementById('bitFields');
        if (ditFields) ditFields.classList.add('hidden');
        if (bitFields) bitFields.classList.add('hidden');
    }
}

function openSelectUserTypeModal() { 
    const modal = document.getElementById('selectUserTypeModal');
    if (modal) modal.classList.remove('hidden'); 
}

function closeReceivedModal() { 
    const modal = document.getElementById('receivedModal');
    if (modal) modal.classList.add('hidden'); 
}

function closeDeployModal() { 
    const modal = document.getElementById('deployModal');
    if (modal) modal.classList.add('hidden'); 
}

function closeEditRequestModal() { 
    const modal = document.getElementById('editRequestModal');
    if (modal) modal.classList.add('hidden'); 
}

// ========== TOGGLE TRF FIELD ==========
function toggleNewRequestTrfField() {
    const statusSelect = document.getElementById('status');
    const trfField = document.getElementById('trfField');
    if (statusSelect && trfField) {
        if (statusSelect.value === 'For Store Transfer') {
            trfField.classList.remove('hidden');
        } else {
            trfField.classList.add('hidden');
        }
    }
}

// ========== CHECK TICKET NUMBER EXISTS ==========
async function checkTicketNumberExists(ticketNo) {
    if (!ticketNo || ticketNo.trim() === '') return false;
    
    try {
        const res = await fetch('/api/hardware-requests');
        const requests = await res.json();
        return requests.some(req => req.ticket_no === ticketNo);
    } catch (error) {
        console.error('Error checking ticket number:', error);
        return false;
    }
}

// ========== OPEN NEW REQUEST MODAL ==========
function openNewRequestModal() {
    console.log('Opening new request modal');
    
    const ticketNo = document.getElementById('ticketNo');
    const branchSelect = document.getElementById('branchSelect');
    const dateReported = document.getElementById('date_reported');
    const requestedBy = document.getElementById('requested_by');
    const remarksSelect = document.getElementById('remarksSelect');
    const assetCategory = document.getElementById('asset_category');
    const brand = document.getElementById('brand');
    const model = document.getElementById('model');
    const serialNumber = document.getElementById('serial_number');
    const hardwareAge = document.getElementById('hardware_age');
    const status = document.getElementById('status');
    const description = document.getElementById('description');
    const trfNumber = document.getElementById('trfNumber');
    const trfField = document.getElementById('trfField');
    
    if (ticketNo) ticketNo.value = '';
    if (branchSelect) branchSelect.value = '';
    if (dateReported) dateReported.value = new Date().toISOString().split('T')[0];
    if (requestedBy) requestedBy.value = currentUser?.fullname || currentUser?.username || '';
    if (remarksSelect) remarksSelect.value = '';
    if (assetCategory) assetCategory.value = '';
    if (brand) brand.value = '';
    if (model) model.value = '';
    if (serialNumber) serialNumber.value = '';
    if (hardwareAge) hardwareAge.value = '';
    if (status) status.value = 'For DM Approval';
    if (description) description.value = '';
    if (trfNumber) trfNumber.value = '';
    
    if (trfField) trfField.classList.add('hidden');
    
    loadBranchDropdown();
    
    const modal = document.getElementById('newRequestModal');
    if (modal) {
        modal.classList.remove('hidden');
        console.log('Modal opened successfully');
    } else {
        console.error('Modal element not found!');
    }
}

// ========== LOAD USER INFO ==========
async function loadUserInfo() {
    try {
        const res = await fetch('/api/user');
        const data = await res.json();
        if (data.loggedIn) {
            currentUser = data.user;
            const userNameEl = document.getElementById('userName');
            const userRoleBadgeEl = document.getElementById('userRoleBadge');
            const userBranchEl = document.getElementById('userBranch');
            
            if (userNameEl) userNameEl.textContent = currentUser.fullname || currentUser.username;
            if (userRoleBadgeEl) userRoleBadgeEl.textContent = currentUser.role.toUpperCase();
            if (userBranchEl) userBranchEl.textContent = `${currentUser.branch_code || ''} ${currentUser.branch_name || ''}`;
            
            if (currentUser.role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            }
            if (currentUser.role === 'dit') {
                await loadDitBranches();
            }
            return true;
        } else { 
            window.location.href = '/'; 
            return false;
        }
    } catch (error) { 
        console.error('Error loading user info:', error);
        window.location.href = '/';
        return false;
    }
}

async function loadDitBranches() {
    try {
        const res = await fetch('/api/dit-branches');
        const branches = await res.json();
        ditBranches = branches;
        return branches;
    } catch (error) {
        console.error('Error loading DIT branches:', error);
        return [];
    }
}

async function loadBitBranches() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const bitUsers = users.filter(u => u.role === 'bit');
        const branches = [];
        
        bitUsers.forEach(user => {
            if (user.branch_code && user.branch_name) {
                const exists = branches.some(b => b.branch_code === user.branch_code);
                if (!exists) {
                    branches.push({
                        branch_code: user.branch_code,
                        branch_name: user.branch_name,
                        assigned_to: user.username
                    });
                }
            }
        });
        
        allBitBranches = branches;
        return allBitBranches;
    } catch (error) {
        console.error('Error loading BIT branches:', error);
        allBitBranches = [];
        return [];
    }
}

async function loadBranchDropdown() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const bitUsers = users.filter(u => u.role === 'bit' && u.branch_code && u.branch_name);
        
        const branchSelect = document.getElementById('branchSelect');
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">-- Select Branch --</option>';
            bitUsers.forEach(user => {
                branchSelect.innerHTML += `<option value="${user.branch_code}|${user.branch_name}">${user.branch_code} - ${user.branch_name}</option>`;
            });
            
            if (bitUsers.length === 0) {
                branchSelect.innerHTML = '<option value="">No branches available. Create BIT users first.</option>';
            }
        }
    } catch (error) {
        console.error('Error loading branches:', error);
    }
}

// ========== PASSWORD STRENGTH ==========
function checkPasswordStrength() {
    const password = document.getElementById('newPassword');
    if (!password) return;
    const strengthDiv = document.querySelector('#createUserModal .password-strength');
    if (!strengthDiv) return;
    const val = password.value;
    if (!val) { strengthDiv.innerHTML = ''; return; }
    if (val.length < 8) strengthDiv.innerHTML = '<div class="password-strength strength-weak"></div>';
    else if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val)) strengthDiv.innerHTML = '<div class="password-strength strength-strong"></div>';
    else strengthDiv.innerHTML = '<div class="password-strength strength-medium"></div>';
}

// ========== TAB SWITCHING ==========
async function showTab(tabName) {
    console.log('Switching to tab:', tabName);
    currentTab = tabName;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('tab-active', 'border-blue-500', 'text-blue-600');
        btn.classList.add('text-gray-600');
    });
    const activeBtn = document.getElementById(`tab-${tabName}-btn`);
    if (activeBtn) {
        activeBtn.classList.add('tab-active', 'border-blue-500', 'text-blue-600');
        activeBtn.classList.remove('text-gray-600');
    }
    
    const container = document.getElementById('tabContent');
    if (container) {
        container.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-4 text-gray-500">Loading...</p></div>';
    }
    
    if (tabName === 'dashboard' && typeof loadDashboard === 'function') await loadDashboard();
    else if (tabName === 'requests' && typeof loadRequestsView === 'function') await loadRequestsView();
    else if (tabName === 'deployed' && typeof loadDeployedUnits === 'function') await loadDeployedUnits();
    else if (tabName === 'reports' && typeof loadReports === 'function') await loadReports();
    else if (tabName === 'users' && typeof loadUsers === 'function') await loadUsers();
    else if (tabName === 'categories' && typeof loadCategories === 'function') await loadCategories();
    else {
        console.error(`Tab function not found: ${tabName}`);
        if (container) {
            container.innerHTML = `<div class="text-center py-8 text-red-500">Error: ${tabName} module not loaded</div>`;
        }
    }
}

// ========== USER MANAGEMENT FUNCTIONS ==========
function renderBranchesCheckboxes(selectedBranches = []) {
    const container = document.getElementById('branchesCheckboxList');
    if (!container) return;
    
    if (allBitBranches.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center col-span-full">No branches available. Create BIT users first.</p>';
        updateSelectedCount();
        return;
    }
    
    container.innerHTML = allBitBranches.map(branch => `
        <label class="branch-checkbox">
            <input type="checkbox" value="${branch.branch_code}" data-branch-name="${branch.branch_name}" ${selectedBranches.some(s => s.branch_code === branch.branch_code) ? 'checked' : ''} onchange="updateSelectedCount()">
            <div><div class="font-semibold">${escapeHtml(branch.branch_code)}</div><div class="text-xs text-gray-500">${escapeHtml(branch.branch_name)}</div><div class="text-xs text-gray-400">Created by: ${escapeHtml(branch.assigned_to)}</div></div>
        </label>
    `).join('');
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('#branchesCheckboxList input[type="checkbox"]');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const countSpan = document.getElementById('selectedCount');
    if (countSpan) {
        countSpan.innerHTML = `${selectedCount} selected`;
        countSpan.style.background = selectedCount > 0 ? '#3b82f6' : '#9ca3af';
    }
}

function getSelectedBranches() {
    const checkboxes = document.querySelectorAll('#branchesCheckboxList input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => ({
        branch_code: cb.value,
        branch_name: cb.getAttribute('data-branch-name')
    }));
}

function selectAllBranches() {
    const checkboxes = document.querySelectorAll('#branchesCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    updateSelectedCount();
    showToast(`Selected ${checkboxes.length} branches`, 'success');
}

function deselectAllBranches() {
    const checkboxes = document.querySelectorAll('#branchesCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectedCount();
    showToast('Deselected all branches', 'info');
}

function openCreateUserModal(role) {
    selectedRole = role;
    isEditing = false;
    
    document.getElementById('editUserId').value = '';
    document.getElementById('createUserTitle').innerHTML = `<i class="fas fa-user-plus mr-2 text-blue-600"></i>Create ${role.toUpperCase()} User`;
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newFullname').value = '';
    document.getElementById('newEmail').value = '';
    document.getElementById('bitBranchCode').value = '';
    document.getElementById('bitBranchName').value = '';
    document.getElementById('ditDistrict').value = '';
    
    document.getElementById('ditFields').classList.add('hidden');
    document.getElementById('bitFields').classList.add('hidden');
    
    if (role === 'dit') {
        document.getElementById('ditFields').classList.remove('hidden');
        renderBranchesCheckboxes([]);
    } else if (role === 'bit') {
        document.getElementById('bitFields').classList.remove('hidden');
    }
    
    closeSelectUserTypeModal();
    document.getElementById('createUserModal').classList.remove('hidden');
}

async function editUser(userId) {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const user = users.find(u => u.id === userId);
        
        if (!user) { showToast('User not found', 'error'); return; }
        
        isEditing = true;
        selectedRole = user.role;
        document.getElementById('editUserId').value = userId;
        document.getElementById('createUserTitle').innerHTML = `<i class="fas fa-user-edit mr-2 text-blue-600"></i>Edit ${user.role.toUpperCase()} User`;
        document.getElementById('newUsername').value = user.username;
        document.getElementById('newFullname').value = user.fullname || '';
        document.getElementById('newEmail').value = user.email || '';
        document.getElementById('newPassword').value = '';
        
        document.getElementById('ditFields').classList.add('hidden');
        document.getElementById('bitFields').classList.add('hidden');
        
        if (user.role === 'dit') {
            document.getElementById('ditFields').classList.remove('hidden');
            document.getElementById('ditDistrict').value = user.district || '';
            let existingBranches = [];
            if (user.assigned_branches) {
                try { existingBranches = JSON.parse(user.assigned_branches); } catch(e) {}
            }
            renderBranchesCheckboxes(existingBranches);
        } else if (user.role === 'bit') {
            document.getElementById('bitFields').classList.remove('hidden');
            document.getElementById('bitBranchCode').value = user.branch_code || '';
            document.getElementById('bitBranchName').value = user.branch_name || '';
        }
        
        closeSelectUserTypeModal();
        document.getElementById('createUserModal').classList.remove('hidden');
    } catch (error) {
        showToast('Failed to load user data', 'error');
    }
}

// ========== REFRESH DIT BRANCHES ==========
async function refreshDitBranches() {
    if (currentUser && currentUser.role === 'dit') {
        await loadDitBranches();
        if (currentTab === 'dashboard' && typeof loadDashboard === 'function') {
            await loadDashboard();
        }
    }
}

// ========== INITIALIZE ==========
async function init() {
    console.log('Initializing application...');
    const userLoaded = await loadUserInfo();
    if (userLoaded) {
        await loadBitBranches();
        await loadBranchDropdown();
        await showTab('dashboard');
    }
}

// Make functions available globally
window.selectAllBranches = selectAllBranches;
window.deselectAllBranches = deselectAllBranches;
window.updateSelectedCount = updateSelectedCount;
window.editUser = editUser;
window.showTab = showTab;
window.openNewRequestModal = openNewRequestModal;
window.openSelectUserTypeModal = openSelectUserTypeModal;
window.openCreateUserModal = openCreateUserModal;
window.closeNewRequestModal = closeNewRequestModal;
window.closeDetailsModal = closeDetailsModal;
window.closeSelectUserTypeModal = closeSelectUserTypeModal;
window.closeCreateUserModal = closeCreateUserModal;
window.closeReceivedModal = closeReceivedModal;
window.closeDeployModal = closeDeployModal;
window.closeEditRequestModal = closeEditRequestModal;
window.checkPasswordStrength = checkPasswordStrength;
window.logout = logout;
window.toggleNewRequestTrfField = toggleNewRequestTrfField;
window.refreshDitBranches = refreshDitBranches;

// Start the app
document.addEventListener('DOMContentLoaded', init);