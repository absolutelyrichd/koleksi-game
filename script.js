import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- App State ---
let currentPage = 1;
const gamesPerPage = 10;
let sortState = { column: 'title', direction: 'asc' };

// --- UI Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const gameListBody = document.getElementById('game-list-body');
const gameListCards = document.getElementById('game-list-cards');
const addGameButtonHeader = document.getElementById('add-game-button-header');
const paginationContainer = document.getElementById('pagination-container');
const pageTitle = document.getElementById('page-title');

// Statistik
const totalPriceElement = document.getElementById('total-price');
const mostExpensiveGameElement = document.getElementById('most-expensive-game');

// Modals
const gameModal = document.getElementById('game-modal');
const modalContent = document.getElementById('modal-content');
const gameForm = document.getElementById('game-form');
const cancelButton = document.getElementById('cancel-button');
const modalTitle = document.getElementById('modal-title');
const gameRowsContainer = document.getElementById('game-rows-container');
const addRowButton = document.getElementById('add-row-button');
const bulkEditModal = document.getElementById('bulk-edit-modal');
const bulkEditModalContent = document.getElementById('bulk-edit-modal-content');
const bulkEditForm = document.getElementById('bulk-edit-form');
const bulkEditCancelButton = document.getElementById('bulk-edit-cancel-button');
const bulkEditInfo = document.getElementById('bulk-edit-info');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmModalContent = document.getElementById('delete-confirm-modal-content');
const deleteConfirmMessage = document.getElementById('delete-confirm-message');
const cancelDeleteButton = document.getElementById('cancel-delete-button');
const confirmDeleteButton = document.getElementById('confirm-delete-button');
let currentConfirmCallback = null;

// Mobile Sidebar
const sidebar = document.getElementById('sidebar');
const openSidebarButton = document.getElementById('open-sidebar-button');
const closeSidebarButton = document.getElementById('close-sidebar-button');
const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');

// Chart instances
let platformChart, locationChart, statusChart;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupEventListeners();
});

// --- EVENT LISTENERS ---
function setupEventListeners() {
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);

    openSidebarButton.addEventListener('click', openSidebar);
    closeSidebarButton.addEventListener('click', closeSidebar);
    mobileMenuBackdrop.addEventListener('click', closeSidebar);

    addGameButtonHeader.addEventListener('click', () => openModal());
    addRowButton.addEventListener('click', addNewGameRow);
    cancelButton.addEventListener('click', closeModal);
    gameModal.addEventListener('click', (e) => e.target === gameModal && closeModal());
    gameForm.addEventListener('submit', handleFormSubmit);

    document.querySelectorAll('.tab-button').forEach(btn => btn.addEventListener('click', handleTabClick));
    document.querySelectorAll('.sortable').forEach(header => header.addEventListener('click', handleSort));

    ['filter-title', 'filter-platform', 'filter-location', 'filter-status'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            currentPage = 1;
            applyFiltersAndSort();
        });
    });

    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
        document.querySelectorAll('.game-checkbox').forEach(cb => { cb.checked = e.target.checked; });
        updateBulkActionUI();
    });

    // Bulk Actions
    document.getElementById('bulk-delete-button').addEventListener('click', handleBulkDelete);
    document.getElementById('bulk-edit-button').addEventListener('click', openBulkEditModal);
    bulkEditCancelButton.addEventListener('click', closeBulkEditModal);
    bulkEditModal.addEventListener('click', (e) => e.target === bulkEditModal && closeBulkEditModal());
    bulkEditForm.addEventListener('submit', handleBulkEditSubmit);

    // Delete Confirmation
    cancelDeleteButton.addEventListener('click', closeDeleteConfirmModal);
    confirmDeleteButton.addEventListener('click', () => currentConfirmCallback && currentConfirmCallback());
    deleteConfirmModal.addEventListener('click', (e) => e.target === deleteConfirmModal && closeDeleteConfirmModal());
    
    // Data Management
    document.getElementById('download-json-button').addEventListener('click', downloadJson);
    const jsonFileInput = document.getElementById('json-file-input');
    document.getElementById('upload-json-button').addEventListener('click', () => jsonFileInput.click());
    jsonFileInput.addEventListener('change', uploadJson);
}


