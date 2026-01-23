// Settings section script for popup (not separate page)

let editingResumeId = null;
let currentPage = 1;
let totalPages = 1;
let selectedResumeIds = new Set();
let currentVersionsPage = 1;
let versionsTotalPages = 1;
let activeTab = 'resumes'; // 'resumes' or 'versions'
let selectedVersionIds = new Set();

// Helper function to safely handle Chrome storage operations
async function safeChromeStorage(operation, ...args) {
  try {
    // Check if chrome.runtime is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error('Extension context invalidated. Please close and reopen the popup.');
    }
    
    if (operation === 'get') {
      return await chrome.storage.local.get(...args);
    } else if (operation === 'set') {
      return await chrome.storage.local.set(...args);
    } else if (operation === 'remove') {
      return await chrome.storage.local.remove(...args);
    }
  } catch (error) {
    // Check if it's an invalidated context error
    if (error.message && error.message.includes('Extension context invalidated')) {
      throw new Error('Extension was reloaded. Please close and reopen the popup to continue.');
    }
    throw error;
  }
}

// Tab switching
const tabResumes = document.getElementById('tab-resumes');
const tabVersions = document.getElementById('tab-versions');
const tabResumesContent = document.getElementById('tab-resumes-content');
const tabVersionsContent = document.getElementById('tab-versions-content');

if (tabResumes && tabVersions) {
  tabResumes.addEventListener('click', () => {
    switchTab('resumes');
  });
  
  tabVersions.addEventListener('click', () => {
    switchTab('versions');
  });
}

window.switchTab = function(tab) {
  activeTab = tab;
  
  if (tab === 'resumes') {
    if (tabResumes) {
      tabResumes.classList.add('active');
      tabResumes.style.borderBottomColor = '#3b82f6';
      tabResumes.style.color = '#3b82f6';
    }
    if (tabVersions) {
      tabVersions.classList.remove('active');
      tabVersions.style.borderBottomColor = 'transparent';
      tabVersions.style.color = '#6b7280';
    }
    if (tabResumesContent) tabResumesContent.classList.remove('hidden');
    if (tabVersionsContent) tabVersionsContent.classList.add('hidden');
    
    // Load resumes if not already loaded
    if (document.getElementById('settings-resumes-tbody')?.children.length === 0) {
      window.loadSettingsResumes();
    }
  } else {
    if (tabVersions) {
      tabVersions.classList.add('active');
      tabVersions.style.borderBottomColor = '#3b82f6';
      tabVersions.style.color = '#3b82f6';
    }
    if (tabResumes) {
      tabResumes.classList.remove('active');
      tabResumes.style.borderBottomColor = 'transparent';
      tabResumes.style.color = '#6b7280';
    }
    if (tabVersionsContent) tabVersionsContent.classList.remove('hidden');
    if (tabResumesContent) tabResumesContent.classList.add('hidden');
    
    // Load versions
    window.loadSettingsVersions();
  }
};

// Load resumes for settings section
window.loadSettingsResumes = async function(page = 1) {
  try {
    currentPage = page;
    const response = await window.apiRequest(`/resumes?page=${page}&limit=10`, {
      method: 'GET',
    });

    if (response.success && response.data) {
      displaySettingsResumes(response.data.resumes || response.data, response.data.pagination);
      selectedResumeIds.clear();
      updateBulkDeleteButton();
    } else {
      showSettingsError('Failed to load resumes');
    }
  } catch (error) {
    console.error('Load resumes error:', error);
    showSettingsError('Failed to load resumes: ' + error.message);
  }
};

// Load resume versions for settings section
window.loadSettingsVersions = async function(page = 1) {
  try {
    currentVersionsPage = page;
    const response = await window.apiRequest(`/resume-versions?page=${page}&limit=10`, {
      method: 'GET',
    });

    if (response.success && response.data) {
      displaySettingsVersions(response.data.versions || response.data, response.data.pagination);
    } else {
      showSettingsError('Failed to load resume versions');
    }
  } catch (error) {
    console.error('Load versions error:', error);
    showSettingsError('Failed to load resume versions: ' + error.message);
  }
};

