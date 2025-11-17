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

// --- Pagination state ---
let currentPage = 1;
const gamesPerPage = 10;

// --- Sort state ---
let sortState = {
    column: 'title', // Default sort column
    direction: 'asc' // Default sort direction
};

// --- UI Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginButton = document.getElementById('login-button');
const logoutButtonText = document.getElementById('logout-button-text');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const gameListBody = document.getElementById('game-list-body');
const gameListCards = document.getElementById('game-list-cards');
const addGameButton = document.getElementById('add-game-button');
const paginationContainer = document.getElementById('pagination-container');
const totalPriceElement = document.getElementById('total-price');
const mostExpensiveGameElement = document.getElementById('most-expensive-game');

// --- Modals & Forms ---
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
let gameIdToDelete = null; 
let currentConfirmCallback = null;

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
    toast.className = `fixed bottom-5 right-1/2 translate-x-1/2 w-11/12 max-w-sm text-white py-2 px-4 rounded-lg shadow-lg transform transition-all duration-300 z-50 ${isError ? 'bg-red-500' : 'bg-green-500'} translate-y-0 opacity-100`;
    setTimeout(() => {
        toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-20 opacity-0');
    }, 3000);
}

// --- AUTHENTICATION ---
loginButton.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Error signing in: ", error);
        showToast(`Gagal masuk: ${error.message}`, true);
    });
});

if (logoutButtonText) {
    logoutButtonText.addEventListener('click', () => signOut(auth));
}

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
});

// --- HELPER FUNCTIONS ---
function getPlatformBadgeClasses(platform) {
    const colors = {
        'Steam': 'bg-cyan-500/20 text-cyan-300',
        'Epic': 'bg-gray-500/20 text-gray-300',
        'GOG': 'bg-purple-500/20 text-purple-300',
        'EA App': 'bg-rose-500/20 text-rose-300',
        'U-Connect': 'bg-sky-500/20 text-sky-300',
        'Ms Store': 'bg-amber-500/20 text-amber-300',
        'PCSX': 'bg-red-500/20 text-red-300',
        'default': 'bg-slate-500/20 text-slate-300'
    };
    return colors[platform] || colors['default'];
}

function getStatusBadgeClasses(status) {
    const colors = {
        'Dimainkan': 'bg-teal-500/20 text-teal-300',
        'Selesai': 'bg-green-500/20 text-green-300',
        'Belum dimainkan': 'bg-slate-500/20 text-slate-300'
    };
    return colors[status] || colors['Belum dimainkan'];
}

function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price);
}