// --- AUTHENTICATION ---
function handleLogin() {
    signInWithPopup(auth, provider).catch(error => {
        console.error("Error signing in: ", error);
        showToast(`Gagal masuk: ${error.message}`, true);
    });
}

function handleLogout() {
    signOut(auth);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appScreen.classList.add('flex');
        
        userPhoto.src = user.photoURL;
        userName.textContent = user.displayName;
        
        fetchGames();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        appScreen.classList.remove('flex');

        if (unsubscribe) unsubscribe();
        games = [];
        filteredGames = [];
        displayPage();
        updateCharts();
    }
});

// --- UI HELPERS ---
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    
    toast.classList.toggle('bg-red-500', isError);
    toast.classList.toggle('bg-green-500', !isError);
    
    toast.classList.remove('translate-x-[120%]');
    setTimeout(() => {
        toast.classList.add('translate-x-[120%]');
    }, 3000);
}

function getPlatformBadgeClasses(platform) {
    const colors = {
        'Steam': 'bg-sky-500/20 text-sky-300',
        'Epic': 'bg-slate-400/20 text-slate-200',
        'GOG': 'bg-purple-500/20 text-purple-300',
		'EA App': 'bg-rose-500/20 text-rose-300',
        'U-Connect': 'bg-blue-500/20 text-blue-300',
        'PCSX': 'bg-amber-500/20 text-amber-300',
        'Crack': 'bg-red-500/20 text-red-300',
        'default': 'bg-slate-500/20 text-slate-300'
    };
    return colors[platform] || colors['default'];
}

function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(price);
}

// --- SIDEBAR ---
function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    mobileMenuBackdrop.classList.remove('hidden');
}

function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    mobileMenuBackdrop.classList.add('hidden');
}

// --- TABS ---
function handleTabClick(e) {
    const button = e.target.closest('.tab-button');
    if (!button) return;

    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('text-slate-300', 'hover:bg-slate-700', 'hover:text-white');
    });

    button.classList.add('tab-active');
    button.classList.remove('text-slate-300', 'hover:bg-slate-700', 'hover:text-white');

    const tabId = button.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== tabId);
    });

    pageTitle.textContent = button.textContent.trim();
    if (window.innerWidth < 768) closeSidebar();
}

// --- DATA FETCH & RENDER ---
function fetchGames() {
    if (!currentUser) return;
    const gamesCollectionRef = collection(db, 'games', currentUser.uid, 'userGames');
    const q = query(gamesCollectionRef, orderBy("title")); 

    unsubscribe = onSnapshot(q, (snapshot) => {
        games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyFiltersAndSort();
        updateCharts();
        updateBulkActionUI();
    }, (error) => {
        console.error("Error fetching games: ", error);
        showToast("Gagal memuat data game.", true);
    });
}

function renderGames(gamesToRender) {
    gameListBody.innerHTML = '';
    gameListCards.innerHTML = '';
    
    if (!gamesToRender || gamesToRender.length === 0) {
        const emptyMessage = '<div class="text-center p-8 text-slate-400">Tidak ada game ditemukan.</div>';
        gameListBody.innerHTML = `<tr><td colspan="7">${emptyMessage}</td></tr>`;
        gameListCards.innerHTML = emptyMessage;
        return;
    }
    
    // Render table and cards
    const tableRows = gamesToRender.map(renderGameAsRow).join('');
    const cardElements = gamesToRender.map(renderGameAsCard).join('');
    gameListBody.innerHTML = tableRows;
    gameListCards.innerHTML = cardElements;

    // Re-add event listeners
    document.querySelectorAll('.edit-btn, .delete-btn, .game-checkbox').forEach(el => {
        if (el.classList.contains('edit-btn')) el.addEventListener('click', handleEditClick);
        if (el.classList.contains('delete-btn')) el.addEventListener('click', handleDeleteClick);
        if (el.classList.contains('game-checkbox')) el.addEventListener('change', updateBulkActionUI);
    });
    
    lucide.createIcons();
    updateSortIcons();
}

