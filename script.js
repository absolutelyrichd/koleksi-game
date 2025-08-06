import { initializeApp } from "[https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js](https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js)";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "[https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js](https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js)";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from "[https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js](https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js)";

// --- Firebase Config (DO NOT CHANGE) ---
const firebaseConfig = {
    apiKey: "AIzaSyAzJTL179V9bT-DfefZq9gcG8Tz88VzLmQ",
    authDomain: "koleksi-game.firebaseapp.com",
    projectId: "koleksi-game",
    storageBucket: "koleksi-game.appspot.com",
    messagingSenderId: "222959670551",
    appId: "1:222959670551:web:048b1e2c4ef16b7bd31352",
    measurementId: "G-BYYCM7R4M8"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let games = [];
let filteredGames = [];
let unsubscribe = null;

// --- Pagination state ---
let currentPage = 1;
const gamesPerPage = 10;

// --- UI Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const gameListBody = document.getElementById('game-list-body');
const addGameButton = document.getElementById('add-game-button');
const paginationContainer = document.getElementById('pagination-container');

// --- Add/Edit Modal Elements ---
const gameModal = document.getElementById('game-modal');
const modalContent = document.getElementById('modal-content');
const gameForm = document.getElementById('game-form');
const cancelButton = document.getElementById('cancel-button');
const modalTitle = document.getElementById('modal-title');
const gameRowsContainer = document.getElementById('game-rows-container');
const addRowButton = document.getElementById('add-row-button');

// --- Bulk Edit Modal Elements ---
const bulkEditModal = document.getElementById('bulk-edit-modal');
const bulkEditModalContent = document.getElementById('bulk-edit-modal-content');
const bulkEditForm = document.getElementById('bulk-edit-form');
const bulkEditCancelButton = document.getElementById('bulk-edit-cancel-button');
const bulkEditInfo = document.getElementById('bulk-edit-info');

// --- Delete Confirmation Modal Elements ---
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmModalContent = document.getElementById('delete-confirm-modal-content');
const deleteConfirmMessage = document.getElementById('delete-confirm-message');
const cancelDeleteButton = document.getElementById('cancel-delete-button');
const confirmDeleteButton = document.getElementById('confirm-delete-button');
let gameIdToDelete = null; // To store the ID of the game to be deleted for single delete
let currentConfirmCallback = null; // To store the callback function for modal confirmation

// --- Mobile Elements ---
const sidebar = document.getElementById('sidebar');
const openSidebarButton = document.getElementById('open-sidebar-button');
const closeSidebarButton = document.getElementById('close-sidebar-button');
const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');

// --- Chart instances ---
let platformChart, locationChart, statusChart;

// --- MOBILE SIDEBAR LOGIC ---
function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    mobileMenuBackdrop.classList.remove('hidden');
}

function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    mobileMenuBackdrop.classList.add('hidden');
}

openSidebarButton.addEventListener('click', openSidebar);
closeSidebarButton.addEventListener('click', closeSidebar);
mobileMenuBackdrop.addEventListener('click', closeSidebar);

// --- TOAST/ALERT FUNCTION ---
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.className = `fixed bottom-5 right-1/2 translate-x-1/2 w-11/12 max-w-sm text-white py-3 px-5 rounded-lg shadow-lg transform transition-all duration-300 z-50 ${isError ? 'bg-red-500' : 'bg-emerald-500'} translate-y-0 opacity-100`;
    setTimeout(() => {
        toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-24 opacity-0');
    }, 3000);
}

// --- AUTHENTICATION ---
loginButton.addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .catch((error) => {
            console.error("Error signing in: ", error);
            showToast(`Gagal masuk: ${error.message}`, true);
        });
});

logoutButton.addEventListener('click', () => {
    signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        userPhoto.src = user.photoURL;
        userName.textContent = user.displayName;
        fetchGames();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        if (unsubscribe) unsubscribe();
        games = [];
        filteredGames = [];
        displayPage();
        updateCharts();
    }
    // Re-initialize icons after DOM changes
    feather.replace();
});