// --- CRUD FUNCTIONS ---
function fetchGames() {
    if (!currentUser) return;
    const gamesCollectionRef = collection(db, 'games', currentUser.uid, 'userGames');
    const q = query(gamesCollectionRef, orderBy("title")); 

    unsubscribe = onSnapshot(q, (snapshot) => {
        games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        games.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
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
        const emptyMessage = '<tr><td colspan="7" class="text-center p-8 text-slate-400">Tidak ada game yang cocok.</td></tr>';
        gameListBody.innerHTML = emptyMessage;
        gameListCards.innerHTML = `<div class="text-center p-8 text-slate-400">Tidak ada game yang cocok.</div>`;
        return;
    }

    renderGamesAsTable(gamesToRender);
    renderGamesAsCards(gamesToRender);

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    document.querySelectorAll('.game-checkbox').forEach(cb => cb.addEventListener('change', updateBulkActionUI));
    updateSortIcons();
}

function renderGamesAsTable(gamesToRender) {
    gamesToRender.forEach(game => {
        const row = document.createElement('tr');
        row.className = 'border-b border-slate-700 hover:bg-slate-700/50 transition-colors';
        row.innerHTML = `
            <td class="p-4"><input type="checkbox" data-id="${game.id}" class="game-checkbox rounded bg-slate-600 border-slate-500 text-teal-500 focus:ring-teal-400"></td>
            <td class="p-4 font-medium">${game.title}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getPlatformBadgeClasses(game.platform)}">${game.platform}</span></td>
            <td class="p-4 text-slate-300">${game.location}</td>
            <td class="p-4 text-amber-400">${game.price ? formatPrice(game.price) : 'Gratis'}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClasses(game.status)}">${game.status}</span></td>
            <td class="p-4 whitespace-nowrap">
                <button class="edit-btn p-1 text-slate-400 hover:text-white" data-id="${game.id}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>
                <button class="delete-btn p-1 text-slate-400 hover:text-red-400" data-id="${game.id}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg></button>
            </td>
        `;
        gameListBody.appendChild(row);
    });
}

function renderGamesAsCards(gamesToRender) {
    gamesToRender.forEach(game => {
        const card = document.createElement('div');
        card.className = 'card-item bg-slate-800 rounded-xl shadow-lg p-4 border border-slate-700 space-y-2';
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <input type="checkbox" data-id="${game.id}" class="game-checkbox rounded bg-slate-600 border-slate-500 text-teal-500 focus:ring-teal-400">
                    <span class="font-bold text-lg text-white">${game.title}</span>
                </div>
                <div class="flex space-x-1">
                    <button class="edit-btn p-1 text-slate-400 hover:text-white" data-id="${game.id}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>
                    <button class="delete-btn p-1 text-slate-400 hover:text-red-400" data-id="${game.id}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg></button>
                </div>
            </div>
            <div class="flex justify-between text-sm text-slate-400"><span>Platform:</span><span class="font-semibold text-white">${game.platform}</span></div>
            <div class="flex justify-between text-sm text-slate-400"><span>Lokasi:</span><span class="font-semibold text-white">${game.location}</span></div>
            <div class="flex justify-between text-sm text-slate-400"><span>Harga:</span><span class="font-semibold text-amber-400">${game.price ? formatPrice(game.price) : 'Gratis'}</span></div>
            <div class="flex justify-between text-sm text-slate-400"><span>Status:</span><span class="font-semibold text-white"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClasses(game.status)}">${game.status}</span></span></div>
        `;
        gameListCards.appendChild(card);
    });
}

// --- ADD/EDIT MODAL LOGIC ---
function createGameRowHTML(game = {}) {
    const isEdit = !!game.id;
    return `
        <div class="game-row p-4 border border-slate-700 rounded-lg space-y-3 relative">
            ${isEdit ? '' : '<button type="button" class="remove-row-btn absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center">&times;</button>'}
            <div>
                <label class="block text-slate-300 text-sm font-bold mb-1">Judul Game</label>
                <input type="text" class="game-title w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none" value="${game.title || ''}" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Platform</label>
                    <select class="game-platform w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                        <option ${game.platform === 'Steam' ? 'selected' : ''}>Steam</option><option ${game.platform === 'Epic' ? 'selected' : ''}>Epic</option><option ${game.platform === 'GOG' ? 'selected' : ''}>GOG</option><option ${game.platform === 'EA App' ? 'selected' : ''}>EA App</option><option ${game.platform === 'U-Connect' ? 'selected' : ''}>U-Connect</option><option ${game.platform === 'Ms Store' ? 'selected' : ''}>PCSX</option><option ${game.platform === 'PCSX' ? 'selected' : ''}>Crack</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Lokasi</label>
                    <select class="game-location w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                        <option ${game.location === 'HDD Eksternal 2TB' ? 'selected' : ''}>HDD Eksternal 2TB</option><option ${game.location === 'HDD Eksternal 4TB' ? 'selected' : ''}>HDD Eksternal 4TB</option><option ${game.location === 'Internal SSD' ? 'selected' : ''}>Internal SSD</option><option ${game.location === 'Belum Install' ? 'selected' : ''}>Belum Install</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Harga (IDR)</label>
                    <input type="number" class="game-price w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none" value="${game.price || '0'}" min="0">
                </div>
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Status</label>
                    <select class="game-status w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                        <option ${game.status === 'Belum dimainkan' ? 'selected' : ''}>Belum dimainkan</option><option ${game.status === 'Dimainkan' ? 'selected' : ''}>Dimainkan</option><option ${game.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
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
    setTimeout(() => modalContent.classList.remove('scale-95', 'opacity-0'), 10);
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
                price: parseInt(row.querySelector('.game-price').value, 10),
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
            if (rows.length === 0) return showToast("Tidak ada game untuk ditambahkan.", true);
            
            const batch = writeBatch(db);
            let gamesAdded = 0;
            rows.forEach(row => {
                const gameData = {
                    title: row.querySelector('.game-title').value, platform: row.querySelector('.game-platform').value, location: row.querySelector('.game-location').value, price: parseInt(row.querySelector('.game-price').value, 10), status: row.querySelector('.game-status').value,
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
                return showToast("Tidak ada game untuk ditambahkan.", true);
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
    if(game) openModal(game);
}

// --- DELETE CONFIRMATION MODAL LOGIC ---
function openDeleteConfirmModal(id, message, onConfirmCallback) {
    gameIdToDelete = id;
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
        gameIdToDelete = null;
        currentConfirmCallback = null;
    }, 200);
}

cancelDeleteButton.addEventListener('click', closeDeleteConfirmModal);
deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
});

confirmDeleteButton.addEventListener('click', async () => {
    if (currentConfirmCallback) await currentConfirmCallback();
});

function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    const gameTitle = games.find(g => g.id === id)?.title || 'game ini';
    openDeleteConfirmModal(id, `Apakah Anda yakin ingin menghapus ${gameTitle}?`, async () => {
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

// --- TAB SWITCHING ---
const tabs = document.getElementById('tabs');
const mobileTabs = document.getElementById('mobile-tabs');
const tabContents = document.querySelectorAll('.tab-content');

function handleTabClick(e) {
    const button = e.target.closest('.tab-button');
    if (!button) return;

    // --- Button styling ---
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('tab-active', 'link-active', 'tab-inactive');
    });

    button.classList.add('link-active'); 
    
    const tabId = button.dataset.tab;

    // --- Content switching with transition ---
    tabContents.forEach(content => {
        if (content.id === tabId) {
            // This is the tab to show
            content.classList.remove('hidden');
            // Use a timeout to allow the 'display' property to be applied before the transition starts
            setTimeout(() => {
                content.classList.remove('opacity-0', 'translate-y-3');
            }, 10);
        } else {
            // This is a tab to hide
            content.classList.add('opacity-0', 'translate-y-3');
            // Add 'hidden' after the transition is complete
            setTimeout(() => {
                content.classList.add('hidden');
            }, 300); // This should match the CSS transition duration
        }
    });
    
    if (window.innerWidth < 768) closeSidebar();
}

tabs.addEventListener('click', handleTabClick);
mobileTabs.addEventListener('click', handleTabClick);


// --- CHART LOGIC ---
function initCharts() {
    const pieDoughnutOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', padding: 15, font: { size: 12 } } } },
        onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default'; },
        elements: { arc: { hoverOffset: 12, borderWidth: 0 } }
    };
    const barOptions = { 
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default'; },
        scales: {
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
        }
    };

    platformChart = new Chart(document.getElementById('platform-chart'), { type: 'doughnut', data: {}, options: pieDoughnutOptions });
    locationChart = new Chart(document.getElementById('location-chart'), { type: 'pie', data: {}, options: pieDoughnutOptions });
    statusChart = new Chart(document.getElementById('status-chart'), { type: 'bar', data: {}, options: barOptions });
}

