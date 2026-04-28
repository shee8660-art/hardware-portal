// ========== HARDWARE REQUESTS TAB ==========
async function loadRequestsView() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-4 text-gray-500">Loading requests...</p></div>';
    
    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`/api/hardware-requests?_=${timestamp}`);
        let requests = await res.json();
        allRequests = requests;
        
        const branches = {};
        requests.forEach(req => {
            const branchKey = req.branch_code || 'UNKNOWN';
            const branchName = req.branch_name || branchKey;
            if (!branches[branchKey]) {
                branches[branchKey] = { code: branchKey, name: branchName, count: 0 };
            }
            branches[branchKey].count++;
        });
        
        const branchesArray = Object.values(branches);
        const isAdmin = currentUser && currentUser.role === 'admin';
        
        if (branchesArray.length === 0) {
            container.innerHTML = `
                <div class="mb-6 flex justify-between items-center">
                    <div><h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-folder-open mr-2 text-blue-600"></i>Hardware Requests by Branch</h2><p class="text-sm text-gray-500 mt-1">Click on any folder to view requests for that branch</p></div>
                    ${isAdmin ? `<button onclick="openNewRequestModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition flex items-center"><i class="fas fa-plus mr-2"></i>Add New Request</button>` : ''}
                </div>
                <div class="bg-white rounded-lg shadow p-12 text-center"><i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i><p class="text-gray-500">No requests found.</p></div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <div><h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-folder-open mr-2 text-blue-600"></i>Hardware Requests by Branch</h2><p class="text-sm text-gray-500 mt-1">Click on any folder to view requests for that branch</p></div>
                ${isAdmin ? `<button onclick="openNewRequestModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition flex items-center"><i class="fas fa-plus mr-2"></i>Add New Request</button>` : ''}
            </div>
            <div id="folderView" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                ${branchesArray.map(branch => `
                    <div onclick="selectBranch('${branch.code}')" class="folder-card bg-white rounded-xl shadow-md p-6 text-center cursor-pointer hover:shadow-xl transition-all">
                        <div class="relative inline-block"><i class="fas fa-folder-open folder-icon text-5xl text-yellow-500"></i>${branch.count > 0 ? `<span class="folder-count absolute -top-2 -right-3">${branch.count}</span>` : ''}</div>
                        <h3 class="font-bold text-gray-800 mt-3">${escapeHtml(branch.name)}</h3>
                        <p class="text-xs text-gray-500">${escapeHtml(branch.code)}</p>
                        <p class="text-sm text-gray-600 mt-2">${branch.count} request${branch.count !== 1 ? 's' : ''}</p>
                    </div>
                `).join('')}
            </div>
            <div id="requestsListView" class="hidden mt-6">
                <div class="flex items-center justify-between mb-4"><button onclick="backToFolders()" class="text-blue-600 hover:text-blue-800 flex items-center"><i class="fas fa-arrow-left mr-2"></i> Back to Branches</button><h3 id="selectedBranchTitle" class="text-xl font-bold text-gray-800"></h3></div>
                <div id="branchRequestsList" class="space-y-3"></div>
            </div>
        `;
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div class="text-center py-8 text-red-500">Error loading requests</div>';
    }
}