// --- HELPER FUNCTION FOR PLATFORM COLORS ---
function getPlatformBadgeClasses(platform) {
    const colors = {
        'Steam': 'bg-blue-100 text-blue-800',
        'Epic': 'bg-gray-200 text-gray-800',
        'GOG': 'bg-purple-100 text-purple-800',
        'EA App': 'bg-rose-100 text-rose-800',
        'PCSX': 'bg-yellow-100 text-yellow-800',
        'Crack': 'bg-red-100 text-red-800',
        'default': 'bg-slate-100 text-slate-800'
    };
    return colors[platform] || colors['default'];
}

// --- CRUD FUNCTIONS ---
function fetchGames() {
    if (!currentUser) return;
    const gamesCollectionRef = collection(db, 'games', currentUser.uid, 'userGames');
    const q = query(gamesCollectionRef, orderBy("title"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        games.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        applyFilters();
        updateCharts();
        updateBulkActionUI();
    }, (error) => {
        console.error("Error fetching games: ", error);
        showToast("Gagal memuat data game.", true);
    });
}

function renderGames(gamesToRender) {
    gameListBody.innerHTML = '';
    if (!gamesToRender || gamesToRender.length === 0) {
        gameListBody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-500">Tidak ada game yang cocok dengan filter atau belum ada game ditambahkan.</td></tr>';
        return;
    }

    gamesToRender.forEach(game => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors';
        row.innerHTML = `
            <td class="p-4"><input type="checkbox" data-id="${game.id}" class="game-checkbox rounded bg-gray-200 border-gray-300 text-emerald-500 focus:ring-emerald-500"></td>
            <td class="p-4 font-medium text-gray-800">${game.title}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getPlatformBadgeClasses(game.platform)}">${game.platform}</span></td>
            <td class="p-4 text-gray-600">${game.location}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${game.status === 'Dimainkan' ? 'bg-yellow-100 text-yellow-800' : game.status === 'Selesai' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${game.status}</span></td>
            <td class="p-4 whitespace-nowrap">
                <button class="edit-btn p-1 text-gray-400 hover:text-blue-500" data-id="${game.id}"><i data-feather="edit-2" class="h-5 w-5"></i></button>
                <button class="delete-btn p-1 text-gray-400 hover:text-red-500" data-id="${game.id}"><i data-feather="trash-2" class="h-5 w-5"></i></button>
            </td>
        `;
        gameListBody.appendChild(row);
    });
    
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    document.querySelectorAll('.game-checkbox').forEach(cb => cb.addEventListener('change', updateBulkActionUI));
    feather.replace(); // Re-initialize icons
}

