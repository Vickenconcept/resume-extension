// Settings page script for resume management

let editingResumeId = null;

// Load resumes on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadResumes();
  
  // Back button
  document.getElementById('back-btn').addEventListener('click', () => {
    window.close();
  });
});

async function loadResumes() {
  try {
    const response = await window.apiRequest('/resumes', {
      method: 'GET',
    });

    if (response.success && response.data) {
      displayResumes(response.data);
    } else {
      showError('Failed to load resumes');
    }
  } catch (error) {
    console.error('Load resumes error:', error);
    showError('Failed to load resumes: ' + error.message);
  }
}

function displayResumes(resumes) {
  const list = document.getElementById('resumes-list');
  const emptyState = document.getElementById('empty-state');

  if (!resumes || resumes.length === 0) {
    list.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  list.classList.remove('hidden');
  emptyState.classList.add('hidden');
  list.innerHTML = '';

  resumes.forEach(resume => {
    const item = createResumeItem(resume);
    list.appendChild(item);
  });
}

function createResumeItem(resume) {
  const li = document.createElement('li');
  li.className = `resume-item ${resume.isDefault ? 'default' : ''}`;
  li.id = `resume-${resume.resumeId}`;

  const info = document.createElement('div');
  info.className = 'resume-info';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'resume-name';

  if (editingResumeId === resume.resumeId) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-name-input';
    input.value = resume.displayName;
    input.placeholder = 'Resume name';
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
    nameDiv.appendChild(input);
    input.focus();
    input.select();
  } else {
    const nameSpan = document.createElement('span');
    nameSpan.textContent = resume.displayName;
    nameDiv.appendChild(nameSpan);

    if (resume.isDefault) {
      const badge = document.createElement('span');
      badge.className = 'default-badge';
      badge.textContent = 'Default';
      nameDiv.appendChild(badge);
    }
  }

  const meta = document.createElement('div');
  meta.className = 'resume-meta';
  meta.textContent = `${resume.filename} • Uploaded ${formatDate(resume.uploadedAt)}`;

  info.appendChild(nameDiv);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'resume-actions';

  if (!resume.isDefault) {
    const setDefaultBtn = document.createElement('button');
    setDefaultBtn.className = 'action-btn primary';
    setDefaultBtn.textContent = 'Set Default';
    setDefaultBtn.addEventListener('click', () => setDefaultResume(resume.resumeId));
    actions.appendChild(setDefaultBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn';
  editBtn.textContent = editingResumeId === resume.resumeId ? 'Cancel' : 'Rename';
  editBtn.addEventListener('click', () => {
    if (editingResumeId === resume.resumeId) {
      cancelEdit(resume.resumeId);
    } else {
      editResumeName(resume.resumeId);
    }
  });
  actions.appendChild(editBtn);

  if (!resume.isDefault) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteResume(resume.resumeId, resume.displayName));
    actions.appendChild(deleteBtn);
  }

  li.appendChild(info);
  li.appendChild(actions);

  return li;
}

async function setDefaultResume(resumeId) {
  try {
    const response = await window.apiRequest('/set-default-resume', {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });

    if (response.success) {
      await loadResumes(); // Reload list
    } else {
      showError(response.error || 'Failed to set default resume');
    }
  } catch (error) {
    console.error('Set default error:', error);
    showError('Failed to set default resume: ' + error.message);
  }
}

function editResumeName(resumeId) {
  editingResumeId = resumeId;
  loadResumes();
}

function cancelEdit(resumeId) {
  if (editingResumeId === resumeId) {
    editingResumeId = null;
    loadResumes();
  }
}

async function saveResumeName(resumeId, newName) {
  if (!newName || newName.trim().length === 0) {
    showError('Resume name cannot be empty');
    return;
  }

  try {
    const response = await window.apiRequest('/update-resume-name', {
      method: 'POST',
      body: JSON.stringify({
        resumeId,
        displayName: newName.trim(),
      }),
    });

    if (response.success) {
      editingResumeId = null;
      await loadResumes();
    } else {
      showError(response.error || 'Failed to update resume name');
    }
  } catch (error) {
    console.error('Update name error:', error);
    showError('Failed to update resume name: ' + error.message);
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
      await loadResumes();
    } else {
      showError(response.error || 'Failed to delete resume');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showError('Failed to delete resume: ' + error.message);
  }
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

function showError(message) {
  // Simple alert for now - can be improved with toast
  alert(message);
}
