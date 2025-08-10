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

// Mengambil referensi tombol logout yang ada di bawah nama pengguna
const logoutButtonText = document.getElementById('logout-button-text');
const userProfileContainer = document.getElementById('user-profile');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const gameListBody = document.getElementById('game-list-body');
const gameListCards = document.getElementById('game-list-cards');
const gameListCardsEmpty = document.getElementById('game-list-cards-empty');
const addGameButton = document.getElementById('add-game-button');
const paginationContainer = document.getElementById('pagination-container');

// --- Statistik UI Elements ---
const totalPriceElement = document.getElementById('total-price');
const mostExpensiveGameElement = document.getElementById('most-expensive-game');

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
    toast.className = `fixed bottom-5 right-1/2 translate-x-1/2 w-11/12 max-w-sm text-white py-2 px-4 rounded-lg shadow-lg transform transition-all duration-300 z-50 ${isError ? 'bg-red-500' : 'bg-green-500'} translate-y-0 opacity-100`;
    setTimeout(() => {
        toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-20 opacity-0');
    }, 3000);
}

// --- AUTHENTICATION ---
// Event listener untuk tombol login di halaman utama
loginButton.addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .catch((error) => {
            console.error("Error signing in: ", error);
            showToast(`Gagal masuk: ${error.message}`, true);
        });
});

// Event listener untuk tombol logout yang ada di bawah nama pengguna
if (logoutButtonText) {
    logoutButtonText.addEventListener('click', () => {
        signOut(auth);
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        
        // Memperbarui tampilan navbar untuk pengguna yang login
        userPhoto.src = user.photoURL;
        userName.textContent = user.displayName;
        
        // Memastikan elemen profil pengguna terlihat
        const userProfileInfo = document.querySelector('#user-profile > div');
        if (userProfileInfo) userProfileInfo.classList.remove('hidden');
        
        fetchGames();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        
        // Menyembunyikan elemen profil pengguna saat pengguna keluar
        const userProfileInfo = document.querySelector('#user-profile > div');
        if (userProfileInfo) userProfileInfo.classList.add('hidden');

        if (unsubscribe) unsubscribe();
        games = [];
        filteredGames = [];
        displayPage();
        updateCharts();
    }
});

// --- HELPER FUNCTION FOR PLATFORM COLORS ---
function getPlatformBadgeClasses(platform) {
    const colors = {
        'Steam': 'bg-blue-600/30 text-blue-300',
        'Epic': 'bg-gray-400/30 text-gray-200',
        'GOG': 'bg-purple-500/30 text-purple-300',
		'EA App': 'bg-red-500/30 text-red-300',
        'U-Connect': 'bg-sky-500/30 text-sky-300', // Added new color for Ubisoft Connect
        'PCSX': 'bg-yellow-500/30 text-yellow-300',
        'Crack': 'bg-red-500/30 text-red-300',
        'default': 'bg-slate-500/30 text-slate-300'
    };
    return colors[platform] || colors['default'];
}

// Helper function to format price as currency
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
    // Keep orderBy for initial fetch, but client-side sort will override for display
    const q = query(gamesCollectionRef, orderBy("title")); 

    unsubscribe = onSnapshot(q, (snapshot) => {
        games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Add client-side case-insensitive sorting here for consistent display
        games.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        applyFiltersAndSort();
        updateCharts();
        updateBulkActionUI();
    }, (error) => {
        console.error("Error fetching games: ", error);
        showToast("Gagal memuat data game. Pastikan Firestore index sudah dibuat.", true);
    });
}