function renderGameAsRow(game) {
    return `
        <tr class="hover:bg-slate-700/50 transition-colors">
            <td class="p-4"><input type="checkbox" data-id="${game.id}" class="game-checkbox h-4 w-4 rounded bg-slate-600 border-slate-500 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"></td>
            <td class="p-4 font-medium text-white">${game.title}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getPlatformBadgeClasses(game.platform)}">${game.platform}</span></td>
            <td class="p-4 text-slate-300">${game.location}</td>
            <td class="p-4 text-cyan-400 font-semibold">${game.price ? formatPrice(game.price) : 'Gratis'}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${game.status === 'Dimainkan' ? 'bg-yellow-500/20 text-yellow-300' : game.status === 'Selesai' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}">${game.status}</span></td>
            <td class="p-4 whitespace-nowrap space-x-2">
                <button class="edit-btn p-1 text-slate-400 hover:text-white" data-id="${game.id}"><i data-lucide="pencil" class="h-4 w-4"></i></button>
                <button class="delete-btn p-1 text-slate-400 hover:text-red-400" data-id="${game.id}"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
            </td>
        </tr>
    `;
}

function renderGameAsCard(game) {
    return `
        <div class="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
            <div class="flex justify-between items-start">
                <div class="flex items-center space-x-3">
                    <input type="checkbox" data-id="${game.id}" class="game-checkbox mt-1 h-4 w-4 rounded bg-slate-600 border-slate-500 text-cyan-500 focus:ring-cyan-500">
                    <span class="font-bold text-lg text-white">${game.title}</span>
                </div>
                <div class="flex space-x-1">
                    <button class="edit-btn p-1 text-slate-400 hover:text-white" data-id="${game.id}"><i data-lucide="pencil" class="h-4 w-4"></i></button>
                    <button class="delete-btn p-1 text-slate-400 hover:text-red-400" data-id="${game.id}"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div class="text-slate-400">Platform</div><div class="font-semibold text-white text-right">${game.platform}</div>
                <div class="text-slate-400">Lokasi</div><div class="font-semibold text-white text-right">${game.location}</div>
                <div class="text-slate-400">Harga</div><div class="font-semibold text-cyan-400 text-right">${game.price ? formatPrice(game.price) : 'Gratis'}</div>
                <div class="text-slate-400">Status</div><div class="font-semibold text-white text-right">${game.status}</div>
            </div>
        </div>
    `;
}

function handleEditClick(e) {
    const id = e.currentTarget.dataset.id;
    const game = games.find(g => g.id === id);
    if (game) openModal(game);
}

function handleDeleteClick(e) {
    const id = e.currentTarget.dataset.id;
    const gameTitle = games.find(g => g.id === id)?.title || 'game ini';
    openDeleteConfirmModal(`Apakah Anda yakin ingin menghapus ${gameTitle}?`, async () => {
        try {
            await deleteDoc(doc(db, 'games', currentUser.uid, 'userGames', id));
            showToast('Game berhasil dihapus.');
            closeDeleteConfirmModal();
        } catch (error) {
            console.error("Error deleting game: ", error);
            showToast(`Gagal menghapus: ${error.message}`, true);
        }
    });
}


// --- ADD/EDIT MODAL ---
function createGameRowHTML(game = {}) {
    const isEdit = !!game.id;
    return `
        <div class="game-row p-4 border border-slate-700 rounded-lg space-y-3 relative bg-slate-900/50">
            ${isEdit ? '' : '<button type="button" class="remove-row-btn absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center hover:bg-red-500">&times;</button>'}
            <div>
                <label class="block text-slate-300 text-sm font-bold mb-1">Judul Game</label>
                <input type="text" class="game-title w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none" value="${game.title || ''}" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <select class="game-platform w-full bg-slate-700 border border-slate-600 rounded-lg p-2"><option ${game.platform === 'Steam' ? 'selected':''}>Steam</option><option ${game.platform === 'Epic' ? 'selected':''}>Epic</option><option ${game.platform === 'GOG' ? 'selected':''}>GOG</option><option ${game.platform === 'EA App' ? 'selected':''}>EA App</option><option ${game.platform === 'U-Connect' ? 'selected':''}>U-Connect</option><option ${game.platform === 'PCSX' ? 'selected':''}>PCSX</option><option ${game.platform === 'Crack' ? 'selected':''}>Crack</option></select>
                <select class="game-location w-full bg-slate-700 border border-slate-600 rounded-lg p-2"><option ${game.location === 'HDD Eksternal 2TB' ? 'selected':''}>HDD Eksternal 2TB</option><option ${game.location === 'HDD Eksternal 4TB' ? 'selected':''}>HDD Eksternal 4TB</option><option ${game.location === 'Internal SSD' ? 'selected':''}>Internal SSD</option><option ${game.location === 'Belum Install' ? 'selected':''}>Belum Install</option></select>
                <input type="number" class="game-price w-full bg-slate-700 border border-slate-600 rounded-lg p-2" value="${game.price || '0'}" min="0" placeholder="Harga">
                <select class="game-status w-full bg-slate-700 border border-slate-600 rounded-lg p-2"><option ${game.status === 'Belum dimainkan' ? 'selected':''}>Belum dimainkan</option><option ${game.status === 'Dimainkan' ? 'selected':''}>Dimainkan</option><option ${game.status === 'Selesai' ? 'selected':''}>Selesai</option></select>
            </div>
        </div>`;
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
    gameForm.reset();
    document.getElementById('game-id').value = game ? game.id : '';
    gameRowsContainer.innerHTML = '';
    
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
    setTimeout(() => modalContent.classList.remove('scale-95', 'opacity-0'), 10);
}

