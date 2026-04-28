// ========== CATEGORIES TAB ==========
async function loadCategories() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-4 text-gray-500">Loading categories...</p></div>';
    
    try {
        const res = await fetch('/api/asset-categories');
        const categories = await res.json();
        
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50">
                    <h2 class="text-xl font-bold"><i class="fas fa-tags mr-2 text-blue-600"></i>Asset Categories</h2>
                </div>
                <div class="p-6">
                    <form id="addCategoryForm" class="flex gap-4 mb-8">
                        <input type="text" id="newCategory" placeholder="New Category Name" required class="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add Category</button>
                    </form>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        ${categories.map(c => `
                            <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <span>${escapeHtml(c.category_name)}</span>
                                <button onclick="deleteCategory(${c.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        const addCategoryForm = document.getElementById('addCategoryForm');
        if (addCategoryForm) {
            addCategoryForm.addEventListener('submit', addCategory);
        }
    } catch (error) {
        console.error('Categories error:', error);
        container.innerHTML = '<div class="text-center py-8 text-red-500">Error loading categories</div>';
    }
}

async function addCategory(e) {
    e.preventDefault();
    const newCategory = document.getElementById('newCategory');
    const category_name = newCategory?.value || '';
    
    if (!category_name) {
        showToast('Please enter a category name', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/asset-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_name })
        });
        
        if (res.ok) {
            showToast('Category added!', 'success');
            if (newCategory) newCategory.value = '';
            await loadCategories();
        } else {
            showToast('Failed to add category', 'error');
        }
    } catch (error) {
        console.error('Add category error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    
    try {
        const res = await fetch(`/api/asset-categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Category deleted!', 'success');
            await loadCategories();
        } else {
            showToast('Failed to delete category', 'error');
        }
    } catch (error) {
        console.error('Delete category error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}