function updateCharts() {
    if (!platformChart) initCharts();

    const totalPrice = games.reduce((sum, game) => sum + (game.price || 0), 0);
    const mostExpensiveGame = games.length > 0 ? games.reduce((max, game) => (game.price > max.price ? game : max), { price: 0 }) : null;
    totalPriceElement.textContent = formatPrice(totalPrice);
    mostExpensiveGameElement.textContent = mostExpensiveGame && mostExpensiveGame.price > 0 ? `${mostExpensiveGame.title} (${formatPrice(mostExpensiveGame.price)})` : "Belum ada game";

    const platformData = games.reduce((acc, game) => { acc[game.platform] = (acc[game.platform] || 0) + 1; return acc; }, {});
    platformChart.data = {
        labels: Object.keys(platformData),
        datasets: [{ data: Object.values(platformData), backgroundColor: ['#14b8a6', '#6366f1', '#ec4899', '#f97316', '#0ea5e9', '#ef4444', '#facc15'] }]
    };
    platformChart.update();

    const locationData = games.reduce((acc, game) => { acc[game.location] = (acc[game.location] || 0) + 1; return acc; }, {});
    locationChart.data = {
        labels: Object.keys(locationData),
        datasets: [{ data: Object.values(locationData), backgroundColor: ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b'] }]
    };
    locationChart.update();
    
    const statusData = games.reduce((acc, game) => { acc[game.status] = (acc[game.status] || 0) + 1; return acc; }, {});
    const statusLabels = Object.keys(statusData);
    const statusColors = { 'Belum dimainkan': '#64748b', 'Dimainkan': '#14b8a6', 'Selesai': '#22c55e' };
    const hoverStatusColors = { 'Belum dimainkan': '#94a3b8', 'Dimainkan': '#2dd4bf', 'Selesai': '#4ade80' };
    statusChart.data = {
        labels: statusLabels,
        datasets: [{ 
            label: 'Jumlah Game', data: Object.values(statusData), 
            backgroundColor: statusLabels.map(label => statusColors[label] || '#64748b'),
            hoverBackgroundColor: statusLabels.map(label => hoverStatusColors[label] || '#94a3b8'),
            borderRadius: 4, borderWidth: 2, borderColor: 'transparent', hoverBorderColor: '#6366f1'
        }]
    };
    statusChart.update();
}

// --- FILTERING, SORTING, PAGINATION ---
const filterTitle = document.getElementById('filter-title');
const filterPlatform = document.getElementById('filter-platform');
const filterLocation = document.getElementById('filter-location');
const filterStatus = document.getElementById('filter-status');

[filterTitle, filterPlatform, filterLocation, filterStatus].forEach(el => {
    el.addEventListener('input', () => {
        currentPage = 1;
        applyFiltersAndSort();
    });
});

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '');
    if (sortState.column) {
        const currentHeader = document.querySelector(`th[data-sort="${sortState.column}"] .sort-icon`);
        if (currentHeader) currentHeader.textContent = sortState.direction === 'asc' ? '▲' : '▼';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', (e) => {
            const column = e.currentTarget.dataset.sort;
            sortState.direction = (sortState.column === column && sortState.direction === 'asc') ? 'desc' : 'asc';
            sortState.column = column;
            currentPage = 1;
            applyFiltersAndSort();
        });
    });
    updateSortIcons();
});