function closeModal() {
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        gameModal.classList.add('hidden');
        gameModal.classList.remove('flex');
    }, 200);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    const id = document.getElementById('game-id').value;
    
    try {
        if (id) { // Update
            const row = gameRowsContainer.querySelector('.game-row');
            const gameData = getGameDataFromRow(row);
            if (!gameData.title) return showToast("Judul game tidak boleh kosong.", true);
            await updateDoc(doc(db, 'games', currentUser.uid, 'userGames', id), gameData);
            showToast('Game berhasil diperbarui!');
        } else { // Add new
            const rows = gameRowsContainer.querySelectorAll('.game-row');
            if (rows.length === 0) return showToast("Tidak ada game untuk ditambahkan.", true);
            
            const batch = writeBatch(db);
            let gamesAdded = 0;
            rows.forEach(row => {
                const gameData = getGameDataFromRow(row);
                if (gameData.title) {
                    batch.set(doc(collection(db, 'games', currentUser.uid, 'userGames')), gameData);
                    gamesAdded++;
                }
            });
            
            if (gamesAdded > 0) {
                await batch.commit();
                showToast(`${gamesAdded} game berhasil ditambahkan!`);
            } else {
                return showToast("Tidak ada game untuk ditambahkan.", true);
            }
        }
        closeModal();
    } catch (error) {
        console.error("Error saving game(s): ", error);
        showToast(`Gagal menyimpan: ${error.message}`, true);
    }
}

function getGameDataFromRow(row) {
    return {
        title: row.querySelector('.game-title').value,
        platform: row.querySelector('.game-platform').value,
        location: row.querySelector('.game-location').value,
        price: parseInt(row.querySelector('.game-price').value, 10) || 0,
        status: row.querySelector('.game-status').value,
    };
}


// --- DELETE CONFIRMATION ---
function openDeleteConfirmModal(message, onConfirmCallback) {
    deleteConfirmMessage.textContent = message;
    currentConfirmCallback = onConfirmCallback;
    deleteConfirmModal.classList.remove('hidden');
    deleteConfirmModal.classList.add('flex');
    setTimeout(() => deleteConfirmModalContent.classList.remove('scale-95', 'opacity-0'), 10);
}

function closeDeleteConfirmModal() {
    deleteConfirmModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        deleteConfirmModal.classList.add('hidden');
        deleteConfirmModal.classList.remove('flex');
        currentConfirmCallback = null;
    }, 200);
}

// --- CHARTS ---
function initCharts() {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', padding: 15, font: { size: 12 } } } },
        onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default'; },
    };
    platformChart = new Chart(document.getElementById('platform-chart'), { type: 'doughnut', data: {}, options: {...commonOptions, elements: { arc: { hoverOffset: 12, borderWidth: 0 }}} });
    locationChart = new Chart(document.getElementById('location-chart'), { type: 'pie', data: {}, options: {...commonOptions, elements: { arc: { hoverOffset: 12, borderWidth: 0 }}} });
    statusChart = new Chart(document.getElementById('status-chart'), { type: 'bar', data: {}, options: { ...commonOptions, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } } } });
}