// --- ADD/EDIT MODAL LOGIC ---
function createGameRowHTML(game = {}) {
    const isEdit = !!game.id;
    return `
        <div class="game-row p-4 border border-gray-200 rounded-lg space-y-3 relative bg-gray-50/50">
            ${isEdit ? '' : '<button type="button" class="remove-row-btn absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center shadow-md">&times;</button>'}
            <div class="mb-2">
                <label class="block text-gray-700 text-sm font-bold mb-1">Judul Game</label>
                <input type="text" class="game-title w-full bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" value="${game.title || ''}" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-1">Platform</label>
                    <select class="game-platform w-full bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        <option ${game.platform === 'Steam' ? 'selected' : ''}>Steam</option>
                        <option ${game.platform === 'Epic' ? 'selected' : ''}>Epic</option>
                        <option ${game.platform === 'GOG' ? 'selected' : ''}>GOG</option>
                        <option ${game.platform === 'EA App' ? 'selected' : ''}>EA App</option>
                        <option ${game.platform === 'PCSX' ? 'selected' : ''}>PCSX</option>
                        <option ${game.platform === 'Crack' ? 'selected' : ''}>Crack</option>
                    </select>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-1">Lokasi</label>
                    <select class="game-location w-full bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        <option ${game.location === 'HDD Eksternal 2TB' ? 'selected' : ''}>HDD Eksternal 2TB</option>
                        <option ${game.location === 'HDD Eksternal 4TB' ? 'selected' : ''}>HDD Eksternal 4TB</option>
                        <option ${game.location === 'Internal SSD' ? 'selected' : ''}>Internal SSD</option>
                        <option ${game.location === 'Belum Install' ? 'selected' : ''}>Belum Install</option>
                    </select>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-1">Status</label>
                    <select class="game-status w-full bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        <option ${game.status === 'Belum dimainkan' ? 'selected' : ''}>Belum dimainkan</option>
                        <option ${game.status === 'Dimainkan' ? 'selected' : ''}>Dimainkan</option>
                        <option ${game.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

function addNewGameRow() {
    gameRowsContainer.insertAdjacentHTML('beforeend', createGameRowHTML());
}

gameRowsContainer.addEventListener('click', (e) => {
    if (e.target.matches('.remove-row-btn')) {
        e.target.closest('.game-row').remove();
    }
});

function openModal(game = null) {
    gameRowsContainer.innerHTML = '';
    document.getElementById('game-id').value = game ? game.id : '';

    if (game) { // Edit mode
        modalTitle.textContent = 'Edit Game';
        gameRowsContainer.innerHTML = createGameRowHTML(game);
        addRowButton.classList.add('hidden');
    } else { // Add mode
        modalTitle.textContent = 'Tambah Game Baru';
        addNewGameRow();
        addRowButton.classList.remove('hidden');
    }

    gameModal.classList.remove('hidden');
    gameModal.classList.add('flex');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

function closeModal() {
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        gameModal.classList.add('hidden');
        gameModal.classList.remove('flex');
    }, 200);
}

addGameButton.addEventListener('click', () => openModal());
addRowButton.addEventListener('click', addNewGameRow);
cancelButton.addEventListener('click', closeModal);
gameModal.addEventListener('click', (e) => {
    if (e.target === gameModal) closeModal();
});

gameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const id = document.getElementById('game-id').value;

    try {
        if (id) {
            const row = gameRowsContainer.querySelector('.game-row');
            const gameData = {
                title: row.querySelector('.game-title').value,
                platform: row.querySelector('.game-platform').value,
                location: row.querySelector('.game-location').value,
                status: row.querySelector('.game-status').value,
            };
            if (!gameData.title) {
                showToast("Judul game tidak boleh kosong.", true);
                return;
            }
            const gameRef = doc(db, 'games', currentUser.uid, 'userGames', id);
            await updateDoc(gameRef, gameData);
            showToast('Game berhasil diperbarui!');
        } else {
            const rows = gameRowsContainer.querySelectorAll('.game-row');
            if (rows.length === 0) {
                showToast("Tidak ada game untuk ditambahkan.", true);
                return;
            }

            const batch = writeBatch(db);
            let gamesAdded = 0;
            rows.forEach(row => {
                const gameData = {
                    title: row.querySelector('.game-title').value,
                    platform: row.querySelector('.game-platform').value,
                    location: row.querySelector('.game-location').value,
                    status: row.querySelector('.game-status').value,
                };
                if (gameData.title) {
                    const newGameRef = doc(collection(db, 'games', currentUser.uid, 'userGames'));
                    batch.set(newGameRef, gameData);
                    gamesAdded++;
                }
            });

            if (gamesAdded > 0) {
                await batch.commit();
                showToast(`${gamesAdded} game berhasil ditambahkan!`);
            } else {
                showToast("Tidak ada game untuk ditambahkan.", true);
                return;
            }
        }
        closeModal();
    } catch (error) {
        console.error("Error saving game(s): ", error);
        showToast(`Gagal menyimpan: ${error.message}`, true);
    }
});

function handleEdit(e) {
    const id = e.currentTarget.dataset.id;
    const game = games.find(g => g.id === id);
    if (game) openModal(game);
}

// --- DELETE CONFIRMATION MODAL LOGIC ---
function openDeleteConfirmModal(id, message, onConfirmCallback) {
    gameIdToDelete = id;
    deleteConfirmMessage.textContent = message;
    currentConfirmCallback = onConfirmCallback;
    deleteConfirmModal.classList.remove('hidden');
    deleteConfirmModal.classList.add('flex');
    setTimeout(() => {
        deleteConfirmModalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

function closeDeleteConfirmModal() {
    deleteConfirmModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        deleteConfirmModal.classList.add('hidden');
        deleteConfirmModal.classList.remove('flex');
        gameIdToDelete = null;
        currentConfirmCallback = null;
    }, 200);
}

cancelDeleteButton.addEventListener('click', closeDeleteConfirmModal);
deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
});

confirmDeleteButton.addEventListener('click', async () => {
    if (currentConfirmCallback) {
        await currentConfirmCallback();
    }
});

function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    const gameTitle = games.find(g => g.id === id)?.title || 'game ini';
    openDeleteConfirmModal(id, `Apakah Anda yakin ingin menghapus ${gameTitle}?`, async () => {
        try {
            const gameRef = doc(db, 'games', currentUser.uid, 'userGames', id);
            await deleteDoc(gameRef);
            showToast('Game berhasil dihapus.');
            closeDeleteConfirmModal();
        } catch (error) {
            console.error("Error deleting game: ", error);
            showToast(`Gagal menghapus: ${error.message}`, true);
        }
    });
}

// --- TAB SWITCHING ---
const tabs = document.getElementById('tabs');
const tabContents = document.querySelectorAll('.tab-content');
tabs.addEventListener('click', (e) => {
    const button = e.target.closest('.tab-button');
    if (!button) return;

    tabs.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('tab-inactive');
    });
    button.classList.add('tab-active');
    button.classList.remove('tab-inactive');

    const tabId = button.dataset.tab;
    tabContents.forEach(content => {
        content.id === tabId ? content.classList.remove('hidden') : content.classList.add('hidden');
    });
    if (window.innerWidth < 768) {
        closeSidebar();
    }
});

// --- CHART LOGIC ---
function initCharts() {
    const pieDoughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#4b5563', padding: 15, font: { size: 12 } }
            }
        },
        onHover: (event, chartElement) => {
            event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
        },
        elements: { arc: { hoverOffset: 12, borderWidth: 2, borderColor: '#fff' } }
    };
    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        onHover: (event, chartElement) => {
            event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
        },
        scales: {
            y: { ticks: { color: '#6b7280' }, grid: { color: '#e5e7eb' } },
            x: { ticks: { color: '#6b7280' }, grid: { color: '#f8f9fa' } }
        }
    };

    platformChart = new Chart(document.getElementById('platform-chart'), { type: 'doughnut', data: {}, options: pieDoughnutOptions });
    locationChart = new Chart(document.getElementById('location-chart'), { type: 'pie', data: {}, options: pieDoughnutOptions });
    statusChart = new Chart(document.getElementById('status-chart'), { type: 'bar', data: {}, options: barOptions });
}

function updateCharts() {
    if (!platformChart) initCharts();

    const platformData = games.reduce((acc, game) => { acc[game.platform] = (acc[game.platform] || 0) + 1; return acc; }, {});
    platformChart.data = {
        labels: Object.keys(platformData),
        datasets: [{ data: Object.values(platformData), backgroundColor: ['#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f97316', '#f59e0b'] }]
    };
    platformChart.update();

    const locationData = games.reduce((acc, game) => { acc[game.location] = (acc[game.location] || 0) + 1; return acc; }, {});
    locationChart.data = {
        labels: Object.keys(locationData),
        datasets: [{ data: Object.values(locationData), backgroundColor: ['#10b981', '#06b6d4', '#8b5cf6', '#ef4444'] }]
    };
    locationChart.update();

    const statusData = games.reduce((acc, game) => { acc[game.status] = (acc[game.status] || 0) + 1; return acc; }, {});
    const statusLabels = Object.keys(statusData);
    const statusValues = Object.values(statusData);
    const statusColors = { 'Belum dimainkan': '#6b7280', 'Dimainkan': '#f59e0b', 'Selesai': '#10b981' };
    const hoverStatusColors = { 'Belum dimainkan': '#9ca3af', 'Dimainkan': '#facc15', 'Selesai': '#34d399' };
    statusChart.data = {
        labels: statusLabels,
        datasets: [{
            label: 'Jumlah Game',
            data: statusValues,
            backgroundColor: statusLabels.map(label => statusColors[label] || '#6b7280'),
            hoverBackgroundColor: statusLabels.map(label => hoverStatusColors[label] || '#9ca3af'),
            borderRadius: 4, borderWidth: 0
        }]
    };
    statusChart.update();
}

// --- FILTERING AND PAGINATION LOGIC ---
const filterTitle = document.getElementById('filter-title');
const filterPlatform = document.getElementById('filter-platform');
const filterLocation = document.getElementById('filter-location');
const filterStatus = document.getElementById('filter-status');

[filterTitle, filterPlatform, filterLocation, filterStatus].forEach(el => {
    el.addEventListener('input', () => {
        currentPage = 1;
        applyFilters();
    });
});

function applyFilters() {
    const title = filterTitle.value.toLowerCase();
    const platform = filterPlatform.value;
    const location = filterLocation.value;
    const status = filterStatus.value;

    filteredGames = games.filter(game => {
        return (title === '' || game.title.toLowerCase().includes(title)) &&
            (platform === '' || game.platform === platform) &&
            (location === '' || game.location === location) &&
            (status === '' || game.status === status);
    });
    displayPage();
}

function displayPage() {
    const startIndex = (currentPage - 1) * gamesPerPage;
    const endIndex = startIndex + gamesPerPage;
    const paginatedGames = filteredGames.slice(startIndex, endIndex);

    renderGames(paginatedGames);
    setupPagination();
    updateBulkActionUI();
    document.getElementById('select-all-checkbox').checked = false;
}

function setupPagination() {
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
    if (totalPages <= 1) return;

    const createButton = (text, page, isDisabled = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.className = 'px-3 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-100 pagination-button';
        if (isDisabled) button.classList.add('text-gray-400', 'cursor-not-allowed');
        button.addEventListener('click', () => { if (!isDisabled) { currentPage = page; displayPage(); } });
        return button;
    };
    
    paginationContainer.appendChild(createButton('&laquo;', currentPage - 1, currentPage === 1));

    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    if (endPage - startPage + 1 < maxPageButtons) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    if (startPage > 1) {
        paginationContainer.appendChild(createButton('1', 1));
        if (startPage > 2) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-gray-500">...</span>`);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = createButton(i, i);
        if (i === currentPage) pageButton.classList.add('active');
        paginationContainer.appendChild(pageButton);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-gray-500">...</span>`);
        paginationContainer.appendChild(createButton(totalPages, totalPages));
    }

    paginationContainer.appendChild(createButton('&raquo;', currentPage + 1, currentPage === totalPages));
}