function displaySettingsResumes(resumes, pagination) {
  const table = document.getElementById('settings-resumes-table');
  const tbody = document.getElementById('settings-resumes-tbody');
  const emptyState = document.getElementById('settings-empty-state');
  const paginationContainer = document.getElementById('settings-pagination');

  if (!resumes || resumes.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyState) emptyState.classList.add('hidden');
  if (tbody) tbody.innerHTML = '';

  resumes.forEach(resume => {
    const row = createSettingsResumeRow(resume);
    if (tbody) tbody.appendChild(row);
  });

  // Update pagination
  if (pagination) {
    totalPages = pagination.totalPages || 1;
    updatePagination(pagination);
  }
}

function updatePagination(pagination) {
  const paginationContainer = document.getElementById('settings-pagination');
  const paginationInfo = document.getElementById('pagination-info');
  const prevBtn = document.getElementById('pagination-prev');
  const nextBtn = document.getElementById('pagination-next');

  if (paginationContainer) {
    paginationContainer.classList.remove('hidden');
  }

  if (paginationInfo) {
    const start = ((pagination.page - 1) * pagination.limit) + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total}`;
  }

  if (prevBtn) {
    prevBtn.disabled = !pagination.hasPrev;
    prevBtn.onclick = () => {
      if (pagination.hasPrev) {
        window.loadSettingsResumes(pagination.page - 1);
      }
    };
  }

  if (nextBtn) {
    nextBtn.disabled = !pagination.hasNext;
    nextBtn.onclick = () => {
      if (pagination.hasNext) {
        window.loadSettingsResumes(pagination.page + 1);
      }
    };
  }
}

function createSettingsResumeRow(resume) {
  const tr = document.createElement('tr');
  tr.className = resume.isDefault ? 'default-row' : '';
  tr.id = `settings-resume-${resume.resumeId}`;

  // Checkbox column
  const checkboxCell = document.createElement('td');
  checkboxCell.style.textAlign = 'center';
  if (!resume.isDefault) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = resume.resumeId;
    checkbox.style.cursor = 'pointer';
    checkbox.checked = selectedResumeIds.has(resume.resumeId);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedResumeIds.add(resume.resumeId);
      } else {
        selectedResumeIds.delete(resume.resumeId);
      }
      updateBulkDeleteButton();
      updateSelectAllCheckbox();
    });
    checkboxCell.appendChild(checkbox);
  }
  tr.appendChild(checkboxCell);

  // Default column
  const defaultCell = document.createElement('td');
  defaultCell.className = 'default-indicator';
  if (resume.isDefault) {
    const badge = document.createElement('span');
    badge.className = 'default-badge';
    badge.textContent = 'Default';
    defaultCell.appendChild(badge);
  } else {
    defaultCell.textContent = '—';
    defaultCell.style.color = '#9ca3af';
  }
  tr.appendChild(defaultCell);

  // Name column
  const nameCell = document.createElement('td');
  nameCell.className = 'resume-name-cell';
  if (editingResumeId === resume.resumeId) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-name-input';
    input.value = resume.displayName || resume.filename;
    input.placeholder = 'Resume name';
    input.style.width = '100%';
    input.style.maxWidth = '200px';
    input.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        await saveResumeName(resume.resumeId, input.value);
      } else if (e.key === 'Escape') {
        cancelEdit(resume.resumeId);
      }
    });
    input.addEventListener('blur', () => {
      cancelEdit(resume.resumeId);
    });
    nameCell.appendChild(input);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 10);
  } else {
    nameCell.textContent = resume.displayName || resume.filename;
  }
  tr.appendChild(nameCell);

  // Filename column
  const filenameCell = document.createElement('td');
  filenameCell.className = 'resume-filename-cell';
  filenameCell.textContent = resume.filename;
  tr.appendChild(filenameCell);

  // Uploaded date column
  const dateCell = document.createElement('td');
  dateCell.className = 'resume-date-cell';
  dateCell.textContent = formatDate(resume.uploadedAt);
  tr.appendChild(dateCell);

  // Actions column
  const actionsCell = document.createElement('td');
  actionsCell.className = 'resume-actions-cell';

  if (!resume.isDefault) {
    const setDefaultBtn = document.createElement('button');
    setDefaultBtn.className = 'icon-btn primary';
    setDefaultBtn.setAttribute('data-tooltip', 'Set as Default');
    setDefaultBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    `;
    setDefaultBtn.addEventListener('click', () => setDefaultResume(resume.resumeId));
    actionsCell.appendChild(setDefaultBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  if (editingResumeId === resume.resumeId) {
    editBtn.setAttribute('data-tooltip', 'Cancel');
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
  } else {
    editBtn.setAttribute('data-tooltip', 'Rename');
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
  }
  editBtn.addEventListener('click', () => {
    if (editingResumeId === resume.resumeId) {
      cancelEdit(resume.resumeId);
    } else {
      editResumeName(resume.resumeId);
    }
  });
  actionsCell.appendChild(editBtn);

  if (!resume.isDefault) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn danger';
    deleteBtn.setAttribute('data-tooltip', 'Delete');
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => deleteResume(resume.resumeId, resume.displayName || resume.filename));
    actionsCell.appendChild(deleteBtn);
  }

  tr.appendChild(actionsCell);

  return tr;
}

