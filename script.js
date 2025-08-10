import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Config (JANGAN UBAH) ---
const firebaseConfig = {
    apiKey: "AIzaSyAzJTL179V9bT-DfefZq9gcG8Tz88VzLmQ",
    authDomain: "koleksi-game.firebaseapp.com",
    projectId: "koleksi-game",
    storageBucket: "koleksi-game.appspot.com",
    messagingSenderId: "222959670551",
    appId: "1:222959670551:web:048b1e2c4ef16b7bd31352",
    measurementId: "G-BYYCM7R4M8"
};

// --- Inisialisasi Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let games = [];
let filteredGames = [];
let unsubscribe = null; 

// --- Status Pagination ---
let currentPage = 1;
const gamesPerPage = 10;

// --- Status Sortir ---
let sortState = {
    column: 'title', // Kolom sortir default
    direction: 'asc' // Arah sortir default
};

// --- Elemen UI ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const gameListBody = document.getElementById('game-list-body');
const gameListCards = document.getElementById('game-list-cards');
const gameListCardsEmpty = document.getElementById('game-list-cards-empty');
const addGameButton = document.getElementById('add-game-button');
const paginationContainer = document.getElementById('pagination-container');

// --- Elemen UI Statistik ---
const totalPriceElement = document.getElementById('total-price');
const mostExpensiveGameElement = document.getElementById('most-expensive-game');

// --- Elemen Modal Tambah/Edit ---
const gameModal = document.getElementById('game-modal');
const modalContent = document.getElementById('modal-content');
const gameForm = document.getElementById('game-form');
const cancelButton = document.getElementById('cancel-button');
const modalTitle = document.getElementById('modal-title');
const gameRowsContainer = document.getElementById('game-rows-container');
const addRowButton = document.getElementById('add-row-button');

// --- Elemen Modal Edit Massal ---
const bulkEditModal = document.getElementById('bulk-edit-modal');
const bulkEditModalContent = document.getElementById('bulk-edit-modal-content');
const bulkEditForm = document.getElementById('bulk-edit-form');
const bulkEditCancelButton = document.getElementById('bulk-edit-cancel-button');
const bulkEditInfo = document.getElementById('bulk-edit-info');

// --- Elemen Modal Konfirmasi Hapus ---
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmModalContent = document.getElementById('delete-confirm-modal-content');
const deleteConfirmMessage = document.getElementById('delete-confirm-message');
const cancelDeleteButton = document.getElementById('cancel-delete-button');
const confirmDeleteButton = document.getElementById('confirm-delete-button');
let gameIdToDelete = null; 
let currentConfirmCallback = null; 

// --- Elemen Mobile ---
const sidebar = document.getElementById('sidebar');
const openSidebarButton = document.getElementById('open-sidebar-button');
const closeSidebarButton = document.getElementById('close-sidebar-button');
const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');

// --- Instance Chart ---
let platformChart, locationChart, statusChart;

// --- LOGIKA SIDEBAR MOBILE ---
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

// --- FUNGSI TOAST/ALERT KUSTOM ---
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    
    // Gunakan kelas Tailwind yang diperbarui
    toast.className = `fixed bottom-5 right-1/2 translate-x-1/2 w-11/12 max-w-sm text-white py-2 px-4 rounded-lg shadow-lg transform transition-all duration-300 z-50 ${isError ? 'bg-red-500' : 'bg-emerald-500'} translate-y-0 opacity-100`;
    
    setTimeout(() => {
        toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-20 opacity-0');
    }, 3000);
}

// --- OTENTIKASI ---
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
});

// --- FUNGSI BANTUAN UNTUK WARNA BADGE PLATFORM ---
function getPlatformBadgeClasses(platform) {
    // Sesuaikan dengan skema warna yang baru
    const colors = {
        'Steam': 'bg-slate-700 text-sky-400',
        'Epic': 'bg-slate-700 text-gray-400',
        'GOG': 'bg-slate-700 text-purple-400',
		'EA App': 'bg-slate-700 text-red-400',
        'U-Connect': 'bg-slate-700 text-teal-400',
        'PCSX': 'bg-slate-700 text-amber-400',
        'Crack': 'bg-slate-700 text-red-400',
        'default': 'bg-slate-700 text-slate-400'
    };
    return colors[platform] || colors['default'];
}

// Fungsi bantuan untuk memformat harga sebagai mata uang
function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price);
}