// --- BULK ACTIONS LOGIC ---
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const bulkDeleteButton = document.getElementById('bulk-delete-button');
const bulkEditButton = document.getElementById('bulk-edit-button');
const selectionInfo = document.getElementById('selection-info');

selectAllCheckbox.addEventListener('change', (e) => {
    document.querySelectorAll('.game-checkbox').forEach(cb => { cb.checked = e.target.checked; });
    updateBulkActionUI();
});

function updateBulkActionUI() {
    const selectedIds = getSelectedGameIds();
    const hasSelection = selectedIds.length > 0;

    bulkDeleteButton.disabled = !hasSelection;
    bulkEditButton.disabled = !hasSelection;

    if (hasSelection) {
        selectionInfo.innerHTML = `<b class="text-gray-700">${selectedIds.length} game terpilih.</b> Aksi hanya berlaku untuk item yang terlihat di halaman ini.`;
    } else {
        selectionInfo.textContent = `Pilih game dari 'Daftar Game' untuk melakukan aksi masal.`;
    }
}

function getSelectedGameIds() {
    return Array.from(document.querySelectorAll('.game-checkbox:checked')).map(cb => cb.dataset.id);
}

bulkDeleteButton.addEventListener('click', async () => {
    const idsToDelete = getSelectedGameIds();
    if (idsToDelete.length === 0) return;

    openDeleteConfirmModal(null, `Apakah Anda yakin ingin menghapus ${idsToDelete.length} game terpilih?`, async () => {
        try {
            const batch = writeBatch(db);
            idsToDelete.forEach(id => {
                const gameRef = doc(db, 'games', currentUser.uid, 'userGames', id);
                batch.delete(gameRef);
            });
            await batch.commit();
            showToast(`${idsToDelete.length} game berhasil dihapus.`);
            selectAllCheckbox.checked = false;
            closeDeleteConfirmModal();
        } catch (error) {
            console.error("Error bulk deleting: ", error);
            showToast(`Gagal menghapus game: ${error.message}`, true);
        }
    });
});