function selectBranch(branchCode) {
    const branchRequests = allRequests.filter(req => (req.branch_code || 'UNKNOWN') === branchCode);
    let branchName = branchCode;
    for (const req of allRequests) {
        if (req.branch_code === branchCode && req.branch_name) {
            branchName = req.branch_name;
            break;
        }
    }
    
    const folderView = document.getElementById('folderView');
    const requestsListView = document.getElementById('requestsListView');
    const selectedBranchTitle = document.getElementById('selectedBranchTitle');
    const branchRequestsList = document.getElementById('branchRequestsList');
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isBit = currentUser && currentUser.role === 'bit';
    const isDit = currentUser && currentUser.role === 'dit';
    
    if (folderView) folderView.classList.add('hidden');
    if (requestsListView) requestsListView.classList.remove('hidden');
    if (selectedBranchTitle) {
        selectedBranchTitle.innerHTML = `<i class="fas fa-folder-open text-yellow-500 mr-2"></i>${escapeHtml(branchName)} (${branchRequests.length} requests)`;
    }
    
    if (branchRequestsList) {
        branchRequestsList.innerHTML = branchRequests.map(req => {
            // Received button ONLY appears when status is 'For Store Transfer'
            const showReceivedButton = (isBit || isDit) && req.status === 'For Store Transfer';
            // Deploy button appears when status is 'Received on Store'
            const showDeployButton = (isBit || isDit) && req.status === 'Received on Store';
            
            return `
                <div class="request-card bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-blue-300">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-2">
                                <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">${escapeHtml(req.ticket_no || 'N/A')}</span>
                                <span class="status-badge status-${req.status === 'Deployed on Store' ? 'deployed' : req.status === 'Received on Store' ? 'received' : 'pending'}">${escapeHtml(req.status)}</span>
                            </div>
                            <p class="font-semibold text-gray-800">${escapeHtml(req.asset_category)} - ${escapeHtml(req.brand)} ${escapeHtml(req.model)}</p>
                            <p class="text-sm text-gray-500">Serial: ${escapeHtml(req.serial_number)}</p>
                            <p class="text-xs text-gray-400 mt-1">Reported: ${new Date(req.created_at).toLocaleDateString()}</p>
                            <p class="text-xs text-gray-400">Remarks: ${escapeHtml(req.remarks || 'Pending')}</p>
                            ${req.trf_number ? `<p class="text-xs text-purple-500 mt-1">TRF #: ${escapeHtml(req.trf_number)}</p>` : ''}
                            ${req.received_photo ? `<p class="text-xs text-blue-500 mt-1"><i class="fas fa-image"></i> <a href="${req.received_photo}" target="_blank">View Receipt</a></p>` : ''}
                            ${req.execution_photo ? `<p class="text-xs text-green-500 mt-1"><i class="fas fa-image"></i> <a href="${req.execution_photo}" target="_blank">View Deployment Photo</a></p>` : ''}
                        </div>
                        <div class="action-buttons">
                            ${isAdmin ? `
                                <button onclick="editRequest(${req.id})" class="text-yellow-600 hover:text-yellow-800"><i class="fas fa-edit"></i> Edit</button>
                            ` : ''}
                            ${showReceivedButton ? `
                                <button onclick="openReceivedModal(${req.id})" class="btn-received"><i class="fas fa-check-circle"></i> Received</button>
                            ` : ''}
                            ${showDeployButton ? `
                                <button onclick="openDeployModal(${req.id})" class="btn-deploy"><i class="fas fa-rocket"></i> Deploy</button>
                            ` : ''}
                            <button onclick="showRequestDetails(${req.id})" class="text-gray-500 hover:text-gray-700"><i class="fas fa-info-circle"></i> Details</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function backToFolders() {
    const folderView = document.getElementById('folderView');
    const requestsListView = document.getElementById('requestsListView');
    if (folderView) folderView.classList.remove('hidden');
    if (requestsListView) requestsListView.classList.add('hidden');
}

function showRequestDetails(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailsContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Ticket Number</p><p class="font-semibold">${escapeHtml(request.ticket_no || 'N/A')}</p></div>
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Status</p><p class="font-semibold">${escapeHtml(request.status)}</p></div>
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Branch</p><p class="font-semibold">${escapeHtml(request.branch_name || request.branch_code)}</p></div>
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Date Reported</p><p class="font-semibold">${new Date(request.created_at).toLocaleDateString()}</p></div>
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Asset Category</p><p class="font-semibold">${escapeHtml(request.asset_category)}</p></div>
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Brand / Model</p><p class="font-semibold">${escapeHtml(request.brand)} ${escapeHtml(request.model)}</p></div>
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Serial Number</p><p class="font-semibold">${escapeHtml(request.serial_number)}</p></div>
                <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Remarks</p><p class="font-semibold">${escapeHtml(request.remarks || 'Pending')}</p></div>
                ${request.trf_number ? `<div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">TRF #</p><p class="font-semibold">${escapeHtml(request.trf_number)}</p></div>` : ''}
                ${request.received_date ? `<div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Received Date</p><p class="font-semibold">${new Date(request.received_date).toLocaleDateString()}</p></div>` : ''}
                ${request.deployed_date ? `<div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Deployed Date</p><p class="font-semibold">${new Date(request.deployed_date).toLocaleDateString()}</p></div>` : ''}
                ${request.rejection_reason ? `<div class="bg-red-50 p-3 rounded"><p class="text-xs text-red-600">Rejection Reason</p><p class="text-sm">${escapeHtml(request.rejection_reason)}</p></div>` : ''}
            </div>
            ${request.description ? `<div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Description</p><p class="text-sm">${escapeHtml(request.description)}</p></div>` : ''}
            ${request.received_photo ? `<div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Receipt Photo</p><a href="${request.received_photo}" target="_blank" class="text-blue-600">View Photo</a></div>` : ''}
            ${request.execution_photo ? `<div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Deployment Photo</p><a href="${request.execution_photo}" target="_blank" class="text-blue-600">View Photo</a></div>` : ''}
        </div>
    `;
    modal.classList.remove('hidden');
}

// ========== TOGGLE TRF FIELD IN EDIT MODAL ==========
function toggleEditTrfField() {
    const statusSelect = document.getElementById('editStatus');
    const trfField = document.getElementById('editTrfField');
    if (statusSelect && trfField) {
        if (statusSelect.value === 'For Store Transfer') {
            trfField.classList.remove('hidden');
        } else {
            trfField.classList.add('hidden');
        }
    }
}

// ========== EDIT REQUEST FUNCTION ==========
function editRequest(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showToast('Request not found', 'error');
        return;
    }
    
    document.getElementById('editRequestId').value = request.id;
    document.getElementById('editTicketNo').value = request.ticket_no || '';
    document.getElementById('editBranchCode').value = request.branch_code || '';
    document.getElementById('editBranchName').value = request.branch_name || '';
    document.getElementById('editAssetCategory').value = request.asset_category || '';
    document.getElementById('editBrand').value = request.brand || '';
    document.getElementById('editModel').value = request.model || '';
    document.getElementById('editSerialNumber').value = request.serial_number || '';
    document.getElementById('editHardwareAge').value = request.hardware_age || '';
    document.getElementById('editStatus').value = request.status || 'For DM Approval';
    document.getElementById('editRemarks').value = request.remarks || 'Pending';
    document.getElementById('editDescription').value = request.description || '';
    document.getElementById('editDateReported').value = request.date_reported ? request.date_reported.split('T')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('editTrfNumber').value = request.trf_number || '';
    
    // Show/hide TRF field based on status
    toggleEditTrfField();
    
    document.getElementById('editRequestModal').classList.remove('hidden');
}

// ========== SAVE EDIT REQUEST ==========
async function saveEditRequest() {
    const requestId = document.getElementById('editRequestId').value;
    const status = document.getElementById('editStatus').value;
    const trfNumber = document.getElementById('editTrfNumber').value;
    
    // Validate TRF number if status is For Store Transfer
    if (status === 'For Store Transfer' && (!trfNumber || trfNumber.trim() === '')) {
        showToast('TRF # is required when status is For Store Transfer', 'error');
        document.getElementById('editTrfNumber').focus();
        return;
    }
    
    const formData = {
        branch_code: document.getElementById('editBranchCode').value,
        branch_name: document.getElementById('editBranchName').value,
        asset_category: document.getElementById('editAssetCategory').value,
        brand: document.getElementById('editBrand').value,
        model: document.getElementById('editModel').value,
        serial_number: document.getElementById('editSerialNumber').value,
        hardware_age: document.getElementById('editHardwareAge').value,
        status: status,
        remarks: document.getElementById('editRemarks').value,
        description: document.getElementById('editDescription').value,
        date_reported: document.getElementById('editDateReported').value,
        trf_number: trfNumber
    };
    
    const required = ['branch_code', 'branch_name', 'asset_category', 'brand', 'model', 'serial_number'];
    const missing = required.filter(f => !formData[f]);
    if (missing.length) {
        showToast(`Please fill in: ${missing.join(', ')}`, 'error');
        return;
    }
    
    const btn = document.querySelector('#editRequestModal .bg-yellow-600');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/hardware-requests/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        
        if (data.success) {
            closeEditRequestModal();
            showToast('Request updated successfully!', 'success');
            if (typeof loadRequestsView === 'function') await loadRequestsView();
        } else {
            showToast(data.error || 'Failed to update', 'error');
        }
    } catch (error) {
        console.error('Edit error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ========== OPEN RECEIVED MODAL ==========
window.openReceivedModal = function(requestId) {
    console.log('Opening received modal for request:', requestId);
    document.getElementById('receivedRequestId').value = requestId;
    document.getElementById('receivedPhoto').value = '';
    const receivedPreview = document.getElementById('receivedPhotoPreview');
    if (receivedPreview) receivedPreview.classList.add('hidden');
    
    const ditBranchDiv = document.getElementById('ditBranchSelectDiv');
    if (currentUser && currentUser.role === 'dit') {
        if (ditBranchDiv) ditBranchDiv.classList.remove('hidden');
        const branchSelect = document.getElementById('receivedBranchSelect');
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">-- Select Branch --</option>';
            if (ditBranches && ditBranches.length > 0) {
                ditBranches.forEach(branch => {
                    branchSelect.innerHTML += `<option value="${branch.branch_code}">${branch.branch_code} - ${branch.branch_name}</option>`;
                });
            }
        }
    } else {
        if (ditBranchDiv) ditBranchDiv.classList.add('hidden');
    }
    
    const modal = document.getElementById('receivedModal');
    if (modal) modal.classList.remove('hidden');
};

// ========== OPEN DEPLOY MODAL ==========
window.openDeployModal = function(requestId) {
    console.log('Opening deploy modal for request:', requestId);
    const request = allRequests.find(r => r.id === requestId);
    
    document.getElementById('deployRequestId').value = requestId;
    document.getElementById('deployBrand').value = request?.brand || '';
    document.getElementById('deployModel').value = request?.model || '';
    document.getElementById('deploySerialNumber').value = request?.serial_number || '';
    document.getElementById('deploymentDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('deploymentPhoto').value = '';
    const deployPreview = document.getElementById('deployPhotoPreview');
    if (deployPreview) deployPreview.classList.add('hidden');
    
    const deployBranchDiv = document.getElementById('deployBranchSelectDiv');
    if (currentUser && currentUser.role === 'dit') {
        if (deployBranchDiv) deployBranchDiv.classList.remove('hidden');
        const branchCodeParent = document.getElementById('deployBranchCode')?.parentElement;
        const branchNameParent = document.getElementById('deployBranchName')?.parentElement;
        if (branchCodeParent) branchCodeParent.classList.add('hidden');
        if (branchNameParent) branchNameParent.classList.add('hidden');
        
        const branchSelect = document.getElementById('deployBranchSelect');
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">-- Select Branch --</option>';
            if (ditBranches && ditBranches.length > 0) {
                ditBranches.forEach(branch => {
                    branchSelect.innerHTML += `<option value="${branch.branch_code}|${branch.branch_name}">${branch.branch_code} - ${branch.branch_name}</option>`;
                });
            }
            
            branchSelect.onchange = function() {
                const [code, name] = this.value.split('|');
                if (code && name) {
                    document.getElementById('deployBranchCode').value = code;
                    document.getElementById('deployBranchName').value = name;
                }
            };
        }
    } else {
        if (deployBranchDiv) deployBranchDiv.classList.add('hidden');
        const branchCodeParent = document.getElementById('deployBranchCode')?.parentElement;
        const branchNameParent = document.getElementById('deployBranchName')?.parentElement;
        if (branchCodeParent) branchCodeParent.classList.remove('hidden');
        if (branchNameParent) branchNameParent.classList.remove('hidden');
        document.getElementById('deployBranchCode').value = request?.branch_code || '';
        document.getElementById('deployBranchName').value = request?.branch_name || '';
    }
    
    const modal = document.getElementById('deployModal');
    if (modal) modal.classList.remove('hidden');
};

// Make functions globally available
window.editRequest = editRequest;
window.saveEditRequest = saveEditRequest;
window.toggleEditTrfField = toggleEditTrfField;