// --- FUNGSI CRUD ---
function fetchGames() {
    if (!currentUser) return;
    const gamesCollectionRef = collection(db, 'games', currentUser.uid, 'userGames');
    // Jaga orderBy untuk pengambilan awal, tetapi sortir sisi klien akan menimpanya untuk tampilan
    const q = query(gamesCollectionRef, orderBy("title")); 

    unsubscribe = onSnapshot(q, (snapshot) => {
        games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Tambahkan sortir case-insensitive sisi klien di sini agar tampilan konsisten
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
    // Hapus tampilan tabel dan kartu
    gameListBody.innerHTML = '';
    gameListCards.innerHTML = '';
    
    if (!gamesToRender || gamesToRender.length === 0) {
        // Tampilkan pesan kosong di kedua tampilan
        gameListBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400">Tidak ada game yang cocok dengan filter atau belum ada game ditambahkan.</td></tr>';
        gameListCards.innerHTML = '<div id="game-list-cards-empty" class="text-center p-8 text-slate-400">Tidak ada game yang cocok dengan filter atau belum ada game ditambahkan.</div>';
        return;
    }

    // Render untuk desktop (tabel)
    renderGamesAsTable(gamesToRender);
    
    // Render untuk mobile (kartu)
    renderGamesAsCards(gamesToRender);

    // Tambahkan event listener untuk keduanya
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    document.querySelectorAll('.game-checkbox').forEach(cb => cb.addEventListener('change', updateBulkActionUI));
    updateSortIcons();
}

function renderGamesAsTable(gamesToRender) {
    gamesToRender.forEach(game => {
        const row = document.createElement('tr');
        row.className = 'border-b border-slate-700 hover:bg-slate-700 transition-colors';
        row.innerHTML = `
            <td class="p-4"><input type="checkbox" data-id="${game.id}" class="game-checkbox rounded-md bg-slate-600 border-slate-500 text-emerald-500 focus:ring-emerald-400"></td>
            <td class="p-4 font-medium">${game.title}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getPlatformBadgeClasses(game.platform)}">${game.platform}</span></td>
            <td class="p-4 text-slate-300">${game.location}</td>
            <td class="p-4 text-emerald-300">${game.price ? formatPrice(game.price) : 'Gratis'}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${game.status === 'Dimainkan' ? 'bg-yellow-500/20 text-yellow-300' : game.status === 'Selesai' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}">${game.status}</span></td>
            <td class="p-4 whitespace-nowrap">
                <button class="edit-btn p-1 text-slate-400 hover:text-white" data-id="${game.id}"><i class="fas fa-edit h-5 w-5"></i></button>
                <button class="delete-btn p-1 text-slate-400 hover:text-red-400" data-id="${game.id}"><i class="fas fa-trash h-5 w-5"></i></button>
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
                    <input type="checkbox" data-id="${game.id}" class="game-checkbox rounded-md bg-slate-600 border-slate-500 text-emerald-500 focus:ring-emerald-400">
                    <span class="font-bold text-lg text-white">${game.title}</span>
                </div>
                <div class="flex space-x-1">
                    <button class="edit-btn p-1 text-slate-400 hover:text-white" data-id="${game.id}"><i class="fas fa-edit h-5 w-5"></i></button>
                    <button class="delete-btn p-1 text-slate-400 hover:text-red-400" data-id="${game.id}"><i class="fas fa-trash h-5 w-5"></i></button>
                </div>
            </div>
            <div class="flex justify-between text-sm text-slate-400">
                <span>Platform:</span>
                <span class="font-semibold text-white">${game.platform}</span>
            </div>
            <div class="flex justify-between text-sm text-slate-400">
                <span>Lokasi:</span>
                <span class="font-semibold text-white">${game.location}</span>
            </div>
            <div class="flex justify-between text-sm text-slate-400">
                <span>Harga:</span>
                <span class="font-semibold text-emerald-300">${game.price ? formatPrice(game.price) : 'Gratis'}</span>
            </div>
            <div class="flex justify-between text-sm text-slate-400">
                <span>Status:</span>
                <span class="font-semibold text-white"><span class="px-2 py-1 text-xs font-semibold rounded-full ${game.status === 'Dimainkan' ? 'bg-yellow-500/20 text-yellow-300' : game.status === 'Selesai' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}">${game.status}</span></span>
            </div>
        `;
        gameListCards.appendChild(card);
    });
}


// --- LOGIKA MODAL TAMBAH/EDIT ---
function createGameRowHTML(game = {}) {
    const isEdit = !!game.id;
    return `
        <div class="game-row p-4 border border-slate-700 rounded-xl space-y-3 relative">
            ${isEdit ? '' : '<button type="button" class="remove-row-btn absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center">&times;</button>'}
            <div class="mb-2">
                <label class="block text-slate-400 text-sm font-bold mb-1">Judul Game</label>
                <input type="text" class="game-title w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-white" value="${game.title || ''}" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label class="block text-slate-400 text-sm font-bold mb-1">Platform</label>
                    <select class="game-platform w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-white">
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
                    <label class="block text-slate-400 text-sm font-bold mb-1">Lokasi</label>
                    <select class="game-location w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-white">
                        <option ${game.location === 'HDD Eksternal 2TB' ? 'selected' : ''}>HDD Eksternal 2TB</option>
                        <option ${game.location === 'HDD Eksternal 4TB' ? 'selected' : ''}>HDD Eksternal 4TB</option>
                        <option ${game.location === 'Internal SSD' ? 'selected' : ''}>Internal SSD</option>
                        <option ${game.location === 'Belum Install' ? 'selected' : ''}>Belum Install</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-400 text-sm font-bold mb-1">Harga (IDR)</label>
                    <input type="number" class="game-price w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-white" value="${game.price || '0'}" min="0">
                </div>
                <div>
                    <label class="block text-slate-400 text-sm font-bold mb-1">Status</label>
                    <select class="game-status w-full bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-white">
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

// --- LOGIKA MODAL KONFIRMASI HAPUS ---
function openDeleteConfirmModal(id, message, onConfirmCallback) {
    gameIdToDelete = id; // Simpan ID untuk konteks hapus tunggal, null untuk massal
    deleteConfirmMessage.textContent = message;
    currentConfirmCallback = onConfirmCallback; // Simpan fungsi callback untuk dieksekusi saat konfirmasi
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
        gameIdToDelete = null; // Hapus ID yang disimpan
        currentConfirmCallback = null; // Hapus callback
    }, 200);
}

cancelDeleteButton.addEventListener('click', closeDeleteConfirmModal);
deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
});

// Event listener untuk tombol konfirmasi hapus, sekarang mengeksekusi callback yang disimpan
confirmDeleteButton.addEventListener('click', async () => {
    if (currentConfirmCallback) {
        await currentConfirmCallback();
        // Callback harus menangani penutupan modal dan menampilkan toast
    }
});

function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    const gameTitle = games.find(g => g.id === id)?.title || 'game ini'; // Dapatkan judul untuk pesan spesifik
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

// --- PERGANTIAN TAB ---
const tabs = document.getElementById('tabs');
const tabContents = document.querySelectorAll('.tab-content');
tabs.addEventListener('click', (e) => {
    const button = e.target.closest('.tab-button');
    if (!button) return;

    tabs.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('text-slate-400', 'hover:text-white');
    });
    button.classList.add('tab-active');
    button.classList.remove('text-slate-400', 'hover:text-white');
    
    const tabId = button.dataset.tab;
    tabContents.forEach(content => {
        if (content.id === tabId) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
    if (window.innerWidth < 768) {
        closeSidebar();
    }
});

// --- LOGIKA CHART ---
function initCharts() {
     // Opsi chart yang diperbarui agar sesuai dengan tema gelap
     const pieDoughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'bottom',
                labels: { color: '#94a3b8', padding: 15, font: { size: 12 } } // Teks legenda slate-400
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
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }, // Teks dan grid sumbu Y
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } } // Teks dan grid sumbu X
        }
    };

    platformChart = new Chart(document.getElementById('platform-chart'), { type: 'doughnut', data: {}, options: pieDoughnutOptions });
    locationChart = new Chart(document.getElementById('location-chart'), { type: 'pie', data: {}, options: pieDoughnutOptions });
    statusChart = new Chart(document.getElementById('status-chart'), { type: 'bar', data: {}, options: barOptions });
}

function updateCharts() {
    if (!platformChart) initCharts();

    // Hitung statistik baru
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
        // Sesuaikan warna chart dengan tema yang baru
        datasets: [{ data: Object.values(platformData), backgroundColor: ['#38bdf8', '#a78bfa', '#f472b6', '#f59e0b', '#10b981', '#ef4444', '#eab308'] }]
    };
    platformChart.update();

    const locationData = games.reduce((acc, game) => { acc[game.location] = (acc[game.location] || 0) + 1; return acc; }, {});
    locationChart.data = {
        labels: Object.keys(locationData),
        // Sesuaikan warna chart dengan tema yang baru
        datasets: [{ data: Object.values(locationData), backgroundColor: ['#10b981', '#06b6d4', '#6366f1', '#f59e0b'] }]
    };
    locationChart.update();
    
    const statusData = games.reduce((acc, game) => { acc[game.status] = (acc[game.status] || 0) + 1; return acc; }, {});
    const statusLabels = Object.keys(statusData);
    const statusValues = Object.values(statusData);
    const statusColors = { 'Belum dimainkan': '#475569', 'Dimainkan': '#f59e0b', 'Selesai': '#10b981' };
    const hoverStatusColors = { 'Belum dimainkan': '#64748b', 'Dimainkan': '#facc15', 'Selesai': '#34d399' };
    statusChart.data = {
        labels: statusLabels,
        datasets: [{ 
            label: 'Jumlah Game', 
            data: statusValues, 
            backgroundColor: statusLabels.map(label => statusColors[label] || '#475569'),
            hoverBackgroundColor: statusLabels.map(label => hoverStatusColors[label] || '#64748b'),
            borderRadius: 4, borderWidth: 2, borderColor: 'transparent', hoverBorderColor: '#6366f1'
        }]
    };
    statusChart.update();
}

// --- LOGIKA FILTERING DAN PAGINATION ---
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

// Fungsi untuk memperbarui ikon sortir pada header
function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '');
    if (sortState.column) {
        const currentHeader = document.querySelector(`th[data-sort="${sortState.column}"] .sort-icon`);
        if (currentHeader) {
            currentHeader.textContent = sortState.direction === 'asc' ? '▲' : '▼';
        }
    }
}

// Tambahkan listener klik untuk kolom yang dapat disortir
document.addEventListener('DOMContentLoaded', () => {
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
    
    // Terapkan sortir setelah filtering
    if (sortState.column) {
        filteredGames.sort((a, b) => {
            let aValue = a[sortState.column];
            let bValue = b[sortState.column];
            
            // Tangani nilai yang tidak terdefinisi atau null
            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortState.direction === 'asc' ? aValue.localeCompare(bValue, undefined, { sensitivity: 'base' }) : bValue.localeCompare(aValue, undefined, { sensitivity: 'base' });
            } else {
                // Perbandingan numerik untuk angka
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
    prevButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button text-slate-300 hover:text-white transition';
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
        firstButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button text-slate-300 hover:text-white transition';
        firstButton.addEventListener('click', () => { currentPage = 1; displayPage(); });
        paginationContainer.appendChild(firstButton);
        if (startPage > 2) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-slate-400">...</span>`);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button text-slate-300 hover:text-white transition';
        if (i === currentPage) {
            pageButton.classList.add('active', 'bg-emerald-500', 'hover:bg-emerald-400', 'text-slate-900', 'font-bold');
            pageButton.classList.remove('bg-slate-700', 'hover:bg-slate-600', 'text-slate-300');
        }
        pageButton.addEventListener('click', () => { currentPage = i; displayPage(); });
        paginationContainer.appendChild(pageButton);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationContainer.insertAdjacentHTML('beforeend', `<span class="px-2 py-1 text-slate-400">...</span>`);
        const lastButton = document.createElement('button');
        lastButton.textContent = totalPages;
        lastButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button text-slate-300 hover:text-white transition';
        lastButton.addEventListener('click', () => { currentPage = totalPages; displayPage(); });
        paginationContainer.appendChild(lastButton);
    }

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '&raquo;';
    nextButton.className = 'px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 pagination-button text-slate-300 hover:text-white transition';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; displayPage(); } });
    paginationContainer.appendChild(nextButton);
}

// --- LOGIKA AKSI MASSAL ---
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const bulkDeleteButton = document.getElementById('bulk-delete-button');
const bulkEditButton = document.getElementById('bulk-edit-button');
const selectionInfo = document.getElementById('selection-info');

selectAllCheckbox.addEventListener('change', (e) => {
    // Pilih semua checkbox di tampilan tabel dan kartu
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

// --- LOGIKA MODAL EDIT MASSAL ---
function openBulkEditModal() {
    const selectedIds = getSelectedGameIds();
    if (selectedIds.length === 0) return;

    bulkEditInfo.textContent = `Anda akan mengedit ${selectedIds.length} game. Centang properti yang ingin Anda ubah.`;
    bulkEditForm.reset(); // Hapus pilihan sebelumnya
    
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

// --- MANAJEMEN DATA ---
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