// --- BULK EDIT MODAL LOGIC ---
function openBulkEditModal() {
    const selectedIds = getSelectedGameIds();
    if (selectedIds.length === 0) return;

    bulkEditInfo.textContent = `Anda akan mengedit ${selectedIds.length} game. Centang properti yang ingin Anda ubah.`;
    bulkEditForm.reset();

    bulkEditModal.classList.remove('hidden');
    bulkEditModal.classList.add('flex');
    setTimeout(() => {
        bulkEditModalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

function closeBulkEditModal() {
    bulkEditModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        bulkEditModal.classList.add('hidden');
        bulkEditModal.classList.remove('flex');
    }, 200);
}

bulkEditButton.addEventListener('click', openBulkEditModal);
bulkEditCancelButton.addEventListener('click', closeBulkEditModal);
bulkEditModal.addEventListener('click', (e) => {
    if (e.target === bulkEditModal) closeBulkEditModal();
});

bulkEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idsToUpdate = getSelectedGameIds();
    if (idsToUpdate.length === 0) return;

    const updateData = {};
    if (document.getElementById('bulk-update-platform-check').checked) {
        updateData.platform = document.getElementById('bulk-platform').value;
    }
    if (document.getElementById('bulk-update-location-check').checked) {
        updateData.location = document.getElementById('bulk-location').value;
    }
    if (document.getElementById('bulk-update-status-check').checked) {
        updateData.status = document.getElementById('bulk-status').value;
    }

    if (Object.keys(updateData).length === 0) {
        showToast("Tidak ada perubahan yang dipilih. Centang properti yang ingin diubah.", true);
        return;
    }

    try {
        const batch = writeBatch(db);
        idsToUpdate.forEach(id => {
            const gameRef = doc(db, 'games', currentUser.uid, 'userGames', id);
            batch.update(gameRef, updateData);
        });
        await batch.commit();
        showToast(`${idsToUpdate.length} game berhasil diperbarui.`);
        selectAllCheckbox.checked = false;
        closeBulkEditModal();
    } catch (error) {
        console.error("Error bulk updating: ", error);
        showToast(`Gagal memperbarui game: ${error.message}`, true);
    }
});

