// ========== DEPLOYED UNITS TAB ==========
async function loadDeployedUnits() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-4 text-gray-500">Loading deployed units...</p></div>';
    
    try {
        const res = await fetch('/api/deployed-units');
        let units = await res.json();
        deployedUnits = units;
        
        if (units.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-lg shadow p-12 text-center">
                    <i class="fas fa-box-open text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">No deployed units found.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b bg-gradient-to-r from-green-50">
                    <h2 class="text-xl font-bold"><i class="fas fa-check-circle mr-2 text-green-600"></i>Deployed Hardware Units</h2>
                    <p class="text-sm text-gray-500 mt-1">List of all successfully deployed hardware</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand/Model</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial #</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deployment Date</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comment</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${units.map(unit => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-6 py-4 text-sm font-mono">${escapeHtml(unit.ticket_no)}</td>
                                    <td class="px-6 py-4 text-sm">${escapeHtml(unit.branch_name || unit.branch_code)}</td>
                                    <td class="px-6 py-4 text-sm">${escapeHtml(unit.brand)} ${escapeHtml(unit.model)}</td>
                                    <td class="px-6 py-4 text-sm font-mono">${escapeHtml(unit.serial_number)}</td>
                                    <td class="px-6 py-4 text-sm">${new Date(unit.deployment_date).toLocaleDateString()}</td>
                                    <td class="px-6 py-4 text-sm">
                                        ${unit.average_grade ? 
                                            `<span class="px-2 py-1 rounded-full text-xs font-semibold ${unit.average_grade >= 75 ? 'bg-green-100 text-green-800' : unit.average_grade >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">${unit.average_grade}%</span>` : 
                                            currentUser.role === 'admin' ? 
                                            '<button onclick="openGradeModal(' + unit.id + ')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-star"></i> Add Grade</button>' : 
                                            '<span class="text-gray-400">Pending</span>'}
                                    </td>
                                    <td class="px-6 py-4 text-sm max-w-xs">
                                        ${unit.grade_comment ? `<span class="text-gray-600 text-xs">${escapeHtml(unit.grade_comment.substring(0, 50))}${unit.grade_comment.length > 50 ? '...' : ''}</span>` : '-'}
                                    </td>
                                    <td class="px-6 py-4 text-sm">
                                        ${unit.deployment_photo ? `<a href="${unit.deployment_photo}" target="_blank" class="text-blue-600 hover:underline">View Photo</a>` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading deployed units:', error);
        container.innerHTML = '<div class="text-center py-8 text-red-500">Error loading deployed units</div>';
    }
}

// ========== GRADE MODAL WITH COMMENT ==========
function openGradeModal(unitId) {
    document.getElementById('gradeUnitId').value = unitId;
    document.getElementById('timelinessGrade').value = '';
    document.getElementById('deploymentGrade').value = '';
    document.getElementById('gradeComment').value = '';
    document.getElementById('gradeModal').classList.remove('hidden');
}

function closeGradeModal() {
    document.getElementById('gradeModal').classList.add('hidden');
}

async function submitGrade() {
    const unitId = document.getElementById('gradeUnitId').value;
    const timelinessGrade = parseInt(document.getElementById('timelinessGrade').value);
    const deploymentGrade = parseInt(document.getElementById('deploymentGrade').value);
    const comment = document.getElementById('gradeComment').value;
    
    if (isNaN(timelinessGrade) || timelinessGrade < 1 || timelinessGrade > 100) {
        showToast('Timeliness grade must be between 1 and 100', 'error');
        return;
    }
    
    if (isNaN(deploymentGrade) || deploymentGrade < 1 || deploymentGrade > 100) {
        showToast('Deployment grade must be between 1 and 100', 'error');
        return;
    }
    
    if (!comment || comment.trim() === '') {
        showToast('Please add a comment before grading', 'error');
        document.getElementById('gradeComment').focus();
        return;
    }
    
    const btn = document.querySelector('#gradeModal button[type="button"]:last-child');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/deployed-units/${unitId}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                timeliness_grade: timelinessGrade, 
                deployment_grade: deploymentGrade,
                comment: comment
            })
        });
        const data = await res.json();
        
        if (data.success) {
            closeGradeModal();
            showToast(`Grade added! Average: ${data.average_grade}%`, 'success');
            await loadDeployedUnits();
            if (currentUser.role === 'bit' && typeof loadDashboard === 'function') {
                await loadDashboard();
            }
        } else {
            showToast(data.error || 'Failed to add grade', 'error');
        }
    } catch (error) {
        console.error('Grade error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Make functions globally available
window.openGradeModal = openGradeModal;
window.closeGradeModal = closeGradeModal;
window.submitGrade = submitGrade;