function renderGames(gamesToRender) {
    // Clear both table and card views
    gameListBody.innerHTML = '';
    gameListCards.innerHTML = '';
    
    if (!gamesToRender || gamesToRender.length === 0) {
        // Show empty message on both views
        gameListBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-blue-300">Tidak ada game yang cocok dengan filter atau belum ada game ditambahkan.</td></tr>';
        gameListCards.innerHTML = '<div id="game-list-cards-empty" class="text-center p-8 text-blue-300">Tidak ada game yang cocok dengan filter atau belum ada game ditambahkan.</div>';
        return;
    }

    // Render for desktop (table)
    renderGamesAsTable(gamesToRender);
    
    // Render for mobile (cards)
    renderGamesAsCards(gamesToRender);

    // Add event listeners for both
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
            <td class="p-4"><input type="checkbox" data-id="${game.id}" class="game-checkbox rounded bg-slate-600 border-slate-500"></td>
            <td class="p-4 font-medium">${game.title}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getPlatformBadgeClasses(game.platform)}">${game.platform}</span></td>
            <td class="p-4 text-slate-300">${game.location}</td>
            <td class="p-4 text-yellow-300">${game.price ? formatPrice(game.price) : 'Gratis'}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${game.status === 'Dimainkan' ? 'bg-yellow-500/20 text-yellow-300' : game.status === 'Selesai' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}">${game.status}</span></td>
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
        card.className = 'card-item bg-blue-900 rounded-xl shadow-lg p-4 border border-blue-700 space-y-2';
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <input type="checkbox" data-id="${game.id}" class="game-checkbox rounded bg-blue-700 border-blue-500 text-yellow-500 focus:ring-yellow-400">
                    <span class="font-bold text-lg text-white">${game.title}</span>
                </div>
                <div class="flex space-x-1">
                    <button class="edit-btn p-1 text-slate-400 hover:text-white" data-id="${game.id}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>
                    <button class="delete-btn p-1 text-slate-400 hover:text-red-400" data-id="${game.id}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg></button>
                </div>
            </div>
            <div class="flex justify-between text-sm text-blue-300">
                <span>Platform:</span>
                <span class="font-semibold text-white">${game.platform}</span>
            </div>
            <div class="flex justify-between text-sm text-blue-300">
                <span>Lokasi:</span>
                <span class="font-semibold text-white">${game.location}</span>
            </div>
            <div class="flex justify-between text-sm text-blue-300">
                <span>Harga:</span>
                <span class="font-semibold text-yellow-300">${game.price ? formatPrice(game.price) : 'Gratis'}</span>
            </div>
            <div class="flex justify-between text-sm text-blue-300">
                <span>Status:</span>
                <span class="font-semibold text-white"><span class="px-2 py-1 text-xs font-semibold rounded-full ${game.status === 'Dimainkan' ? 'bg-yellow-500/20 text-yellow-300' : game.status === 'Selesai' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}">${game.status}</span></span>
            </div>
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
            <div class="mb-2">
                <label class="block text-slate-300 text-sm font-bold mb-1">Judul Game</label>
                <input type="text" class="game-title w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none" value="${game.title || ''}" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Platform</label>
                    <select class="game-platform w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        <option ${game.platform === 'Steam' ? 'selected' : ''}>Steam</option>
                        <option ${game.platform === 'Epic' ? 'selected' : ''}>Epic</option>
                        <option ${game.platform === 'GOG' ? 'selected' : ''}>GOG</option>
						<option ${game.platform === 'EA App' ? 'selected' : ''}>EA App</option>
                        <option ${game.platform === 'U-Connect' ? 'selected' : ''}>U-Connect</option>
                        <option ${game.platform === 'PCSX' ? 'selected' : ''}>PCSX</option>
                        <option ${game.platform === 'Crack' ? 'selected' : ''}>Crack</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Lokasi</label>
                    <select class="game-location w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        <option ${game.location === 'HDD Eksternal 2TB' ? 'selected' : ''}>HDD Eksternal 2TB</option>
                        <option ${game.location === 'HDD Eksternal 4TB' ? 'selected' : ''}>HDD Eksternal 4TB</option>
                        <option ${game.location === 'Internal SSD' ? 'selected' : ''}>Internal SSD</option>
                        <option ${game.location === 'Belum Install' ? 'selected' : ''}>Belum Install</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Harga (IDR)</label>
                    <input type="number" class="game-price w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none" value="${game.price || '0'}" min="0">
                </div>
                <div>
                    <label class="block text-slate-300 text-sm font-bold mb-1">Status</label>
                    <select class="game-status w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
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
                    price: parseInt(row.querySelector('.game-price').value, 10),
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
    if(game) openModal(game);
}

// --- DELETE CONFIRMATION MODAL LOGIC ---
// New function to open the delete confirmation modal with a custom message and callback
function openDeleteConfirmModal(id, message, onConfirmCallback) {
    gameIdToDelete = id; // Store ID for single delete context, null for bulk
    deleteConfirmMessage.textContent = message;
    currentConfirmCallback = onConfirmCallback; // Store the callback to be executed on confirm
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
        gameIdToDelete = null; // Clear the stored ID
        currentConfirmCallback = null; // Clear the callback
    }, 200);
}