async function setDefaultResume(resumeId) {
  try {
    const response = await window.apiRequest('/set-default-resume', {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });

    if (response.success) {
      // Update local storage with the new default resume ID
      try {
        await safeChromeStorage('set', { resumeId: resumeId });
        
        // Also fetch and store resume info
        try {
          const resumeResponse = await window.apiRequest('/resume');
          if (resumeResponse.success && resumeResponse.data) {
            await safeChromeStorage('set', {
              resumeFilename: resumeResponse.data.filename,
              resumeCloudinaryUrl: resumeResponse.data.cloudinaryUrl,
              resumeUploadedAt: resumeResponse.data.uploadedAt,
            });
          }
        } catch (err) {
          console.warn('Failed to fetch resume info after setting default:', err);
        }
      } catch (storageError) {
        // If storage fails but API call succeeded, still show success but warn user
        console.warn('Storage update failed:', storageError);
        showSettingsError('Resume set as default, but please reload the popup to ensure changes are saved.');
        await window.loadSettingsResumes(currentPage);
        return;
      }
      
      await window.loadSettingsResumes(currentPage);
      showSettingsSuccess('Default resume updated successfully');
    } else {
      showSettingsError(response.error || 'Failed to set default resume');
    }
  } catch (error) {
    console.error('Set default error:', error);
    const errorMsg = error.message || 'Failed to set default resume';
    if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('Extension was reloaded')) {
      showSettingsError('Extension was reloaded. Please close and reopen the popup to continue.');
    } else {
      showSettingsError('Failed to set default resume: ' + errorMsg);
    }
  }
}

function editResumeName(resumeId) {
  editingResumeId = resumeId;
  window.loadSettingsResumes();
}

function cancelEdit(resumeId) {
  if (editingResumeId === resumeId) {
    editingResumeId = null;
    window.loadSettingsResumes();
  }
}

async function saveResumeName(resumeId, newName) {
  if (!newName || newName.trim().length === 0) {
    showSettingsError('Resume name cannot be empty');
    return;
  }

  const trimmedName = newName.trim();
  
  try {
    console.log('Saving resume name:', { resumeId, displayName: trimmedName });
    
    const response = await window.apiRequest('/update-resume-name', {
      method: 'POST',
      body: JSON.stringify({
        resumeId: resumeId,
        displayName: trimmedName,
      }),
    });

    console.log('Update response:', response);

    if (response.success) {
      editingResumeId = null;
      await window.loadSettingsResumes(currentPage);
      showSettingsSuccess('Resume name updated successfully');
    } else {
      showSettingsError(response.error || 'Failed to update resume name');
    }
  } catch (error) {
    console.error('Update name error:', error);
    showSettingsError('Failed to update resume name: ' + (error.message || String(error)));
  }
}

