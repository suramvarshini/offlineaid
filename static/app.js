/**
 * OfflineAid - Client-Side Application Logic (Vanilla JavaScript ES6)
 * Zero-Dependency Emergency Assistant
 * Dual persistence: Local Python REST API + LocalStorage fallback
 */

const app = (function () {
    // --- STATE MANAGEMENT ---
    const state = {
        contacts: [],
        firstAid: [],
        checklists: [],
        preparedness: [],
        profile: {},
        activeCategory: 'all',
        activeChecklistId: 'earthquake',
        isOnline: navigator.onLine,
        isServerConnected: false,
        confirmCallback: null
    };

    // Default Seed Fallback Data (for offline file:// fallback without server)
    const DEFAULT_SEED = {
        contacts: [
            { id: 1, name: "Local Emergency Services", phone: "911", relationship: "Police / Fire / Ambulance", notes: "Primary emergency dispatch" },
            { id: 2, name: "Poison Control Center", phone: "1-800-222-1222", relationship: "Medical Helpline", notes: "24/7 helpline" },
            { id: 3, name: "Jane Doe (ICE)", phone: "555-0199", relationship: "Sister / ICE", notes: "Primary emergency contact" }
        ],
        firstAid: [
            {
                id: "cpr", category: "Life Support", title: "Basic CPR Awareness",
                summary: "Cardiopulmonary Resuscitation for unresponsive individuals who are not breathing normally.",
                warning: "Call 911 immediately before starting CPR if someone else is nearby to help.",
                steps: [
                    "Check scene safety and assess responsiveness by tapping shoulders and calling loudly.",
                    "If unresponsive and not breathing, call 911 immediately.",
                    "Place person on back on a firm, flat surface.",
                    "Position hands: heel of one hand in center of chest, other hand on top.",
                    "Push hard and fast: 100-120 compressions/min, at least 2 inches deep.",
                    "Continue until emergency help arrives."
                ]
            },
            {
                id: "severe-bleeding", category: "Wounds", title: "Severe Bleeding",
                summary: "Steps to control rapid or heavy bleeding from deep wounds or trauma.",
                warning: "Severe blood loss is life-threatening. Seek immediate emergency medical assistance.",
                steps: [
                    "Ensure scene safety. Apply direct pressure immediately using a clean cloth.",
                    "Keep firm, continuous pressure on wound for at least 5-10 minutes.",
                    "If blood soaks through, add another cloth on top—do NOT remove original dressing.",
                    "Keep person warm with blankets to prevent shock."
                ]
            },
            {
                id: "choking", category: "Respiratory", title: "Choking (Conscious Adult)",
                summary: "Abdominal thrusts (Heimlich maneuver) for a conscious adult who cannot breathe.",
                warning: "If person loses consciousness, lower them to floor and begin CPR compressions.",
                steps: [
                    "Ask 'Are you choking?' If they cannot speak or cough, signal you will help.",
                    "Stand behind person, wrap arms around waist, lean them slightly forward.",
                    "Make a fist above navel, grasp with other hand, press with quick upward thrust.",
                    "Perform up to 5 abdominal thrusts alternating with 5 back blows until clear."
                ]
            },
            {
                id: "burns", category: "Wounds", title: "Burns (First & Second Degree)",
                summary: "Immediate care for thermal burns caused by heat or steam.",
                warning: "For third-degree burns, chemical/electrical burns, call 911. Do NOT break blisters.",
                steps: [
                    "Cool burn immediately under cool running tap water for 10-20 minutes.",
                    "Do NOT apply ice, butter, or oils directly to open burns.",
                    "Cover burn loosely with clean non-stick bandage."
                ]
            }
        ],
        checklists: [
            {
                id: "earthquake", category: "Disaster", title: "Earthquake Safety Checklist",
                items: [
                    "DROP to your hands and knees to prevent being knocked over.",
                    "COVER your head and neck under a sturdy table or desk.",
                    "HOLD ON to your shelter until shaking stops completely.",
                    "Check yourself and household for injuries once shaking stops.",
                    "Inspect gas, water, and electrical lines for damage."
                ],
                completed_items: []
            },
            {
                id: "flood", category: "Disaster", title: "Flood Preparedness & Evacuation",
                items: [
                    "Move essential items to upper floors if floodwaters threaten.",
                    "Turn off main power breaker and gas supply before evacuating.",
                    "Do NOT walk or drive through floodwaters (Turn Around, Don't Drown!).",
                    "Keep Go-Bag ready with waterproof document pouch."
                ],
                completed_items: []
            }
        ],
        preparedness: [
            { id: "prep-1", title: "Drinking Water (1 gallon per person per day)", completed: 0 },
            { id: "prep-2", title: "First-Aid Kit (bandages, antiseptics, gauze)", completed: 0 },
            { id: "prep-3", title: "High-powered LED Flashlight & Batteries", completed: 0 },
            { id: "prep-4", title: "Portable Power Bank (fully charged)", completed: 0 },
            { id: "prep-5", title: "Waterproof Document Bag (IDs, passports, insurance)", completed: 0 },
            { id: "prep-6", title: "Emergency Contacts List (printed & OfflineAid app)", completed: 0 }
        ],
        profile: {
            full_name: "John Alex Smith",
            blood_group: "O+",
            allergies: "Penicillin",
            emergency_contact: "Jane Doe (Sister) - 555-0199",
            medications: "Albuterol Inhaler (as needed)",
            medical_notes: "Mild Asthmatic",
            important_documents: "Documents in closet safe"
        }
    };

    // --- API & DATA ENGINE ---
    async function fetchApi(endpoint, options = {}) {
        try {
            const res = await fetch(endpoint, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            state.isServerConnected = true;
            updateStatusBadge();
            return await res.json();
        } catch (err) {
            state.isServerConnected = false;
            updateStatusBadge();
            return null; // Triggers localStorage fallback
        }
    }

    async function loadData() {
        // Try server API first
        const [contactsRes, faRes, chkRes, prepRes, profileRes] = await Promise.all([
            fetchApi('/api/contacts'),
            fetchApi('/api/firstaid'),
            fetchApi('/api/checklists'),
            fetchApi('/api/preparedness'),
            fetchApi('/api/profile')
        ]);

        if (contactsRes && contactsRes.contacts) {
            state.contacts = contactsRes.contacts;
            state.firstAid = faRes ? faRes.first_aid : [];
            state.checklists = chkRes ? chkRes.checklists : [];
            state.preparedness = prepRes ? prepRes.preparedness : [];
            state.profile = profileRes || {};

            // Save to localStorage as offline sync backup
            saveToLocalStorage();
        } else {
            // Load from LocalStorage fallback
            loadFromLocalStorage();
        }

        renderAll();
    }

    function saveToLocalStorage() {
        try {
            localStorage.setItem('offlineaid_contacts', JSON.stringify(state.contacts));
            localStorage.setItem('offlineaid_firstaid', JSON.stringify(state.firstAid));
            localStorage.setItem('offlineaid_checklists', JSON.stringify(state.checklists));
            localStorage.setItem('offlineaid_preparedness', JSON.stringify(state.preparedness));
            localStorage.setItem('offlineaid_profile', JSON.stringify(state.profile));
        } catch (e) {
            console.error('LocalStorage write error', e);
        }
    }

    function loadFromLocalStorage() {
        const c = localStorage.getItem('offlineaid_contacts');
        const fa = localStorage.getItem('offlineaid_firstaid');
        const chk = localStorage.getItem('offlineaid_checklists');
        const prep = localStorage.getItem('offlineaid_preparedness');
        const prof = localStorage.getItem('offlineaid_profile');

        state.contacts = c ? JSON.parse(c) : DEFAULT_SEED.contacts;
        state.firstAid = fa ? JSON.parse(fa) : DEFAULT_SEED.firstAid;
        state.checklists = chk ? JSON.parse(chk) : DEFAULT_SEED.checklists;
        state.preparedness = prep ? JSON.parse(prep) : DEFAULT_SEED.preparedness;
        state.profile = prof ? JSON.parse(prof) : DEFAULT_SEED.profile;
    }

    // --- UI ROUTING & NAVIGATION ---
    function initNavigation() {
        const navLinks = document.querySelectorAll('.nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetView = link.getAttribute('data-view');
                navigateTo(targetView);
                if (window.innerWidth <= 860) {
                    document.getElementById('app-sidebar').classList.remove('open');
                }
            });
        });

        // Handle hash navigation
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '') || 'dashboard';
            navigateTo(hash, false);
        });

        // Mobile menu toggle
        document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
            document.getElementById('app-sidebar').classList.toggle('open');
        });

        document.getElementById('logo-btn').addEventListener('click', () => navigateTo('dashboard'));

        // Quick Emergency buttons
        document.getElementById('btn-quick-emergency').addEventListener('click', openQuickEmergency);
        document.getElementById('btn-exit-emergency').addEventListener('click', closeQuickEmergency);
    }

    function navigateTo(viewId, updateHash = true) {
        const views = document.querySelectorAll('.view-section');
        const navLinks = document.querySelectorAll('.nav-item');

        let targetFound = false;
        views.forEach(view => {
            if (view.id === `view-${viewId}`) {
                view.classList.add('active');
                targetFound = true;
            } else {
                view.classList.remove('active');
            }
        });

        if (!targetFound) return;

        navLinks.forEach(link => {
            if (link.getAttribute('data-view') === viewId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        if (updateHash) {
            window.location.hash = viewId;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateStatusBadge() {
        const badge = document.getElementById('offline-status-badge');
        const text = document.getElementById('status-text');

        if (state.isServerConnected) {
            badge.className = 'status-badge status-online';
            text.textContent = 'OFFLINE READY';
            badge.title = 'Python server operating cleanly without internet dependencies.';
        } else {
            badge.className = 'status-badge status-online';
            text.textContent = 'STANDALONE MODE';
            badge.title = 'Running directly from client storage without server connection.';
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderAll() {
        renderDashboard();
        renderContacts();
        renderFirstAid();
        renderChecklists();
        renderPreparedness();
        renderProfile();
        renderQuickEmergency();
    }

    // 1. DASHBOARD
    function renderDashboard() {
        // Counters
        document.getElementById('stat-contacts-count').textContent = state.contacts.length;
        document.getElementById('stat-firstaid-count').textContent = state.firstAid.length;

        // Disaster Preparedness Calc
        let totalChkItems = 0;
        let completedChkItems = 0;
        state.checklists.forEach(chk => {
            totalChkItems += chk.items.length;
            completedChkItems += (chk.completed_items || []).length;
        });
        const chkPct = totalChkItems > 0 ? Math.round((completedChkItems / totalChkItems) * 100) : 0;
        document.getElementById('stat-disaster-progress').textContent = `${chkPct}%`;

        // Preparedness Calc
        const prepTotal = state.preparedness.length;
        const prepDone = state.preparedness.filter(p => p.completed === 1).length;
        const prepPct = prepTotal > 0 ? Math.round((prepDone / prepTotal) * 100) : 0;
        document.getElementById('stat-prep-progress').textContent = `${prepPct}%`;

        // Mini contacts list
        const miniContacts = document.getElementById('dash-contacts-list');
        if (state.contacts.length === 0) {
            miniContacts.innerHTML = '<p class="text-muted">No emergency contacts saved yet.</p>';
        } else {
            miniContacts.innerHTML = state.contacts.slice(0, 3).map(c => `
                <div class="contact-mini-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #f1f5f9;">
                    <div>
                        <strong>${escapeHtml(c.name)}</strong>
                        <span style="display:block; font-size:0.75rem; color:#64748b;">${escapeHtml(c.relationship || 'Emergency Contact')}</span>
                    </div>
                    <a href="tel:${escapeHtml(c.phone)}" class="btn btn-sm btn-primary" style="padding:0.25rem 0.6rem; font-size:0.8rem;">Call ${escapeHtml(c.phone)}</a>
                </div>
            `).join('');
        }

        // Mini profile card
        const miniProf = document.getElementById('dash-profile-card');
        const p = state.profile;
        miniProf.innerHTML = `
            <div style="font-size:0.9rem;">
                <p style="margin-bottom:0.4rem;"><strong>Name:</strong> ${escapeHtml(p.full_name || 'Not set')}</p>
                <p style="margin-bottom:0.4rem;"><strong>Blood Group:</strong> <span class="badge" style="background:#fee2e2; color:#dc2626; padding:0.1rem 0.4rem; border-radius:4px; font-weight:700;">${escapeHtml(p.blood_group || 'Not set')}</span></p>
                <p style="margin-bottom:0.4rem;"><strong>Allergies:</strong> ${escapeHtml(p.allergies || 'None listed')}</p>
                <p style="margin-bottom:0.4rem;"><strong>ICE Contact:</strong> ${escapeHtml(p.emergency_contact || 'None listed')}</p>
            </div>
        `;

        // Stat cards click handlers
        document.querySelectorAll('.stat-card').forEach(card => {
            card.onclick = () => {
                const target = card.getAttribute('data-target');
                navigateTo(target);
            };
        });

        // Quick action shortcuts
        document.getElementById('quick-cpr-btn').onclick = () => openFirstAidModal('cpr');
        document.getElementById('quick-bleeding-btn').onclick = () => openFirstAidModal('severe-bleeding');
        document.getElementById('quick-choking-btn').onclick = () => openFirstAidModal('choking');
        document.getElementById('quick-earthquake-btn').onclick = () => {
            state.activeChecklistId = 'earthquake';
            renderChecklists();
            navigateTo('checklists');
        };
    }

    // 2. CONTACTS
    function renderContacts(filterQuery = '') {
        const grid = document.getElementById('contacts-grid');
        let filtered = state.contacts;

        if (filterQuery.trim()) {
            const q = filterQuery.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.phone.toLowerCase().includes(q) ||
                (c.relationship && c.relationship.toLowerCase().includes(q)) ||
                (c.notes && c.notes.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:3rem 1rem; color:#64748b;">
                    <p style="font-size:1.1rem; font-weight:600;">No emergency contacts found.</p>
                    <p style="font-size:0.9rem;">Click 'Add Contact' above to store essential numbers locally.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(c => `
            <div class="contact-card">
                <div>
                    <div class="contact-header">
                        <span class="contact-name">${escapeHtml(c.name)}</span>
                        ${c.relationship ? `<span class="contact-rel">${escapeHtml(c.relationship)}</span>` : ''}
                    </div>
                    <a href="tel:${escapeHtml(c.phone)}" class="contact-phone-link">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        <span>${escapeHtml(c.phone)}</span>
                    </a>
                    ${c.notes ? `<div class="contact-notes">${escapeHtml(c.notes)}</div>` : ''}
                </div>
                <div class="contact-actions">
                    <button class="btn-icon" onclick="app.editContact(${c.id})" title="Edit Contact">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon" onclick="app.confirmDeleteContact(${c.id}, '${escapeJsSingleQuote(c.name)}')" title="Delete Contact">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 3. FIRST AID
    function renderFirstAid() {
        const grid = document.getElementById('firstaid-grid');
        let filtered = state.firstAid;

        if (state.activeCategory !== 'all') {
            filtered = filtered.filter(f => f.category === state.activeCategory);
        }

        grid.innerHTML = filtered.map(fa => `
            <div class="fa-card">
                <div>
                    <span class="fa-category-tag">${escapeHtml(fa.category)}</span>
                    <h3>${escapeHtml(fa.title)}</h3>
                    <p>${escapeHtml(fa.summary)}</p>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="app.openFirstAidModal('${fa.id}')" style="width:100%;">
                    View Procedure Steps &rarr;
                </button>
            </div>
        `).join('');

        // Category pills
        const pills = document.querySelectorAll('#firstaid-category-pills .pill');
        pills.forEach(pill => {
            pill.onclick = () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                state.activeCategory = pill.getAttribute('data-category');
                renderFirstAid();
            };
        });
    }

    function openFirstAidModal(guideId) {
        const guide = state.firstAid.find(f => f.id === guideId);
        if (!guide) return;

        document.getElementById('modal-fa-title').textContent = guide.title;
        const body = document.getElementById('modal-fa-body');

        body.innerHTML = `
            ${guide.warning ? `
                <div class="medical-disclaimer-box" style="margin-bottom:1rem; background:#fee2e2; border-color:#fca5a5; color:#991b1b;">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <div><strong>WARNING:</strong> ${escapeHtml(guide.warning)}</div>
                </div>
            ` : ''}
            <p style="font-size:0.95rem; margin-bottom:1.25rem; color:#475569;">${escapeHtml(guide.summary)}</p>
            <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.75rem;">Step-by-Step Action:</h4>
            <ol style="padding-left:1.25rem; display:flex; flex-direction:column; gap:0.75rem;">
                ${guide.steps.map(step => `<li style="font-size:0.95rem; line-height:1.5;">${escapeHtml(step)}</li>`).join('')}
            </ol>
        `;

        openModal('firstaid-modal');
    }

    // 4. CHECKLISTS
    function renderChecklists() {
        const tabsContainer = document.getElementById('disaster-tabs');
        const activeContainer = document.getElementById('checklist-active-container');

        // Render Tabs
        tabsContainer.innerHTML = state.checklists.map(chk => `
            <button class="tab-btn ${chk.id === state.activeChecklistId ? 'active' : ''}" onclick="app.switchChecklistTab('${chk.id}')">
                ${escapeHtml(chk.title.replace(' Checklist', '').replace(' Preparedness & Evacuation', ''))}
            </button>
        `).join('');

        const currentChk = state.checklists.find(c => c.id === state.activeChecklistId) || state.checklists[0];
        if (!currentChk) return;

        const completed = currentChk.completed_items || [];
        const total = currentChk.items.length;
        const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

        activeContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                <div>
                    <h3 style="font-size:1.3rem; font-weight:800;">${escapeHtml(currentChk.title)}</h3>
                    <p style="font-size:0.85rem; color:#64748b;">Mark items as completed as you perform action steps.</p>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="app.resetChecklist('${currentChk.id}')">Reset Progress</button>
            </div>

            <div class="progress-card">
                <div class="progress-info">
                    <span class="progress-label">Action Completion</span>
                    <span class="progress-percentage">${pct}% (${completed.length}/${total})</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${pct}%"></div>
                </div>
            </div>

            <div class="checklist-items-list">
                ${currentChk.items.map((item, idx) => {
                    const isDone = completed.includes(item);
                    return `
                        <div class="chk-item-row ${isDone ? 'completed' : ''}" onclick="app.toggleChecklistItem('${currentChk.id}', ${idx})">
                            <input type="checkbox" class="chk-checkbox" ${isDone ? 'checked' : ''} onclick="event.stopPropagation(); app.toggleChecklistItem('${currentChk.id}', ${idx});">
                            <span class="chk-text">${escapeHtml(item)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function switchChecklistTab(id) {
        state.activeChecklistId = id;
        renderChecklists();
    }

    async function toggleChecklistItem(chkId, itemIdx) {
        const chk = state.checklists.find(c => c.id === chkId);
        if (!chk) return;

        const item = chk.items[itemIdx];
        let completed = chk.completed_items || [];

        if (completed.includes(item)) {
            completed = completed.filter(i => i !== item);
        } else {
            completed.push(item);
        }

        chk.completed_items = completed;
        renderChecklists();
        renderDashboard();
        saveToLocalStorage();

        // Async sync to server
        fetchApi('/api/checklists/progress', {
            method: 'POST',
            body: JSON.stringify({ id: chkId, completed_items: completed })
        });
    }

    async function resetChecklist(chkId) {
        const chk = state.checklists.find(c => c.id === chkId);
        if (!chk) return;

        chk.completed_items = [];
        renderChecklists();
        renderDashboard();
        saveToLocalStorage();
        showToast('Checklist reset successfully', 'success');

        fetchApi('/api/checklists/reset', {
            method: 'POST',
            body: JSON.stringify({ id: chkId })
        });
    }

    // 5. PREPAREDNESS
    function renderPreparedness() {
        const list = document.getElementById('preparedness-list');
        const prepTotal = state.preparedness.length;
        const prepDone = state.preparedness.filter(p => p.completed === 1).length;
        const prepPct = prepTotal > 0 ? Math.round((prepDone / prepTotal) * 100) : 0;

        document.getElementById('prep-percentage-text').textContent = `${prepPct}% (${prepDone}/${prepTotal} Ready)`;
        document.getElementById('prep-progress-bar').style.width = `${prepPct}%`;

        list.innerHTML = state.preparedness.map(item => `
            <div class="chk-item-row ${item.completed === 1 ? 'completed' : ''}" onclick="app.togglePreparednessItem('${item.id}')">
                <input type="checkbox" class="chk-checkbox" ${item.completed === 1 ? 'checked' : ''} onclick="event.stopPropagation(); app.togglePreparednessItem('${item.id}');">
                <span class="chk-text">${escapeHtml(item.title)}</span>
            </div>
        `).join('');

        document.getElementById('btn-reset-preparedness').onclick = resetPreparedness;
    }

    async function togglePreparednessItem(id) {
        const item = state.preparedness.find(p => p.id === id);
        if (!item) return;

        item.completed = item.completed === 1 ? 0 : 1;
        renderPreparedness();
        renderDashboard();
        saveToLocalStorage();

        fetchApi('/api/preparedness/progress', {
            method: 'POST',
            body: JSON.stringify({ id, completed: item.completed })
        });
    }

    async function resetPreparedness() {
        state.preparedness.forEach(p => p.completed = 0);
        renderPreparedness();
        renderDashboard();
        saveToLocalStorage();
        showToast('Preparedness checklist reset', 'success');

        fetchApi('/api/preparedness/reset', { method: 'POST' });
    }

    // 6. PROFILE
    function renderProfile() {
        const p = state.profile || {};
        document.getElementById('prof-fullname').value = p.full_name || '';
        document.getElementById('prof-blood').value = p.blood_group || '';
        document.getElementById('prof-allergies').value = p.allergies || '';
        document.getElementById('prof-ice').value = p.emergency_contact || '';
        document.getElementById('prof-medications').value = p.medications || '';
        document.getElementById('prof-notes').value = p.medical_notes || '';
        document.getElementById('prof-documents').value = p.important_documents || '';

        document.getElementById('profile-form').onsubmit = saveProfile;
        document.getElementById('btn-clear-profile').onclick = clearProfile;
        document.getElementById('btn-print-profile').onclick = () => window.print();
    }

    async function saveProfile(e) {
        e.preventDefault();
        const updated = {
            full_name: document.getElementById('prof-fullname').value,
            blood_group: document.getElementById('prof-blood').value,
            allergies: document.getElementById('prof-allergies').value,
            emergency_contact: document.getElementById('prof-ice').value,
            medications: document.getElementById('prof-medications').value,
            medical_notes: document.getElementById('prof-notes').value,
            important_documents: document.getElementById('prof-documents').value
        };

        state.profile = updated;
        saveToLocalStorage();
        renderDashboard();
        renderQuickEmergency();
        showToast('Personal emergency profile updated', 'success');

        fetchApi('/api/profile', {
            method: 'PUT',
            body: JSON.stringify(updated)
        });
    }

    function clearProfile() {
        showConfirm('Clear Emergency Profile', 'Are you sure you want to clear your medical details from this device?', () => {
            state.profile = {
                full_name: '', blood_group: '', allergies: '', emergency_contact: '',
                medications: '', medical_notes: '', important_documents: ''
            };
            saveToLocalStorage();
            renderProfile();
            renderDashboard();
            renderQuickEmergency();
            showToast('Profile cleared', 'success');

            fetchApi('/api/profile', {
                method: 'PUT',
                body: JSON.stringify(state.profile)
            });
        });
    }

    // 7. CONTACT MODAL & ACTIONS
    function initContactForm() {
        document.getElementById('btn-add-contact').onclick = () => {
            document.getElementById('modal-contact-title').textContent = 'Add Emergency Contact';
            document.getElementById('contact-id').value = '';
            document.getElementById('contact-name').value = '';
            document.getElementById('contact-phone').value = '';
            document.getElementById('contact-relationship').value = '';
            document.getElementById('contact-notes').value = '';
            openModal('contact-modal');
        };

        document.getElementById('contact-form').onsubmit = saveContact;
        document.getElementById('contacts-search-input').oninput = (e) => {
            renderContacts(e.target.value);
        };
    }

    function editContact(id) {
        const c = state.contacts.find(item => item.id === id);
        if (!c) return;

        document.getElementById('modal-contact-title').textContent = 'Edit Emergency Contact';
        document.getElementById('contact-id').value = c.id;
        document.getElementById('contact-name').value = c.name;
        document.getElementById('contact-phone').value = c.phone;
        document.getElementById('contact-relationship').value = c.relationship || '';
        document.getElementById('contact-notes').value = c.notes || '';
        openModal('contact-modal');
    }

    async function saveContact(e) {
        e.preventDefault();
        const id = document.getElementById('contact-id').value;
        const name = document.getElementById('contact-name').value.trim();
        const phone = document.getElementById('contact-phone').value.trim();
        const relationship = document.getElementById('contact-relationship').value.trim();
        const notes = document.getElementById('contact-notes').value.trim();

        if (!name || !phone) return;

        if (id) {
            // Edit
            const numericId = parseInt(id, 10);
            const cIdx = state.contacts.findIndex(c => c.id === numericId);
            if (cIdx !== -1) {
                state.contacts[cIdx] = { ...state.contacts[cIdx], name, phone, relationship, notes };
            }
            fetchApi(`/api/contacts/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, phone, relationship, notes })
            });
            showToast('Contact updated', 'success');
        } else {
            // Add
            const newId = state.contacts.length > 0 ? Math.max(...state.contacts.map(c => c.id || 0)) + 1 : 1;
            const newContact = { id: newId, name, phone, relationship, notes };
            state.contacts.push(newContact);
            fetchApi('/api/contacts', {
                method: 'POST',
                body: JSON.stringify({ name, phone, relationship, notes })
            });
            showToast('Emergency contact saved', 'success');
        }

        saveToLocalStorage();
        closeModal('contact-modal');
        renderContacts();
        renderDashboard();
        renderQuickEmergency();
    }

    function confirmDeleteContact(id, name) {
        showConfirm('Delete Contact', `Are you sure you want to delete "${name}" from your local emergency contacts?`, async () => {
            state.contacts = state.contacts.filter(c => c.id !== id);
            saveToLocalStorage();
            renderContacts();
            renderDashboard();
            renderQuickEmergency();
            showToast('Contact deleted', 'success');

            fetchApi(`/api/contacts/${id}`, { method: 'DELETE' });
        });
    }

    // 8. QUICK EMERGENCY MODE
    function renderQuickEmergency() {
        const contactsContainer = document.getElementById('quick-contacts-container');
        if (state.contacts.length === 0) {
            contactsContainer.innerHTML = '<p style="color:#9ca3af;">No emergency contacts added.</p>';
        } else {
            contactsContainer.innerHTML = state.contacts.map(c => `
                <a href="tel:${escapeHtml(c.phone)}" class="quick-tel-btn">
                    <div class="quick-tel-info">
                        <span>${escapeHtml(c.name)}</span>
                        <span class="quick-tel-rel">${escapeHtml(c.relationship || 'Emergency')}</span>
                    </div>
                    <span>CALL ${escapeHtml(c.phone)}</span>
                </a>
            `).join('');
        }

        const profileContainer = document.getElementById('quick-profile-container');
        const p = state.profile || {};
        profileContainer.innerHTML = `
            <div><strong>NAME:</strong> ${escapeHtml(p.full_name || 'Unspecified')}</div>
            <div><strong>BLOOD GROUP:</strong> ${escapeHtml(p.blood_group || 'Unspecified')}</div>
            <div><strong>ALLERGIES:</strong> ${escapeHtml(p.allergies || 'None listed')}</div>
            <div><strong>MEDICATIONS:</strong> ${escapeHtml(p.medications || 'None listed')}</div>
            <div><strong>ICE CONTACT:</strong> ${escapeHtml(p.emergency_contact || 'Unspecified')}</div>
        `;
    }

    function openQuickEmergency() {
        renderQuickEmergency();
        document.getElementById('quick-emergency-overlay').classList.remove('hidden');
    }

    function closeQuickEmergency() {
        document.getElementById('quick-emergency-overlay').classList.add('hidden');
    }

    // 9. SEARCH ENGINE
    function initSearch() {
        const input = document.getElementById('global-search-input');
        const clearBtn = document.getElementById('clear-search-btn');
        const dropdown = document.getElementById('search-results-dropdown');

        input.oninput = (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (query.length === 0) {
                dropdown.classList.add('hidden');
                clearBtn.classList.add('hidden');
                return;
            }

            clearBtn.classList.remove('hidden');
            performSearch(query);
        };

        clearBtn.onclick = () => {
            input.value = '';
            dropdown.classList.add('hidden');
            clearBtn.classList.add('hidden');
        };

        document.addEventListener('click', (e) => {
            if (!document.querySelector('.header-search').contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    function performSearch(q) {
        const dropdown = document.getElementById('search-results-dropdown');
        const matchedContacts = state.contacts.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.notes && c.notes.toLowerCase().includes(q)));
        const matchedFA = state.firstAid.filter(f => f.title.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
        const matchedChk = state.checklists.filter(c => c.title.toLowerCase().includes(q) || c.items.some(i => i.toLowerCase().includes(q)));

        if (matchedContacts.length === 0 && matchedFA.length === 0 && matchedChk.length === 0) {
            dropdown.innerHTML = '<div style="padding:1rem; text-align:center; color:#64748b; font-size:0.85rem;">No matching emergency records found.</div>';
            dropdown.classList.remove('hidden');
            return;
        }

        let html = '';

        if (matchedContacts.length > 0) {
            html += '<div class="search-group-title">Emergency Contacts</div>';
            matchedContacts.forEach(c => {
                html += `
                    <div class="search-item" onclick="app.selectSearchResult('contacts', '${c.id}')">
                        <span class="search-item-title">${escapeHtml(c.name)} (${escapeHtml(c.phone)})</span>
                        <span class="search-item-sub">${escapeHtml(c.relationship || 'Contact')}</span>
                    </div>
                `;
            });
        }

        if (matchedFA.length > 0) {
            html += '<div class="search-group-title">First-Aid Guides</div>';
            matchedFA.forEach(f => {
                html += `
                    <div class="search-item" onclick="app.selectSearchResult('firstaid', '${f.id}')">
                        <span class="search-item-title">${escapeHtml(f.title)}</span>
                        <span class="search-item-sub">${escapeHtml(f.summary)}</span>
                    </div>
                `;
            });
        }

        if (matchedChk.length > 0) {
            html += '<div class="search-group-title">Disaster Checklists</div>';
            matchedChk.forEach(c => {
                html += `
                    <div class="search-item" onclick="app.selectSearchResult('checklists', '${c.id}')">
                        <span class="search-item-title">${escapeHtml(c.title)}</span>
                        <span class="search-item-sub">${c.items.length} safety steps</span>
                    </div>
                `;
            });
        }

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
    }

    function selectSearchResult(type, id) {
        document.getElementById('search-results-dropdown').classList.add('hidden');
        if (type === 'contacts') {
            navigateTo('contacts');
        } else if (type === 'firstaid') {
            navigateTo('firstaid');
            openFirstAidModal(id);
        } else if (type === 'checklists') {
            state.activeChecklistId = id;
            renderChecklists();
            navigateTo('checklists');
        }
    }

    // 10. EXPORT / IMPORT / RESET
    function initBackupUtilities() {
        document.getElementById('btn-export-json').onclick = exportBackupJson;

        document.getElementById('import-file-input').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (parsed.contacts) state.contacts = parsed.contacts;
                    if (parsed.profile) state.profile = parsed.profile;
                    if (parsed.checklists) state.checklists = parsed.checklists;
                    if (parsed.preparedness) state.preparedness = parsed.preparedness;

                    saveToLocalStorage();
                    renderAll();
                    showToast('Emergency data restored successfully from backup!', 'success');

                    fetchApi('/api/import', {
                        method: 'POST',
                        body: JSON.stringify(parsed)
                    });
                } catch (err) {
                    showToast('Invalid backup file format', 'error');
                }
            };
            reader.readAsText(file);
        };

        document.getElementById('btn-reset-all-data').onclick = () => {
            showConfirm('DELETE ALL MY DATA', 'WARNING: This will permanently wipe all your saved contacts, medical details, and checklist progress on this device.', async () => {
                localStorage.clear();
                await loadData();
                showToast('All local application data has been wiped.', 'success');

                fetchApi('/api/reset', { method: 'POST' });
            });
        };
    }

    function exportBackupJson() {
        const backupPayload = {
            contacts: state.contacts,
            profile: state.profile,
            checklists: state.checklists,
            preparedness: state.preparedness,
            first_aid: state.firstAid,
            export_metadata: {
                application: "OfflineAid",
                version: "1.0",
                exported_at: new Date().toISOString()
            }
        };

        const str = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([str], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `offlineaid_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('JSON Backup downloaded locally', 'success');
    }

    // --- MODAL & TOAST HELPERS ---
    function openModal(id) {
        document.getElementById(id).classList.remove('hidden');
    }

    function closeModal(id) {
        document.getElementById(id).classList.add('hidden');
    }

    function showConfirm(title, message, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        state.confirmCallback = callback;

        document.getElementById('confirm-ok-btn').onclick = () => {
            if (state.confirmCallback) state.confirmCallback();
            closeModal('confirm-modal');
        };

        document.getElementById('confirm-cancel-btn').onclick = () => closeModal('confirm-modal');
        openModal('confirm-modal');
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>${escapeHtml(message)}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    // --- UTILS ---
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeJsSingleQuote(str) {
        if (!str) return '';
        return String(str).replace(/'/g, "\\'");
    }

    // --- INITIALIZATION ---
    function init() {
        initNavigation();
        initContactForm();
        initSearch();
        initBackupUtilities();

        window.addEventListener('online', () => {
            state.isOnline = true;
            updateStatusBadge();
        });
        window.addEventListener('offline', () => {
            state.isOnline = false;
            updateStatusBadge();
        });

        loadData();

        // Route default hash
        const initialHash = window.location.hash.replace('#', '') || 'dashboard';
        navigateTo(initialHash, false);
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        openFirstAidModal,
        closeModal,
        switchChecklistTab,
        toggleChecklistItem,
        resetChecklist,
        togglePreparednessItem,
        editContact,
        confirmDeleteContact,
        selectSearchResult
    };
})();