function applyFiltersAndSort() {
    const title = filterTitle.value.toLowerCase();
    const platform = filterPlatform.value;
    const location = filterLocation.value;
    const status = filterStatus.value;

    filteredGames = games.filter(game => 
        (game.title.toLowerCase().includes(title)) &&
        (platform === '' || game.platform === platform) &&
        (location === '' || game.location === location) &&
        (status === '' || game.status === status)
    );
    
    if (sortState.column) {
        filteredGames.sort((a, b) => {
            let aVal = a[sortState.column] || '';
            let bVal = b[sortState.column] || '';
            const comparison = typeof aVal === 'string' ? aVal.localeCompare(bVal, undefined, { sensitivity: 'base' }) : aVal - bVal;
            return sortState.direction === 'asc' ? comparison : -comparison;
        });
    }

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

    // Simplified pagination buttons
    const createButton = (content, page, isDisabled = false) => {
        const button = document.createElement('button');
        button.innerHTML = content;
        button.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button';
        if (page === currentPage) button.classList.add('active');
        button.disabled = isDisabled;
        button.addEventListener('click', () => { currentPage = page; displayPage(); });
        return button;
    };
    
    paginationContainer.appendChild(createButton('&laquo;', currentPage - 1, currentPage === 1));
    // Always show first page
    if (currentPage > 2) paginationContainer.appendChild(createButton('1', 1));
    if (currentPage > 3) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-slate-400">...</span>`);

    // Show current page and neighbors
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
        if (i !== 1 && i !== totalPages) {
            paginationContainer.appendChild(createButton(i, i));
        }
    }

    // Always show last page
    if (currentPage < totalPages - 2) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-slate-400">...</span>`);
    if (currentPage < totalPages - 1) paginationContainer.appendChild(createButton(totalPages, totalPages));
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
    const selectedCount = getSelectedGameIds().length;
    bulkDeleteButton.disabled = bulkEditButton.disabled = selectedCount === 0;
    selectionInfo.innerHTML = selectedCount > 0 ? `<b>${selectedCount} game terpilih.</b>` : `Pilih game untuk melakukan aksi masal.`;
}