async function deleteResume(resumeId, displayName) {
  if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await window.apiRequest('/delete-resume', {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });

    if (response.success) {
      await window.loadSettingsResumes(currentPage);
      showSettingsSuccess(`"${displayName}" deleted successfully`);
    } else {
      showSettingsError(response.error || 'Failed to delete resume');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showSettingsError('Failed to delete resume: ' + error.message);
  }
}

function displaySettingsVersions(versions, pagination) {
  const table = document.getElementById('settings-versions-table');
  const tbody = document.getElementById('settings-versions-tbody');
  const emptyState = document.getElementById('settings-versions-empty-state');
  const paginationContainer = document.getElementById('versions-pagination');
  const bulkActions = document.getElementById('versions-bulk-actions');

  if (!versions || versions.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    if (bulkActions) bulkActions.classList.add('hidden');
    selectedVersionIds.clear();
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyState) emptyState.classList.add('hidden');
  if (tbody) tbody.innerHTML = '';

  versions.forEach(version => {
    const row = createSettingsVersionRow(version);
    if (tbody) tbody.appendChild(row);
  });

  // Update bulk actions and select all checkbox
  updateVersionsBulkDeleteButton();
  updateVersionsSelectAllCheckbox();

  // Update pagination
  if (pagination) {
    versionsTotalPages = pagination.totalPages || 1;
    updateVersionsPagination(pagination);
  }
}