function updateCharts() {
    if (!platformChart) initCharts();

    const totalPrice = games.reduce((sum, game) => sum + (game.price || 0), 0);
    const mostExpensiveGame = games.length > 0 ? games.reduce((max, game) => (game.price > max.price ? game : max), { price: -1 }) : null;
    totalPriceElement.textContent = formatPrice(totalPrice);
    mostExpensiveGameElement.textContent = mostExpensiveGame && mostExpensiveGame.price > 0 ? `${mostExpensiveGame.title}` : 'N/A';
    
    const chartColors = ['#22d3ee', '#a78bfa', '#f471b5', '#fb923c', '#38bdf8', '#f87171', '#4ade80'];

    const platformData = games.reduce((acc, {platform}) => { acc[platform] = (acc[platform] || 0) + 1; return acc; }, {});
    platformChart.data = { labels: Object.keys(platformData), datasets: [{ data: Object.values(platformData), backgroundColor: chartColors }] };
    platformChart.update();

    const locationData = games.reduce((acc, {location}) => { acc[location] = (acc[location] || 0) + 1; return acc; }, {});
    locationChart.data = { labels: Object.keys(locationData), datasets: [{ data: Object.values(locationData), backgroundColor: chartColors.slice(0, Object.keys(locationData).length) }] };
    locationChart.update();
    
    const statusData = games.reduce((acc, {status}) => { acc[status] = (acc[status] || 0) + 1; return acc; }, {});
    const statusLabels = Object.keys(statusData);
    statusChart.data = { labels: statusLabels, datasets: [{ data: Object.values(statusData), backgroundColor: statusLabels.map(l => ({'Belum dimainkan': '#64748b', 'Dimainkan': '#eab308', 'Selesai': '#22c55e'})[l]), borderRadius: 4 }] };
    statusChart.update();
}

// --- FILTER, SORT, PAGINATE ---
function handleSort(e) {
    const column = e.currentTarget.dataset.sort;
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }
    currentPage = 1;
    applyFiltersAndSort();
}

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '');
    const currentHeader = document.querySelector(`th[data-sort="${sortState.column}"] .sort-icon`);
    if (currentHeader) currentHeader.textContent = sortState.direction === 'asc' ? '▲' : '▼';
}

function applyFiltersAndSort() {
    const title = document.getElementById('filter-title').value.toLowerCase();
    const platform = document.getElementById('filter-platform').value;
    const location = document.getElementById('filter-location').value;
    const status = document.getElementById('filter-status').value;

    filteredGames = games
        .filter(g => 
            g.title.toLowerCase().includes(title) &&
            (platform === '' || g.platform === platform) &&
            (location === '' || g.location === location) &&
            (status === '' || g.status === status)
        )
        .sort((a, b) => {
            let aValue = a[sortState.column];
            let bValue = b[sortState.column];
            let compare = 0;
            if (typeof aValue === 'string') compare = aValue.localeCompare(bValue, undefined, { sensitivity: 'base' });
            else compare = (aValue || 0) - (bValue || 0);
            return sortState.direction === 'asc' ? compare : -compare;
        });
    displayPage();
}

function displayPage() {
    const paginatedGames = filteredGames.slice((currentPage - 1) * gamesPerPage, currentPage * gamesPerPage);
    renderGames(paginatedGames);
    setupPagination();
    updateBulkActionUI();
    document.getElementById('select-all-checkbox').checked = false;
}

function setupPagination() {
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
    if (totalPages <= 1) return;

    const createButton = (text, page, disabled = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.className = `px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button ${page === currentPage ? 'active' : ''}`;
        if (disabled) button.classList.add('opacity-50', 'cursor-not-allowed');
        else button.addEventListener('click', () => { currentPage = page; displayPage(); });
        return button;
    };

    paginationContainer.appendChild(createButton('&laquo;', currentPage - 1, currentPage === 1));
    for (let i = 1; i <= totalPages; i++) {
        paginationContainer.appendChild(createButton(i, i));
    }
    paginationContainer.appendChild(createButton('&raquo;', currentPage + 1, currentPage === totalPages));
}

// --- BULK ACTIONS ---
function getSelectedGameIds() {
    return Array.from(document.querySelectorAll('.game-checkbox:checked')).map(cb => cb.dataset.id);
}