function getSelectedGameIds() {
    return Array.from(document.querySelectorAll('.game-checkbox:checked')).map(cb => cb.dataset.id);
}

bulkDeleteButton.addEventListener('click', () => {
    const idsToDelete = getSelectedGameIds();
    if (idsToDelete.length === 0) return;
    
    openDeleteConfirmModal(null, `Apakah Anda yakin ingin menghapus ${idsToDelete.length} game terpilih?`, async () => {
        try {
            const batch = writeBatch(db);
            idsToDelete.forEach(id => batch.delete(doc(db, 'games', currentUser.uid, 'userGames', id)));
            await batch.commit();
            showToast(`${idsToDelete.length} game berhasil dihapus.`);
            selectAllCheckbox.checked = false;
            closeDeleteConfirmModal();
        } catch (error) {
            console.error("Error bulk deleting: ", error);
            showToast(`Gagal menghapus: ${error.message}`, true);
        }
    });
});

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

bulkEditButton.addEventListener('click', openBulkEditModal);
bulkEditCancelButton.addEventListener('click', closeBulkEditModal);
bulkEditModal.addEventListener('click', (e) => { if (e.target === bulkEditModal) closeBulkEditModal(); });

bulkEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idsToUpdate = getSelectedGameIds();
    const updateData = {};
    if (document.getElementById('bulk-update-platform-check').checked) updateData.platform = document.getElementById('bulk-platform').value;
    if (document.getElementById('bulk-update-location-check').checked) updateData.location = document.getElementById('bulk-location').value;
    if (document.getElementById('bulk-update-price-check').checked) updateData.price = parseInt(document.getElementById('bulk-price').value, 10);
    if (document.getElementById('bulk-update-status-check').checked) updateData.status = document.getElementById('bulk-status').value;

    if (idsToUpdate.length === 0 || Object.keys(updateData).length === 0) {
        return showToast("Pilih game dan properti untuk diubah.", true);
    }

    try {
        const batch = writeBatch(db);
        idsToUpdate.forEach(id => batch.update(doc(db, 'games', currentUser.uid, 'userGames', id), updateData));
        await batch.commit();
        showToast(`${idsToUpdate.length} game berhasil diperbarui.`);
        selectAllCheckbox.checked = false;
        closeBulkEditModal();
    } catch (error) {
        console.error("Error bulk updating: ", error);
        showToast(`Gagal memperbarui: ${error.message}`, true);
    }
});

// --- DATA MANAGEMENT ---
const downloadJsonButton = document.getElementById('download-json-button');
const uploadJsonButton = document.getElementById('upload-json-button');
const jsonFileInput = document.getElementById('json-file-input');

downloadJsonButton.addEventListener('click', () => {
    if (games.length === 0) return showToast("Tidak ada data untuk diunduh.", true);
    const dataStr = JSON.stringify(games.map(({id, ...rest}) => rest), null, 2);
    const linkElement = document.createElement('a');
    linkElement.href = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    linkElement.download = 'koleksi_game.json';
    linkElement.click();
    showToast("Data sedang diunduh...");
});

uploadJsonButton.addEventListener('click', () => jsonFileInput.click());

jsonFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedGames = JSON.parse(event.target.result);
            if (!Array.isArray(importedGames)) throw new Error("File JSON harus berupa array.");
            
            openDeleteConfirmModal(null, `Anda akan mengimpor ${importedGames.length} game. Lanjutkan?`, async () => {
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
                    console.error("Error importing JSON: ", error);
                    showToast(`Gagal mengimpor: ${error.message}`, true);
                } finally {
                    jsonFileInput.value = '';
                }
            });
        } catch (error) {
            console.error("Error parsing JSON: ", error);
            showToast(`Gagal memuat file: ${error.message}`, true);
        }
    };
    reader.readAsText(file);
});