function updateVersionsPagination(pagination) {
  const paginationContainer = document.getElementById('versions-pagination');
  const paginationInfo = document.getElementById('versions-pagination-info');
  const prevBtn = document.getElementById('versions-pagination-prev');
  const nextBtn = document.getElementById('versions-pagination-next');

  if (paginationContainer) {
    paginationContainer.classList.remove('hidden');
  }

  if (paginationInfo) {
    const start = ((pagination.page - 1) * pagination.limit) + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total}`;
  }

  if (prevBtn) {
    prevBtn.disabled = !pagination.hasPrev;
    prevBtn.onclick = () => {
      if (pagination.hasPrev) {
        window.loadSettingsVersions(pagination.page - 1);
      }
    };
  }

  if (nextBtn) {
    nextBtn.disabled = !pagination.hasNext;
    nextBtn.onclick = () => {
      if (pagination.hasNext) {
        window.loadSettingsVersions(pagination.page + 1);
      }
    };
  }
}

function createSettingsVersionRow(version) {
  const tr = document.createElement('tr');
  tr.id = `settings-version-${version.versionId}`;

  // Checkbox column
  const checkboxCell = document.createElement('td');
  checkboxCell.style.textAlign = 'center';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = version.versionId;
  checkbox.style.cursor = 'pointer';
  checkbox.checked = selectedVersionIds.has(version.versionId);
  checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      selectedVersionIds.add(version.versionId);
    } else {
      selectedVersionIds.delete(version.versionId);
    }
    updateVersionsBulkDeleteButton();
    updateVersionsSelectAllCheckbox();
  });
  checkboxCell.appendChild(checkbox);
  tr.appendChild(checkboxCell);

  // Resume column
  const resumeCell = document.createElement('td');
  resumeCell.style.fontWeight = '500';
  resumeCell.textContent = version.resumeName;
  tr.appendChild(resumeCell);

  // Version Name column
  const versionNameCell = document.createElement('td');
  versionNameCell.textContent = version.versionName;
  tr.appendChild(versionNameCell);

  // Status column
  const statusCell = document.createElement('td');
  if (version.isCurrent) {
    const currentBadge = document.createElement('span');
    currentBadge.className = 'default-badge';
    currentBadge.textContent = 'Current';
    currentBadge.style.background = '#10b981';
    statusCell.appendChild(currentBadge);
  } else {
    statusCell.textContent = '—';
    statusCell.style.color = '#9ca3af';
  }
  tr.appendChild(statusCell);

  // Created date column
  const createdCell = document.createElement('td');
  createdCell.textContent = formatDate(version.createdAt);
  tr.appendChild(createdCell);

  // Updated date column
  const updatedCell = document.createElement('td');
  updatedCell.textContent = formatDate(version.updatedAt);
  tr.appendChild(updatedCell);

  // Actions column
  const actionsCell = document.createElement('td');
  actionsCell.className = 'resume-actions-cell';

  // Promote to main button (only show if not already current)
  if (!version.isCurrent) {
    const promoteBtn = document.createElement('button');
    promoteBtn.className = 'icon-btn primary';
    promoteBtn.setAttribute('data-tooltip', 'Promote to Main Resume');
    promoteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    `;
    promoteBtn.addEventListener('click', () => promoteVersionToMain(version.versionId, version.versionName));
    actionsCell.appendChild(promoteBtn);
  }

  // Download buttons
  if (version.hasDocx || version.hasPdf) {
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'icon-btn';
    downloadBtn.setAttribute('data-tooltip', 'Download');
    downloadBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    downloadBtn.addEventListener('click', () => downloadVersion(version));
    actionsCell.appendChild(downloadBtn);
  }

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn danger';
  deleteBtn.setAttribute('data-tooltip', 'Delete');
  deleteBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  `;
  deleteBtn.addEventListener('click', () => deleteVersion(version.versionId, version.versionName));
  actionsCell.appendChild(deleteBtn);

  tr.appendChild(actionsCell);

  return tr;
}

async function promoteVersionToMain(versionId, versionName) {
  const displayName = versionName || `Version ${versionId}`;
  if (!confirm(`Are you sure you want to promote "${displayName}" to the main resume? This will replace the current main resume content.`)) {
    return;
  }

  try {
    const response = await window.apiRequest('/promote-version-to-main', {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    });

    if (response.success) {
      await window.loadSettingsVersions(currentVersionsPage);
      showSettingsSuccess(`"${displayName}" promoted to main resume successfully`);
    } else {
      showSettingsError(response.error || 'Failed to promote version');
    }
  } catch (error) {
    console.error('Promote version error:', error);
    showSettingsError('Failed to promote version: ' + error.message);
  }
}

async function downloadVersion(version) {
  try {
    // Use download URLs from version data
    const downloadUrls = version.downloadUrls || {};
    const docxUrl = downloadUrls.docx;
    const pdfUrl = downloadUrls.pdf;

    // Prefer PDF, fallback to DOCX
    const url = pdfUrl || docxUrl;
    if (url) {
      window.open(url, '_blank');
    } else {
      showSettingsError('Download URL not available for this version');
    }
  } catch (error) {
    console.error('Download version error:', error);
    showSettingsError('Failed to download version: ' + error.message);
  }
}

async function deleteVersion(versionId, versionName) {
  const displayName = versionName || `Version ${versionId}`;
  if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await window.apiRequest('/delete-resume-version', {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    });

    if (response.success) {
      selectedVersionIds.delete(versionId);
      await window.loadSettingsVersions(currentVersionsPage);
      showSettingsSuccess(`"${displayName}" deleted successfully`);
    } else {
      showSettingsError(response.error || 'Failed to delete version');
    }
  } catch (error) {
    console.error('Delete version error:', error);
    showSettingsError('Failed to delete version: ' + error.message);
  }
}

function updateVersionsBulkDeleteButton() {
  const bulkActions = document.getElementById('versions-bulk-actions');
  const selectedCount = document.getElementById('versions-selected-count');
  const bulkDeleteBtn = document.getElementById('versions-bulk-delete-btn');

  if (selectedVersionIds.size > 0) {
    if (bulkActions) bulkActions.classList.remove('hidden');
    if (selectedCount) {
      selectedCount.textContent = `${selectedVersionIds.size} version${selectedVersionIds.size > 1 ? 's' : ''} selected`;
    }
  } else {
    if (bulkActions) bulkActions.classList.add('hidden');
  }
}

function updateVersionsSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-versions-checkbox');
  if (!selectAllCheckbox) return;

  const checkboxes = document.querySelectorAll('#settings-versions-tbody input[type="checkbox"]');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  
  if (checkedCount === 0) {
    selectAllCheckbox.indeterminate = false;
    selectAllCheckbox.checked = false;
  } else if (checkedCount === checkboxes.length) {
    selectAllCheckbox.indeterminate = false;
    selectAllCheckbox.checked = true;
  } else {
    selectAllCheckbox.indeterminate = true;
  }
}

// Select all versions checkbox handler
const selectAllVersionsCheckbox = document.getElementById('select-all-versions-checkbox');
if (selectAllVersionsCheckbox) {
  selectAllVersionsCheckbox.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('#settings-versions-tbody input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
      const versionId = parseInt(checkbox.value);
      if (e.target.checked) {
        selectedVersionIds.add(versionId);
      } else {
        selectedVersionIds.delete(versionId);
      }
    });
    updateVersionsBulkDeleteButton();
  });
}

// Bulk delete versions handler
const versionsBulkDeleteBtn = document.getElementById('versions-bulk-delete-btn');
if (versionsBulkDeleteBtn) {
  versionsBulkDeleteBtn.addEventListener('click', async () => {
    if (selectedVersionIds.size === 0) return;

    const count = selectedVersionIds.size;
    if (!confirm(`Are you sure you want to delete ${count} version${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    const versionIds = Array.from(selectedVersionIds);
    let successCount = 0;
    let failCount = 0;

    for (const versionId of versionIds) {
      try {
        const response = await window.apiRequest('/delete-resume-version', {
          method: 'POST',
          body: JSON.stringify({ versionId }),
        });

        if (response.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Delete version error:', error);
        failCount++;
      }
    }

    if (successCount > 0) {
      selectedVersionIds.clear();
      await window.loadSettingsVersions(currentVersionsPage);
      
      if (failCount === 0) {
        showSettingsSuccess(`${successCount} version${successCount > 1 ? 's' : ''} deleted successfully`);
      } else {
        showSettingsError(`${successCount} deleted, ${failCount} failed`);
      }
    } else if (failCount > 0) {
      showSettingsError(`Failed to delete ${failCount} version${failCount > 1 ? 's' : ''}`);
    }
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function showSettingsError(message) {
  const uploadStatus = document.getElementById('settings-upload-status');
  if (uploadStatus) {
    uploadStatus.textContent = message;
    uploadStatus.className = 'upload-status error';
    uploadStatus.classList.remove('hidden');
    setTimeout(() => {
      uploadStatus.classList.add('hidden');
    }, 5000);
  } else {
    showToast(message, 'error');
  }
}

function showSettingsSuccess(message) {
  showToast(message, 'success');
}

// Toast notification system
function showToast(message, type = 'success') {
  // Remove existing toast if any
  const existingToast = document.getElementById('settings-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'settings-toast';
  toast.className = `settings-toast settings-toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon">
        ${type === 'success' 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
        }
      </svg>
      <span class="toast-message">${message}</span>
    </div>
  `;

  // Append to settings section or body
  const settingsSection = document.getElementById('settings-section');
  if (settingsSection) {
    settingsSection.appendChild(toast);
  } else {
    document.body.appendChild(toast);
  }

  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Hide and remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Bulk delete functions
function updateBulkDeleteButton() {
  const bulkActions = document.getElementById('bulk-actions');
  const selectedCount = document.getElementById('selected-count');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

  if (selectedResumeIds.size > 0) {
    if (bulkActions) bulkActions.classList.remove('hidden');
    if (selectedCount) {
      selectedCount.textContent = `${selectedResumeIds.size} resume${selectedResumeIds.size > 1 ? 's' : ''} selected`;
    }
  } else {
    if (bulkActions) bulkActions.classList.add('hidden');
  }
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  if (!selectAllCheckbox) return;

  const checkboxes = document.querySelectorAll('#settings-resumes-tbody input[type="checkbox"]');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  
  if (checkedCount === 0) {
    selectAllCheckbox.indeterminate = false;
    selectAllCheckbox.checked = false;
  } else if (checkedCount === checkboxes.length) {
    selectAllCheckbox.indeterminate = false;
    selectAllCheckbox.checked = true;
  } else {
    selectAllCheckbox.indeterminate = true;
  }
}

// Select all checkbox handler
const selectAllCheckbox = document.getElementById('select-all-checkbox');
if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('#settings-resumes-tbody input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
      const resumeId = checkbox.value;
      if (e.target.checked) {
        selectedResumeIds.add(resumeId);
      } else {
        selectedResumeIds.delete(resumeId);
      }
    });
    updateBulkDeleteButton();
  });
}