// --- DATA MANAGEMENT ---
const downloadJsonButton = document.getElementById('download-json-button');
const uploadJsonButton = document.getElementById('upload-json-button');
const jsonFileInput = document.getElementById('json-file-input');

downloadJsonButton.addEventListener('click', () => {
    if (games.length === 0) {
        showToast("Tidak ada data untuk diunduh.", true);
        return;
    }
    const dataStr = JSON.stringify(games.map(({ id, ...rest }) => rest), null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'koleksi_game.json');
    linkElement.click();
    showToast("Data sedang diunduh...");
});

uploadJsonButton.addEventListener('click', () => jsonFileInput.click());

jsonFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedGames = JSON.parse(event.target.result);
            if (!Array.isArray(importedGames)) {
                throw new Error("File JSON harus berisi sebuah array.");
            }

            openDeleteConfirmModal(null, `Anda akan mengimpor ${importedGames.length} game. Lanjutkan?`, async () => {
                try {
                    const batch = writeBatch(db);
                    const gamesCollection = collection(db, 'games', currentUser.uid, 'userGames');
                    importedGames.forEach(game => {
                        if (game.title && game.platform && game.location && game.status) {
                            const newGameRef = doc(gamesCollection);
                            batch.set(newGameRef, game);
                        }
                    });
                    await batch.commit();
                    showToast(`${importedGames.length} game berhasil diimpor.`);
                    closeDeleteConfirmModal();
                } catch (error) {
                    console.error("Error importing JSON: ", error);
                    showToast(`Gagal mengimpor: ${error.message}`, true);
                } finally {
                    jsonFileInput.value = '';
                }
            });

        } catch (error) {
            console.error("Error parsing JSON: ", error);
            showToast(`Gagal mengimpor: ${error.message}`, true);
        } finally {
            jsonFileInput.value = '';
        }
    };
    reader.readAsText(file);
});