cancelDeleteButton.addEventListener('click', closeDeleteConfirmModal);
deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
});

// Event listener for the confirm delete button, now executes the stored callback
confirmDeleteButton.addEventListener('click', async () => {
    if (currentConfirmCallback) {
        await currentConfirmCallback();
        // The callback should handle closing the modal and showing toast
    }
});

function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    const gameTitle = games.find(g => g.id === id)?.title || 'game ini'; // Get title for specific message
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
const mobileTabs = document.getElementById('mobile-tabs');
const tabContents = document.querySelectorAll('.tab-content');

// Function to handle tab clicks
function handleTabClick(e) {
    const button = e.target.closest('.tab-button');
    if (!button) return;

    // Clear active state for all tab buttons
    const allTabButtons = document.querySelectorAll('.tab-button');
    allTabButtons.forEach(btn => {
        // Menghapus semua kelas terkait status 'aktif' dari tombol navigasi
        btn.classList.remove('tab-active', 'link-active', 'tab-inactive');
    });

    // Menambahkan kelas 'aktif' ke tombol yang diklik
    button.classList.add('link-active'); 
    
    // Menampilkan konten tab yang sesuai
    const tabId = button.dataset.tab;
    tabContents.forEach(content => {
        if (content.id === tabId) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
    
    // Menutup sidebar pada tampilan mobile setelah mengklik tab
    if (window.innerWidth < 768) {
        closeSidebar();
    }
}

tabs.addEventListener('click', handleTabClick);
mobileTabs.addEventListener('click', handleTabClick);


// --- CHART LOGIC ---
function initCharts() {
     const pieDoughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'bottom',
                labels: { color: '#cbd5e1', padding: 15, font: { size: 12 } }
            }
        },
        onHover: (event, chartElement) => {
            event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
        },
        elements: { arc: { hoverOffset: 12, borderWidth: 0 } }
    };
    const barOptions = { 
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        onHover: (event, chartElement) => {
            event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
        },
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

    // Calculate new statistics
    const totalPrice = games.reduce((sum, game) => sum + (game.price || 0), 0);
    let mostExpensiveGameTitle = "Belum ada game";
    if (games.length > 0) {
        const mostExpensiveGame = games.reduce((maxGame, currentGame) => (currentGame.price > (maxGame.price || 0) ? currentGame : maxGame), games[0]);
        mostExpensiveGameTitle = `${mostExpensiveGame.title} (${formatPrice(mostExpensiveGame.price || 0)})`;
    }
    totalPriceElement.textContent = formatPrice(totalPrice);
    mostExpensiveGameElement.textContent = mostExpensiveGameTitle;

    const platformData = games.reduce((acc, game) => { acc[game.platform] = (acc[game.platform] || 0) + 1; return acc; }, {});
    platformChart.data = {
        labels: Object.keys(platformData),
        datasets: [{ data: Object.values(platformData), backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#0ea5e9', '#ef4444', '#facc15'] }]
    };
    platformChart.update();

    const locationData = games.reduce((acc, game) => { acc[game.location] = (acc[game.location] || 0) + 1; return acc; }, {});
    locationChart.data = {
        labels: Object.keys(locationData),
        datasets: [{ data: Object.values(locationData), backgroundColor: ['#10b981', '#06b6d4', '#6366f1', '#f59e0b'] }]
    };
    locationChart.update();
    
    const statusData = games.reduce((acc, game) => { acc[game.status] = (acc[game.status] || 0) + 1; return acc; }, {});
    const statusLabels = Object.keys(statusData);
    const statusValues = Object.values(statusData);
    const statusColors = { 'Belum dimainkan': '#64748b', 'Dimainkan': '#eab308', 'Selesai': '#22c55e' };
    const hoverStatusColors = { 'Belum dimainkan': '#94a3b8', 'Dimainkan': '#facc15', 'Selesai': '#4ade80' };
    statusChart.data = {
        labels: statusLabels,
        datasets: [{ 
            label: 'Jumlah Game', 
            data: statusValues, 
            backgroundColor: statusLabels.map(label => statusColors[label] || '#64748b'),
            hoverBackgroundColor: statusLabels.map(label => hoverStatusColors[label] || '#94a3b8'),
            borderRadius: 4, borderWidth: 2, borderColor: 'transparent', hoverBorderColor: '#6366f1'
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
        applyFiltersAndSort();
    });
});

// Function to update sort icons on headers
function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '');
    if (sortState.column) {
        const currentHeader = document.querySelector(`th[data-sort="${sortState.column}"] .sort-icon`);
        if (currentHeader) {
            currentHeader.textContent = sortState.direction === 'asc' ? '▲' : '▼';
        }
    }
}

