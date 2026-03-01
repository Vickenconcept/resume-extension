// Settings section script for popup (not separate page)
let currentPage = 1;
let totalPages = 1;
let selectedResumeIds = new Set();
let currentVersionsPage = 1;
let versionsTotalPages = 1;
let activeTab = 'resumes'; // 'resumes' or 'versions'
let currentFeedbackPage = 1;
let feedbackTotalPages = 1;
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
  
  // Reset all tabs
  [tabResumes, tabVersions].forEach(t => {
    if (t) {
      t.classList.remove('active');
      t.style.borderBottomColor = 'transparent';
      t.style.color = '#6b7280';
    }
  });
  
  [tabResumesContent, tabVersionsContent].forEach(c => {
    if (c) c.classList.add('hidden');
  });
  
  if (tab === 'resumes') {
    if (tabResumes) {
      tabResumes.classList.add('active');
      tabResumes.style.borderBottomColor = '#3b82f6';
      tabResumes.style.color = '#3b82f6';
    }
    if (tabResumesContent) tabResumesContent.classList.remove('hidden');
    
    // Load resumes if not already loaded
    if (document.getElementById('settings-resumes-tbody')?.children.length === 0) {
      window.loadSettingsResumes();
    }
  } else if (tab === 'versions') {
    if (tabVersions) {
      tabVersions.classList.add('active');
      tabVersions.style.borderBottomColor = '#3b82f6';
      tabVersions.style.color = '#3b82f6';
    }
    if (tabVersionsContent) tabVersionsContent.classList.remove('hidden');
    
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

  const paginationContainerTop = document.getElementById('settings-pagination-top');

  if (!resumes || resumes.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    if (paginationContainerTop) paginationContainerTop.classList.add('hidden');
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyState) emptyState.classList.add('hidden');
  if (tbody) tbody.innerHTML = '';

  // Ensure only one resume is marked as default (safety check)
  const defaultResumes = resumes.filter(r => r.isDefault);
  if (defaultResumes.length > 1) {
    console.warn('Multiple resumes marked as default, keeping only the first one');
    // Keep only the first one as default in the UI
    resumes.forEach((resume, index) => {
      if (index > 0) {
        resume.isDefault = false;
      }
    });
  }

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
  // Bottom pagination
  const paginationContainer = document.getElementById('settings-pagination');
  const paginationInfo = document.getElementById('pagination-info');
  const prevBtn = document.getElementById('pagination-prev');
  const nextBtn = document.getElementById('pagination-next');

  // Top pagination
  const paginationContainerTop = document.getElementById('settings-pagination-top');
  const paginationInfoTop = document.getElementById('pagination-info-top');
  const prevBtnTop = document.getElementById('pagination-prev-top');
  const nextBtnTop = document.getElementById('pagination-next-top');

  const paginationText = `Showing ${((pagination.page - 1) * pagination.limit) + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`;
  const handlePrev = () => {
    if (pagination.hasPrev) {
      window.loadSettingsResumes(pagination.page - 1);
    }
  };
  const handleNext = () => {
    if (pagination.hasNext) {
      window.loadSettingsResumes(pagination.page + 1);
    }
  };

  // Update bottom pagination
  if (paginationContainer) {
    paginationContainer.classList.remove('hidden');
  }
  if (paginationInfo) {
    paginationInfo.textContent = paginationText;
  }
  if (prevBtn) {
    prevBtn.disabled = !pagination.hasPrev;
    prevBtn.onclick = handlePrev;
      }
  if (nextBtn) {
    nextBtn.disabled = !pagination.hasNext;
    nextBtn.onclick = handleNext;
  }

  // Update top pagination
  if (paginationContainerTop) {
    paginationContainerTop.classList.remove('hidden');
  }
  if (paginationInfoTop) {
    paginationInfoTop.textContent = paginationText;
  }
  if (prevBtnTop) {
    prevBtnTop.disabled = !pagination.hasPrev;
    prevBtnTop.onclick = handlePrev;
      }
  if (nextBtnTop) {
    nextBtnTop.disabled = !pagination.hasNext;
    nextBtnTop.onclick = handleNext;
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

  // Name column (with Default tag and uploaded date tag)
  const nameCell = document.createElement('td');
  nameCell.className = 'resume-name-cell';
  nameCell.style.fontWeight = '600';
  nameCell.style.fontSize = '12px';
  
  // Create container for resume name and tags
  const nameContainer = document.createElement('div');
  nameContainer.style.display = 'flex';
  nameContainer.style.alignItems = 'center';
  nameContainer.style.gap = '6px';
  nameContainer.style.flexWrap = 'wrap';
  
  const resumeName = document.createElement('span');
  resumeName.textContent = resume.displayName || resume.filename;
  nameContainer.appendChild(resumeName);
  
  // Create Default tag if this is the default resume
  if (resume.isDefault) {
    const defaultTag = document.createElement('span');
    defaultTag.textContent = 'Default';
    defaultTag.style.fontSize = '10px';
    defaultTag.style.color = '#3b82f6';
    defaultTag.style.backgroundColor = '#dbeafe';
    defaultTag.style.padding = '2px 6px';
    defaultTag.style.borderRadius = '4px';
    defaultTag.style.fontWeight = '500';
    defaultTag.style.whiteSpace = 'nowrap';
    nameContainer.appendChild(defaultTag);
  }

  // Create uploaded date tag
  const dateTag = document.createElement('span');
  dateTag.textContent = formatDate(resume.uploadedAt);
  dateTag.style.fontSize = '10px';
  dateTag.style.color = '#6b7280';
  dateTag.style.backgroundColor = '#f3f4f6';
  dateTag.style.padding = '2px 6px';
  dateTag.style.borderRadius = '4px';
  dateTag.style.fontWeight = '400';
  dateTag.style.whiteSpace = 'nowrap';
  nameContainer.appendChild(dateTag);
  
  nameCell.appendChild(nameContainer);
  tr.appendChild(nameCell);

  // Actions column
  const actionsCell = document.createElement('td');
  actionsCell.className = 'resume-actions-cell';
  actionsCell.style.position = 'relative';

  // Preview button (eye icon) - always visible
  if (resume.cloudinaryUrl) {
    const previewBtn = document.createElement('button');
    previewBtn.className = 'icon-btn';
    previewBtn.setAttribute('data-tooltip', 'Preview');
    previewBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    previewBtn.addEventListener('click', async () => {
      await previewResume(resume);
    });
    actionsCell.appendChild(previewBtn);
  }

  // Dropdown menu button (three dots)
  const menuBtn = document.createElement('button');
  menuBtn.className = 'icon-btn menu-trigger';
  menuBtn.setAttribute('data-tooltip', 'More actions');
  menuBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="12" cy="5" r="1"></circle>
      <circle cx="12" cy="19" r="1"></circle>
    </svg>
  `;

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'actions-dropdown hidden';
  dropdown.innerHTML = `
    <div class="dropdown-content">
      ${!resume.isDefault ? `
        <button class="dropdown-item" data-action="set-default">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span>Set as Default</span>
        </button>
      ` : ''}
      <button class="dropdown-item" data-action="edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>Rename</span>
      </button>
      ${!resume.isDefault ? `
        <button class="dropdown-item danger" data-action="delete">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
          <span>Delete</span>
        </button>
      ` : ''}
    </div>
  `;

  // Handle dropdown item clicks
  dropdown.addEventListener('click', async (e) => {
    const action = e.target.closest('.dropdown-item')?.dataset.action;
    if (!action) return;

    dropdown.classList.add('hidden');
    actionsCell.classList.remove('dropdown-open');
    const parentRow = actionsCell.closest('tr');
    if (parentRow) parentRow.classList.remove('dropdown-open');
    
    if (action === 'set-default') {
      await setDefaultResume(resume.resumeId);
    } else if (action === 'edit') {
      editResumeName(resume.resumeId);
    } else if (action === 'delete') {
        await deleteResume(resume.resumeId, resume.displayName || resume.filename);
    }
  });

  // Toggle dropdown
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close all other dropdowns
    document.querySelectorAll('.actions-dropdown').forEach(d => {
      if (d !== dropdown) {
        d.classList.add('hidden');
        // Remove dropdown-open class from parent action cell and row
        const parentCell = d.closest('.resume-actions-cell');
        if (parentCell) parentCell.classList.remove('dropdown-open');
        const parentRow = parentCell?.closest('tr');
        if (parentRow) parentRow.classList.remove('dropdown-open');
      }
    });
    
    const isOpening = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    
    // Add/remove dropdown-open class to ensure proper z-index
    if (isOpening) {
      actionsCell.classList.add('dropdown-open');
      const parentRow = actionsCell.closest('tr');
      if (parentRow) parentRow.classList.add('dropdown-open');
    } else {
      actionsCell.classList.remove('dropdown-open');
      const parentRow = actionsCell.closest('tr');
      if (parentRow) parentRow.classList.remove('dropdown-open');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
      dropdown.classList.add('hidden');
      actionsCell.classList.remove('dropdown-open');
      const parentRow = actionsCell.closest('tr');
      if (parentRow) parentRow.classList.remove('dropdown-open');
  }
  });

  actionsCell.appendChild(menuBtn);
  actionsCell.appendChild(dropdown);
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
  const resumeRow = document.querySelector(`#settings-resume-${resumeId}`);
  if (!resumeRow) return;

  const nameCell = resumeRow.querySelector('.resume-name-cell');
  if (!nameCell || nameCell.querySelector('input')) return; // Already editing

  const currentName = nameCell.textContent || '';

  // Create container for input and check icon
  const editContainer = document.createElement('div');
  editContainer.className = 'inline-edit-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'inline-edit-input';

  // Create check icon button
  const checkButton = document.createElement('button');
  checkButton.className = 'inline-edit-check';
  checkButton.innerHTML = '✓';
  checkButton.title = 'Save changes';

  editContainer.appendChild(input);
  editContainer.appendChild(checkButton);

  // Replace cell content with edit container
  nameCell.innerHTML = '';
  nameCell.appendChild(editContainer);
  input.focus();
  input.select();

  const finishEdit = async (save = false) => {
    const newName = input.value.trim();
    if (save && newName && newName !== currentName) {
      // Save the new name
      await saveResumeName(resumeId, newName);
    } else {
      // Cancel - restore original content
      nameCell.textContent = currentName;
    }
  };

  // Show/hide check button based on input changes
  input.addEventListener('input', () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      checkButton.classList.add('show');
    } else {
      checkButton.classList.remove('show');
    }
  });

  // Handle check button click
  checkButton.addEventListener('click', async () => {
    setButtonLoading(checkButton, true);
    try {
      await finishEdit(true);
    } finally {
      setButtonLoading(checkButton, false);
    }
  });

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finishEdit(false);
    }
    // Removed Enter key handling for saving
  });

  // Removed auto-save on blur
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
      // editingResumeId = null; // No longer needed with inline editing
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
  const paginationContainerTop = document.getElementById('versions-pagination-top');
  const bulkActions = document.getElementById('versions-bulk-actions');

  if (!versions || versions.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    if (paginationContainerTop) paginationContainerTop.classList.add('hidden');
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
  // Bottom pagination
  const paginationContainer = document.getElementById('versions-pagination');
  const paginationInfo = document.getElementById('versions-pagination-info');
  const prevBtn = document.getElementById('versions-pagination-prev');
  const nextBtn = document.getElementById('versions-pagination-next');

  // Top pagination
  const paginationContainerTop = document.getElementById('versions-pagination-top');
  const paginationInfoTop = document.getElementById('versions-pagination-info-top');
  const prevBtnTop = document.getElementById('versions-pagination-prev-top');
  const nextBtnTop = document.getElementById('versions-pagination-next-top');

  const paginationText = `Showing ${((pagination.page - 1) * pagination.limit) + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`;
  const handlePrev = () => {
    if (pagination.hasPrev) {
      window.loadSettingsVersions(pagination.page - 1);
    }
  };
  const handleNext = () => {
    if (pagination.hasNext) {
      window.loadSettingsVersions(pagination.page + 1);
    }
  };

  // Update bottom pagination
  if (paginationContainer) {
    paginationContainer.classList.remove('hidden');
  }
  if (paginationInfo) {
    paginationInfo.textContent = paginationText;
  }
  if (prevBtn) {
    prevBtn.disabled = !pagination.hasPrev;
    prevBtn.onclick = handlePrev;
      }
  if (nextBtn) {
    nextBtn.disabled = !pagination.hasNext;
    nextBtn.onclick = handleNext;
  }

  // Update top pagination
  if (paginationContainerTop) {
    paginationContainerTop.classList.remove('hidden');
  }
  if (paginationInfoTop) {
    paginationInfoTop.textContent = paginationText;
  }
  if (prevBtnTop) {
    prevBtnTop.disabled = !pagination.hasPrev;
    prevBtnTop.onclick = handlePrev;
      }
  if (nextBtnTop) {
    nextBtnTop.disabled = !pagination.hasNext;
    nextBtnTop.onclick = handleNext;
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

  // Resume column (with created date tag)
  const resumeCell = document.createElement('td');
  resumeCell.style.fontWeight = '600';
  resumeCell.style.fontSize = '12px';
  
  // Create container for resume name and date tag
  const resumeContainer = document.createElement('div');
  resumeContainer.style.display = 'flex';
  resumeContainer.style.alignItems = 'center';
  resumeContainer.style.gap = '6px';
  resumeContainer.style.flexWrap = 'wrap';
  
  const resumeName = document.createElement('span');
  resumeName.textContent = version.resumeName;
  resumeContainer.appendChild(resumeName);
  
  // Create small date tag
  const dateTag = document.createElement('span');
  dateTag.textContent = formatDate(version.createdAt);
  dateTag.style.fontSize = '10px';
  dateTag.style.color = '#6b7280';
  dateTag.style.backgroundColor = '#f3f4f6';
  dateTag.style.padding = '2px 6px';
  dateTag.style.borderRadius = '4px';
  dateTag.style.fontWeight = '400';
  dateTag.style.whiteSpace = 'nowrap';
  resumeContainer.appendChild(dateTag);
  
  resumeCell.appendChild(resumeContainer);
  tr.appendChild(resumeCell);

  // Version Name column
  const versionNameCell = document.createElement('td');
  versionNameCell.textContent = version.versionName;
  versionNameCell.style.fontWeight = '600';
  versionNameCell.style.fontSize = '12px';
  tr.appendChild(versionNameCell);

  // Actions column
  const actionsCell = document.createElement('td');
  actionsCell.className = 'resume-actions-cell';
  actionsCell.style.position = 'relative';

  if (version.cloudinaryUrl) {
    const previewBtn = document.createElement('button');
    previewBtn.className = 'icon-btn';
    previewBtn.setAttribute('data-tooltip', 'Preview');
    previewBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    previewBtn.addEventListener('click', async () => {
      await previewResume({
        cloudinaryUrl: version.cloudinaryUrl,
        displayName: version.versionName,
        filename: version.resumeFilename,
        resumeId: version.resumeId,
      });
    });
    actionsCell.appendChild(previewBtn);
  }

  // Dropdown menu button (three dots)
  const menuBtn = document.createElement('button');
  menuBtn.className = 'icon-btn menu-trigger';
  menuBtn.setAttribute('data-tooltip', 'More actions');
  menuBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="12" cy="5" r="1"></circle>
      <circle cx="12" cy="19" r="1"></circle>
    </svg>
  `;

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'actions-dropdown hidden';
  dropdown.innerHTML = `
    <div class="dropdown-content">
      ${!version.isCurrent ? `
        <button class="dropdown-item" data-action="promote">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span>Promote to Main</span>
        </button>
      ` : ''}
      <button class="dropdown-item danger" data-action="delete">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
        <span>Delete</span>
      </button>
    </div>
  `;

  // Handle dropdown item clicks
  dropdown.addEventListener('click', async (e) => {
    const action = e.target.closest('.dropdown-item')?.dataset.action;
    if (!action) return;

    dropdown.classList.add('hidden');
    actionsCell.classList.remove('dropdown-open');
    const parentRow = actionsCell.closest('tr');
    if (parentRow) parentRow.classList.remove('dropdown-open');
    
    if (action === 'promote') {
      await promoteVersionToMain(version.versionId, version.versionName);
    } else if (action === 'delete') {
      await deleteVersion(version.versionId, version.versionName);
    }
  });

  // Toggle dropdown
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close all other dropdowns
    document.querySelectorAll('.actions-dropdown').forEach(d => {
      if (d !== dropdown) {
        d.classList.add('hidden');
        // Remove dropdown-open class from parent action cell and row
        const parentCell = d.closest('.resume-actions-cell');
        if (parentCell) parentCell.classList.remove('dropdown-open');
        const parentRow = parentCell?.closest('tr');
        if (parentRow) parentRow.classList.remove('dropdown-open');
      }
    });
    
    const isOpening = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    
    // Add/remove dropdown-open class to ensure proper z-index
    if (isOpening) {
      actionsCell.classList.add('dropdown-open');
      const parentRow = actionsCell.closest('tr');
      if (parentRow) parentRow.classList.add('dropdown-open');
    } else {
      actionsCell.classList.remove('dropdown-open');
      const parentRow = actionsCell.closest('tr');
      if (parentRow) parentRow.classList.remove('dropdown-open');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
      dropdown.classList.add('hidden');
      actionsCell.classList.remove('dropdown-open');
      const parentRow = actionsCell.closest('tr');
      if (parentRow) parentRow.classList.remove('dropdown-open');
    }
  });

  actionsCell.appendChild(menuBtn);
  actionsCell.appendChild(dropdown);

  tr.appendChild(actionsCell);

  return tr;
}

async function promoteVersionToMain(versionId, versionName) {
  const displayName = versionName || `Version ${versionId}`;
  if (!confirm(`Are you sure you want to promote "${displayName}" to a new resume? This will create a new resume document from this version.`)) {
    return;
  }

  try {
    const response = await window.apiRequest('/promote-version-to-main', {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    });

    if (response.success) {
      await window.loadSettingsVersions(currentVersionsPage);
      // Also reload the resumes list since a new resume was created
      if (window.loadSettingsResumes) {
        await window.loadSettingsResumes(currentPage);
      }
      showSettingsSuccess(`"${displayName}" promoted to new resume successfully`);
    } else {
      showSettingsError(response.error || 'Failed to promote version');
    }
  } catch (error) {
    console.error('Promote version error:', error);
    showSettingsError('Failed to promote version: ' + error.message);
  }
}


async function previewResume(resume) {
  try {
    const url = resume.cloudinaryUrl;
    if (!url || typeof url !== 'string' || url.trim() === '') {
      console.error('Invalid or missing cloudinaryUrl:', { resume });
      showSettingsError('Preview URL not available for this resume');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      console.error('Invalid URL format:', url);
      showSettingsError('Invalid preview URL format');
      return;
    }


    // Determine file type and choose preview method
    let previewUrl = url;
    const isPdf = url.includes('.pdf') || url.endsWith('.pdf') || url.toLowerCase().includes('pdf');
    const isDocx = url.includes('.docx') || url.endsWith('.docx') || url.toLowerCase().includes('docx');
    
    if (isPdf) {
      // For PDFs, try direct URL first (browsers can display PDFs natively)
      // If that doesn't work, fallback to Google Docs viewer
      previewUrl = url;
    } else if (isDocx) {
      // For DOCX, use Google Docs viewer
      previewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    } else {
      // Unknown type, try Google Docs viewer
      previewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }


    // Show preview overlay
    const overlay = document.getElementById('document-preview-overlay');
    const iframe = document.getElementById('document-preview-iframe');
    const title = document.getElementById('document-preview-title');
    const closeBtn = document.getElementById('document-preview-close');
    const previewContent = document.querySelector('.document-preview-content');

    if (!overlay || !iframe || !title) {
      console.error('Preview overlay elements not found');
      // Fallback: open in new tab if overlay elements not found
      window.open(url, '_blank');
      return;
    }

    // Set title
    const resumeName = resume.displayName || resume.filename || 'Resume';
    title.textContent = resumeName;

    if (previewContent) {
      const existingLoader = previewContent.querySelector('.document-preview-loading');
      if (existingLoader) {
        existingLoader.remove();
      }
      const loader = document.createElement('div');
      loader.className = 'document-preview-loading';
      loader.innerHTML = `
        <div class="document-preview-loading-spinner"></div>
        <div class="document-preview-loading-text">
          Loading preview...
          <button type="button" class="document-preview-open" data-url="${url}">Open in new tab</button>
        </div>
      `;
      previewContent.appendChild(loader);

      const openBtn = loader.querySelector('.document-preview-open');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          const targetUrl = openBtn.getAttribute('data-url');
          if (targetUrl) {
            window.open(targetUrl, '_blank');
          }
        });
      }
    }

    // Use Google Docs viewer (same as Resume Versions)
    if (url.includes('.docx') || url.endsWith('.docx')) {
      previewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    } else if (url.includes('.pdf') || url.endsWith('.pdf')) {
      previewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

    // Set iframe source (same order as previewVersion)
    iframe.onload = () => {
      const loader = previewContent?.querySelector('.document-preview-loading');
      if (loader) loader.remove();
    };
    iframe.onerror = () => {
      const loader = previewContent?.querySelector('.document-preview-loading');
      if (loader) {
        loader.classList.add('slow');
      }
    };
    const slowTimer = setTimeout(() => {
      const loader = previewContent?.querySelector('.document-preview-loading');
      if (loader) loader.classList.add('slow');
    }, 4000);
    iframe.addEventListener('load', () => clearTimeout(slowTimer), { once: true });
    iframe.src = 'about:blank';
    iframe.src = previewUrl;

    // Show overlay (same as previewVersion)
    overlay.classList.remove('hidden');

    // Close button handler (same as previewVersion)
    if (closeBtn) {
      const closeHandler = () => {
        overlay.classList.add('hidden');
        iframe.src = ''; // Clear iframe to stop loading
        closeBtn.removeEventListener('click', closeHandler);
      };
      closeBtn.addEventListener('click', closeHandler);

      // Also close on overlay background click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeHandler();
        }
      });

      // Close on ESC key
      const escHandler = (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
          closeHandler();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }
  } catch (error) {
    console.error('Preview resume error:', error);
    showSettingsError('Failed to preview resume: ' + error.message);
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

// Loading state management
const loadingButtons = new Set();

function setButtonLoading(button, loading = true) {
  if (loading) {
    loadingButtons.add(button);
    button.disabled = true;
    button.classList.add('loading');
    // Store original content if not already stored
    if (!button._originalHTML) {
      button._originalHTML = button.innerHTML;
    }
    button.innerHTML = `
      <svg class="loading-spinner" viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
          <animate attributeName="stroke-dashoffset" values="31.416;0" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>
    `;
  } else {
    loadingButtons.delete(button);
    button.disabled = false;
    button.classList.remove('loading');
    // Restore original content
    if (button._originalHTML) {
      button.innerHTML = button._originalHTML;
    }
  }
}

function isButtonLoading(button) {
  return loadingButtons.has(button);
} // Default to classic


// Settings upload handler
const settingsUploadBox = document.getElementById('settings-upload-box');
const settingsResumeFile = document.getElementById('settings-resume-file');
const settingsUploadStatus = document.getElementById('settings-upload-status');
const settingsUploadOpenBtn = document.getElementById('settings-upload-open');
const settingsUploadModal = document.getElementById('settings-upload-modal');
const settingsUploadCloseBtn = document.getElementById('settings-upload-close');

if (settingsUploadOpenBtn && settingsUploadModal) {
  settingsUploadOpenBtn.addEventListener('click', () => {
    settingsUploadModal.classList.remove('hidden');
  });
}

if (settingsUploadCloseBtn && settingsUploadModal) {
  settingsUploadCloseBtn.addEventListener('click', () => {
    settingsUploadModal.classList.add('hidden');
  });
}

if (settingsUploadModal) {
  settingsUploadModal.addEventListener('click', (e) => {
    if (e.target === settingsUploadModal) {
      settingsUploadModal.classList.add('hidden');
    }
  });
}

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
        
        // Show success toast notification
        showSettingsSuccess('Resume uploaded successfully!');
        
        // Clear file input
        settingsResumeFile.value = '';
        
        // Reload resumes list
        setTimeout(() => {
          window.loadSettingsResumes();
          if (settingsUploadStatus) {
            settingsUploadStatus.classList.add('hidden');
          }
            if (settingsUploadModal) {
              settingsUploadModal.classList.add('hidden');
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

// Load feedback for settings section
window.loadSettingsFeedback = async function(page = 1) {
  try {
    currentFeedbackPage = page;
    const response = await window.apiRequest(`/feedback?page=${page}&limit=10`, {
      method: 'GET',
    });

    if (response.success && response.data) {
      displaySettingsFeedback(response.data.feedback || response.data, response.data.pagination);
    } else {
      showSettingsError('Failed to load feedback');
    }
  } catch (error) {
    console.error('Load feedback error:', error);
    showSettingsError('Failed to load feedback: ' + error.message);
  }
};

function displaySettingsFeedback(feedback, pagination) {
  const table = document.getElementById('settings-feedback-table');
  const tbody = document.getElementById('settings-feedback-tbody');
  const emptyState = document.getElementById('settings-feedback-empty-state');
  const paginationContainer = document.getElementById('feedback-pagination');
  const paginationContainerTop = document.getElementById('feedback-pagination-top');

  if (!feedback || feedback.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    if (paginationContainerTop) paginationContainerTop.classList.add('hidden');
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyState) emptyState.classList.add('hidden');
  if (tbody) tbody.innerHTML = '';

  feedback.forEach(item => {
    const row = createFeedbackRow(item);
    if (tbody) tbody.appendChild(row);
  });

  // Update pagination
  if (pagination) {
    feedbackTotalPages = pagination.totalPages || 1;
    updateFeedbackPagination(pagination);
  }
}

function createFeedbackRow(item) {
  const tr = document.createElement('tr');

  // Type column
  const typeCell = document.createElement('td');
  typeCell.style.fontSize = '12px';
  typeCell.style.textTransform = 'capitalize';
  typeCell.textContent = item.type === 'cover_letter' ? 'Cover Letter' : 'Resume';
  tr.appendChild(typeCell);

  // Rating column
  const ratingCell = document.createElement('td');
  ratingCell.style.fontSize = '12px';
  const ratingSpan = document.createElement('span');
  ratingSpan.style.padding = '4px 8px';
  ratingSpan.style.borderRadius = '4px';
  ratingSpan.style.fontSize = '11px';
  ratingSpan.style.fontWeight = '500';
  if (item.rating === 'positive') {
    ratingSpan.textContent = '👍 Positive';
    ratingSpan.style.background = '#d1fae5';
    ratingSpan.style.color = '#065f46';
  } else {
    ratingSpan.textContent = '👎 Negative';
    ratingSpan.style.background = '#fee2e2';
    ratingSpan.style.color = '#991b1b';
  }
  ratingCell.appendChild(ratingSpan);
  tr.appendChild(ratingCell);

  // Message column
  const messageCell = document.createElement('td');
  messageCell.style.fontSize = '12px';
  messageCell.style.color = '#6b7280';
  messageCell.textContent = item.message || '—';
  messageCell.style.maxWidth = '200px';
  messageCell.style.overflow = 'hidden';
  messageCell.style.textOverflow = 'ellipsis';
  messageCell.style.whiteSpace = 'nowrap';
  if (item.message) {
    messageCell.title = item.message;
  }
  tr.appendChild(messageCell);

  // Date column
  const dateCell = document.createElement('td');
  dateCell.style.fontSize = '12px';
  dateCell.style.color = '#6b7280';
  const date = new Date(item.createdAt);
  dateCell.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  tr.appendChild(dateCell);

  return tr;
}

function updateFeedbackPagination(pagination) {
  // Bottom pagination
  const paginationContainer = document.getElementById('feedback-pagination');
  const paginationInfo = document.getElementById('feedback-pagination-info');
  const prevBtn = document.getElementById('feedback-pagination-prev');
  const nextBtn = document.getElementById('feedback-pagination-next');

  // Top pagination
  const paginationContainerTop = document.getElementById('feedback-pagination-top');
  const paginationInfoTop = document.getElementById('feedback-pagination-info-top');
  const prevBtnTop = document.getElementById('feedback-pagination-prev-top');
  const nextBtnTop = document.getElementById('feedback-pagination-next-top');

  if (pagination) {
    const { page, total, totalPages } = pagination;
    
    if (paginationInfo) {
      paginationInfo.textContent = `Page ${page} of ${totalPages} (${total} total)`;
    }
    if (paginationInfoTop) {
      paginationInfoTop.textContent = `Page ${page} of ${totalPages} (${total} total)`;
    }

    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
    if (prevBtnTop) prevBtnTop.disabled = page <= 1;
    if (nextBtnTop) nextBtnTop.disabled = page >= totalPages;

    const handlePrev = () => {
      if (page > 1) {
        window.loadSettingsFeedback(page - 1);
      }
    };

    const handleNext = () => {
      if (page < totalPages) {
        window.loadSettingsFeedback(page + 1);
      }
    };

    if (prevBtn) prevBtn.onclick = handlePrev;
    if (nextBtn) nextBtn.onclick = handleNext;
    if (prevBtnTop) prevBtnTop.onclick = handlePrev;
    if (nextBtnTop) nextBtnTop.onclick = handleNext;

    if (paginationContainer) paginationContainer.classList.remove('hidden');
    if (paginationContainerTop) paginationContainerTop.classList.remove('hidden');
  } else {
    if (paginationContainer) paginationContainer.classList.add('hidden');
    if (paginationContainerTop) paginationContainerTop.classList.add('hidden');
  }
}