// Bulk delete handler
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
if (bulkDeleteBtn) {
  bulkDeleteBtn.addEventListener('click', async () => {
    if (selectedResumeIds.size === 0) return;

    const count = selectedResumeIds.size;
    if (!confirm(`Are you sure you want to delete ${count} resume${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    const resumeIds = Array.from(selectedResumeIds);
    let successCount = 0;
    let failCount = 0;

    for (const resumeId of resumeIds) {
      try {
        const response = await window.apiRequest('/delete-resume', {
          method: 'POST',
          body: JSON.stringify({ resumeId }),
        });

        if (response.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Delete error:', error);
        failCount++;
      }
    }

    if (successCount > 0) {
      selectedResumeIds.clear();
      await window.loadSettingsResumes(currentPage);
      
      if (failCount === 0) {
        showSettingsSuccess(`${successCount} resume${successCount > 1 ? 's' : ''} deleted successfully`);
      } else {
        showSettingsError(`${successCount} deleted, ${failCount} failed`);
      }
    } else if (failCount > 0) {
      showSettingsError(`Failed to delete ${failCount} resume${failCount > 1 ? 's' : ''}`);
    }
  });
}

// Settings upload handler
const settingsUploadBox = document.getElementById('settings-upload-box');
const settingsResumeFile = document.getElementById('settings-resume-file');
const settingsUploadStatus = document.getElementById('settings-upload-status');

if (settingsUploadBox && settingsResumeFile) {
  settingsUploadBox.addEventListener('click', () => {
    settingsResumeFile.click();
  });

  settingsResumeFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      showSettingsError('Invalid file type. Only PDF and DOCX files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showSettingsError('File size exceeds 5MB limit.');
      return;
    }

    // Show uploading status
    if (settingsUploadStatus) {
      settingsUploadStatus.textContent = 'Uploading...';
      settingsUploadStatus.className = 'upload-status';
      settingsUploadStatus.classList.remove('hidden');
    }

    try {
      const formData = new FormData();
      formData.append('resume', file);

      // Safely get auth token from storage
      let authToken;
      try {
        const storage = await safeChromeStorage('get', ['authToken']);
        authToken = storage.authToken;
      } catch (storageError) {
        console.error('Failed to get auth token:', storageError);
        showSettingsError('Extension was reloaded. Please close and reopen the popup to continue.');
        if (settingsUploadStatus) {
          settingsUploadStatus.classList.add('hidden');
        }
        return;
      }

      if (!authToken) {
        showSettingsError('Not authenticated. Please log in again.');
        if (settingsUploadStatus) {
          settingsUploadStatus.classList.add('hidden');
        }
        return;
      }

      const apiUrl = window.getApiBaseUrl() + '/upload-resume';
      
      let url = apiUrl;
      if (url.includes('ngrok')) {
        url += (url.includes('?') ? '&' : '?') + 'ngrok-skip-browser-warning=true';
      }

      const headers = {
        'Authorization': `Bearer ${authToken}`,
      };
      
      if (url.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error('API returned HTML instead of JSON');
      }

      if (data.success) {
        if (settingsUploadStatus) {
          settingsUploadStatus.textContent = 'Resume uploaded successfully!';
          settingsUploadStatus.className = 'upload-status success';
        }
        
        // Clear file input
        settingsResumeFile.value = '';
        
        // Reload resumes list
        setTimeout(() => {
          window.loadSettingsResumes();
          if (settingsUploadStatus) {
            settingsUploadStatus.classList.add('hidden');
          }
        }, 1500);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showSettingsError('Failed to upload resume: ' + error.message);
    }
  });
}