function updateBulkActionUI() {
    const selectedIds = getSelectedGameIds();
    const hasSelection = selectedIds.length > 0;
    
    document.getElementById('bulk-delete-button').disabled = !hasSelection;
    document.getElementById('bulk-edit-button').disabled = !hasSelection;
    
    selectionInfo.innerHTML = hasSelection 
        ? `<b>${selectedIds.length} game terpilih.</b>`
        : `Pilih game dari 'Daftar Game' untuk melakukan aksi masal.`;
}

async function handleBulkDelete() {
    const idsToDelete = getSelectedGameIds();
    if (idsToDelete.length === 0) return;
    
    openDeleteConfirmModal(`Apakah Anda yakin ingin menghapus ${idsToDelete.length} game terpilih?`, async () => {
        try {
            const batch = writeBatch(db);
            idsToDelete.forEach(id => batch.delete(doc(db, 'games', currentUser.uid, 'userGames', id)));
            await batch.commit();
            showToast(`${idsToDelete.length} game berhasil dihapus.`);
            closeDeleteConfirmModal();
        } catch (error) {
            console.error("Error bulk deleting: ", error);
            showToast(`Gagal menghapus: ${error.message}`, true);
        }
    });
}

function openBulkEditModal() {
    const selectedIds = getSelectedGameIds();
    if (selectedIds.length === 0) return;
    bulkEditInfo.textContent = `Anda akan mengedit ${selectedIds.length} game.`;
    bulkEditForm.reset();
    bulkEditModal.classList.remove('hidden');
    bulkEditModal.classList.add('flex');
    setTimeout(() => bulkEditModalContent.classList.remove('scale-95', 'opacity-0'), 10);
}

function closeBulkEditModal() {
    bulkEditModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        bulkEditModal.classList.add('hidden');
        bulkEditModal.classList.remove('flex');
    }, 200);
}

async function handleBulkEditSubmit(e) {
    e.preventDefault();
    const idsToUpdate = getSelectedGameIds();
    if (idsToUpdate.length === 0) return;

    const updateData = {};
    if (document.getElementById('bulk-update-platform-check').checked) updateData.platform = document.getElementById('bulk-platform').value;
    if (document.getElementById('bulk-update-location-check').checked) updateData.location = document.getElementById('bulk-location').value;
    if (document.getElementById('bulk-update-price-check').checked) updateData.price = parseInt(document.getElementById('bulk-price').value, 10);
    if (document.getElementById('bulk-update-status-check').checked) updateData.status = document.getElementById('bulk-status').value;

    if (Object.keys(updateData).length === 0) {
        return showToast("Pilih properti yang ingin diubah.", true);
    }

    try {
        const batch = writeBatch(db);
        idsToUpdate.forEach(id => batch.update(doc(db, 'games', currentUser.uid, 'userGames', id), updateData));
        await batch.commit();
        showToast(`${idsToUpdate.length} game berhasil diperbarui.`);
        closeBulkEditModal();
    } catch (error) {
        console.error("Error bulk updating: ", error);
        showToast(`Gagal memperbarui: ${error.message}`, true);
    }
}

// --- DATA MANAGEMENT ---
function downloadJson() {
    if (games.length === 0) return showToast("Tidak ada data untuk diunduh.", true);
    const dataStr = JSON.stringify(games.map(({id, ...rest}) => rest), null, 2);
    const link = document.createElement('a');
    link.href = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    link.download = 'koleksi_game.json';
    link.click();
    showToast("Data sedang diunduh...");
}

function uploadJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedGames = JSON.parse(event.target.result);
            if (!Array.isArray(importedGames)) throw new Error("File JSON harus berupa array.");
            
            openDeleteConfirmModal(`Anda akan mengimpor ${importedGames.length} game. Lanjutkan?`, async () => {
                try {
                    const batch = writeBatch(db);
                    importedGames.forEach(game => {
                        if (game.title && game.platform && game.location && game.status) {
                            batch.set(doc(collection(db, 'games', currentUser.uid, 'userGames')), game);
                        }
                    });
                    await batch.commit();
                    showToast(`${importedGames.length} game berhasil diimpor.`);
                    closeDeleteConfirmModal();
                } catch (error) {
                    showToast(`Gagal mengimpor: ${error.message}`, true);
                } finally {
                    e.target.value = '';
                }
            });
        } catch (error) {
            showToast(`Gagal memuat file: ${error.message}`, true);
        }
    };
    reader.readAsText(file);
}