// Add click listener for sortable columns
document.addEventListener('DOMContentLoaded', () => {
     // ... other DOMContentLoaded logic
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
            const column = e.currentTarget.dataset.sort;
            if (sortState.column === column) {
                sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortState.column = column;
                sortState.direction = 'asc';
            }
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

    filteredGames = games.filter(game => {
        return (title === '' || game.title.toLowerCase().includes(title)) &&
               (platform === '' || game.platform === platform) &&
               (location === '' || game.location === location) &&
               (status === '' || game.status === status);
    });
    
    // Apply sorting after filtering
    if (sortState.column) {
        filteredGames.sort((a, b) => {
            let aValue = a[sortState.column];
            let bValue = b[sortState.column];
            
            // Handle undefined or null values
            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortState.direction === 'asc' ? aValue.localeCompare(bValue, undefined, { sensitivity: 'base' }) : bValue.localeCompare(aValue, undefined, { sensitivity: 'base' });
            } else {
                // Numeric comparison for numbers
                return sortState.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
        });
    }

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

    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo;';
    prevButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayPage(); } });
    paginationContainer.appendChild(prevButton);

    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    if (endPage - startPage + 1 < maxPageButtons) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    if (startPage > 1) {
        const firstButton = document.createElement('button');
        firstButton.textContent = '1';
        firstButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button';
        firstButton.addEventListener('click', () => { currentPage = 1; displayPage(); });
        paginationContainer.appendChild(firstButton);
        if (startPage > 2) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-slate-400">...</span>`);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button';
        if (i === currentPage) pageButton.classList.add('active');
        pageButton.addEventListener('click', () => { currentPage = i; displayPage(); });
        paginationContainer.appendChild(pageButton);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-slate-400">...</span>`);
        const lastButton = document.createElement('button');
        lastButton.textContent = totalPages;
        lastButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button';
        lastButton.addEventListener('click', () => { currentPage = totalPages; displayPage(); });
        paginationContainer.appendChild(lastButton);
    }

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '&raquo;';
    nextButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; displayPage(); } });
    paginationContainer.appendChild(nextButton);
}

// --- BULK ACTIONS LOGIC ---
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const bulkDeleteButton = document.getElementById('bulk-delete-button');
const bulkEditButton = document.getElementById('bulk-edit-button');
const selectionInfo = document.getElementById('selection-info');

selectAllCheckbox.addEventListener('change', (e) => {
    // Select all checkboxes in both table and card views
    document.querySelectorAll('.game-checkbox').forEach(cb => { cb.checked = e.target.checked; });
    updateBulkActionUI();
});

function updateBulkActionUI() {
    const selectedIds = getSelectedGameIds();
    const hasSelection = selectedIds.length > 0;
    
    bulkDeleteButton.disabled = !hasSelection;
    bulkEditButton.disabled = !hasSelection;
    
    if (hasSelection) {
        selectionInfo.innerHTML = `<b>${selectedIds.length} game terpilih.</b> Aksi hanya berlaku untuk item yang terlihat di halaman ini.`;
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
    bulkEditForm.reset(); // Clear previous selections
    
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
    if (document.getElementById('bulk-update-price-check').checked) {
        updateData.price = parseInt(document.getElementById('bulk-price').value, 10);
    }
    if (document.getElementById('bulk-update-status-check').checked) {
        updateData.status = document.getElementById('bulk-status').value;
    }

    if (Object.keys(updateData).length === 0) {
        showToast("Tidak ada perubahan yang dipilih. Centang properti yang ingin diubah.", true);
        return;
    }

    // Directly perform the bulk update without showing the delete confirmation modal
    try {
        const batch = writeBatch(db);
        idsToUpdate.forEach(id => {
            const gameRef = doc(db, 'games', currentUser.uid, 'userGames', id);
            batch.update(gameRef, updateData);
        });
        await batch.commit();
        showToast(`${idsToUpdate.length} game berhasil diperbarui.`);
        selectAllCheckbox.checked = false;
        closeBulkEditModal(); // Close the bulk edit modal after successful update
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
    const dataStr = JSON.stringify(games.map(({id, ...rest}) => rest), null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
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
