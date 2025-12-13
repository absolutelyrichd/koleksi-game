import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Config ---
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
let platforms = []; 
let locations = []; 
let filteredGames = [];
let unsubscribeGames = null; 
let unsubscribePlatforms = null; 
let unsubscribeLocations = null;

// --- Pagination state ---
let currentPage = 1;
const gamesPerPage = 12; 

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginButton = document.getElementById('login-button');
const logoutButtonText = document.getElementById('logout-button-text');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const gameListCards = document.getElementById('game-list-cards'); 
const addGameButton = document.getElementById('add-game-button');
const paginationContainer = document.getElementById('pagination-container');
const statsTotalPrice = document.getElementById('stats-total-price');
const statsExpensive = document.getElementById('stats-expensive');
const bulkActionsBar = document.getElementById('bulk-actions-bar');

// Modals
const gameModal = document.getElementById('game-modal');
const modalContent = document.getElementById('modal-content');
const gameForm = document.getElementById('game-form');
const cancelButton = document.getElementById('cancel-button');
const modalTitle = document.getElementById('modal-title');
const gameRowsContainer = document.getElementById('game-rows-container');
const addRowButton = document.getElementById('add-row-button');

const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmModalContent = document.getElementById('delete-confirm-modal-content');
const deleteConfirmMessage = document.getElementById('delete-confirm-message');
const cancelDeleteButton = document.getElementById('cancel-delete-button');
const confirmDeleteButton = document.getElementById('confirm-delete-button');

const bulkEditModal = document.getElementById('bulk-edit-modal');
const bulkEditModalContent = document.getElementById('bulk-edit-modal-content');
const bulkEditForm = document.getElementById('bulk-edit-form');
const bulkEditCancelButton = document.getElementById('bulk-edit-cancel-button');
const bulkEditInfo = document.getElementById('bulk-edit-info');

const editItemModal = document.getElementById('edit-item-modal');
const editItemModalContent = document.getElementById('edit-item-modal-content');
const editItemForm = document.getElementById('edit-item-form');
const editItemTitle = document.getElementById('edit-item-modal-title');
const editItemNameInput = document.getElementById('edit-item-name-input');
const editItemId = document.getElementById('edit-item-id');
const editItemType = document.getElementById('edit-item-type');
const editItemCancelButton = document.getElementById('edit-item-cancel-button');

// JSON Buttons
const downloadJsonBtn = document.getElementById('download-json-button');
const uploadJsonBtn = document.getElementById('upload-json-button');
const jsonFileInput = document.getElementById('json-file-input');

let gameIdToDelete = null; 
let currentConfirmCallback = null;
let platformChart, locationChart, statusChart;

// --- AUTHENTICATION ---
if (loginButton) {
    loginButton.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch((error) => {
            console.error("Error signing in: ", error);
            showToast(`Gagal masuk: ${error.message}`, true);
        });
    });
}

if (logoutButtonText) {
    logoutButtonText.addEventListener('click', () => signOut(auth));
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if(loginScreen) loginScreen.classList.add('hidden');
        if(appScreen) appScreen.classList.remove('hidden');
        if(userPhoto) userPhoto.src = user.photoURL;
        if(userName) userName.textContent = user.displayName;
        fetchGames();
        fetchPlatforms();
        fetchLocations();
    } else {
        currentUser = null;
        if(loginScreen) loginScreen.classList.remove('hidden');
        if(appScreen) appScreen.classList.add('hidden');
        if (unsubscribeGames) unsubscribeGames();
        if (unsubscribePlatforms) unsubscribePlatforms();
        if (unsubscribeLocations) unsubscribeLocations();
        games = []; platforms = []; locations = []; filteredGames = [];
    }
});

// --- HELPER FUNCTIONS ---
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    if(!toast || !toastMessage) return;

    toastMessage.textContent = message;
    
    if (isError) {
        toast.classList.remove('bg-black');
        toast.classList.add('bg-red-600');
    } else {
        toast.classList.remove('bg-red-600');
        toast.classList.add('bg-black');
    }

    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0');
    }, 3000);
}

function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
}

// --- COLOR GENERATOR ---
function generatePlatformColor(str) {
    if (!str) return '#e5e7eb'; 
    
    const normalizedStr = str.trim(); 
    
    const colorOverrides = {
        'GOG': 'hsl(260, 90%, 75%)',             
        
        'U-Connect': 'hsl(310, 90%, 70%)',       
        'Ubisoft': 'hsl(310, 90%, 70%)',
        'Ubisoft Connect': 'hsl(310, 90%, 70%)',
        'Uplay': 'hsl(310, 90%, 70%)',
        
        'EA': 'hsl(30, 100%, 70%)',              
        'EA App': 'hsl(30, 100%, 70%)',
        'Origin': 'hsl(30, 100%, 70%)',

        'Steam': 'hsl(210, 90%, 75%)',           
        'Epic': 'hsl(0, 0%, 80%)',               
        'Switch': 'hsl(0, 90%, 75%)',            
        'Nintendo Switch': 'hsl(0, 90%, 75%)',
        'PS5': 'hsl(240, 90%, 80%)',             
        'PlayStation': 'hsl(240, 90%, 80%)',
        'Xbox': 'hsl(120, 90%, 75%)',            
        'Game Pass': 'hsl(120, 90%, 75%)'
    };

    const key = Object.keys(colorOverrides).find(k => k.toLowerCase() === normalizedStr.toLowerCase());
    if (key) {
        return colorOverrides[key];
    }

    let hash = 0;
    for (let i = 0; i < normalizedStr.length; i++) {
        hash = normalizedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 90%, 75%)`;
}

// --- CRUD LOGIC ---

async function addDefaultData(collectionName, defaultItems) {
    if (!currentUser) return;
    try {
        const batch = writeBatch(db);
        defaultItems.forEach(name => {
            const docRef = doc(collection(db, 'games', currentUser.uid, `user${collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}`));
            batch.set(docRef, { name });
        });
        await batch.commit();
    } catch (error) { console.error(error); }
}

function fetchGames() {
    if (!currentUser) return;
    if (unsubscribeGames) unsubscribeGames();
    const q = query(collection(db, 'games', currentUser.uid, 'userGames'), orderBy("title")); 
    unsubscribeGames = onSnapshot(q, (snapshot) => {
        // Tambahkan default subsIndo = false jika belum ada
        games = snapshot.docs.map(doc => ({ id: doc.id, subsIndo: false, ...doc.data() }));
        games.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        applyFiltersAndSort();
        updateCharts();
    });
}

function fetchPlatforms() {
    if (!currentUser) return;
    const q = query(collection(db, 'games', currentUser.uid, 'userPlatforms'), orderBy("name"));
    unsubscribePlatforms = onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) await addDefaultData('platforms', ['Steam', 'Epic', 'GOG', 'PS5', 'Switch']);
        else {
            platforms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderList('platform'); populateDropdowns();
        }
    });
}

function fetchLocations() {
    if (!currentUser) return;
    const q = query(collection(db, 'games', currentUser.uid, 'userLocations'), orderBy("name"));
    unsubscribeLocations = onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) await addDefaultData('locations', ['HDD Eksternal', 'SSD Internal', 'Cloud', 'Rak Buku']);
        else {
            locations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderList('location'); populateDropdowns();
        }
    });
}

// --- RENDER FUNCTIONS (NEOBRUTALISM STYLE) ---

function renderGames(gamesToRender) {
    if(!gameListCards) return;
    gameListCards.innerHTML = '';
    
    if (!gamesToRender || gamesToRender.length === 0) {
        gameListCards.innerHTML = `<div class="col-span-full text-center py-12 border-3 border-black border-dashed bg-white opacity-75 font-bold rounded-lg">BELUM ADA GAME YANG COCOK.</div>`;
        return;
    }

    gamesToRender.forEach(game => {
        const card = document.createElement('div');
        card.className = 'neo-box p-4 flex flex-col justify-between h-full transition hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative bg-white';
        
        let statusColor = 'bg-gray-200';
        if(game.status === 'Dimainkan') statusColor = 'bg-cyan-300';
        if(game.status === 'Selesai') statusColor = 'bg-lime-400';
        
        const platformColor = generatePlatformColor(game.platform);
        
        // Menambahkan Subs Indo badge jika subsIndo: true
        const subsIndoBadge = game.subsIndo 
            ? `<span class="neo-badge bg-fuchsia-400 border-fuchsia-600">SUB INDO ✅</span>` 
            : '';
        
        card.innerHTML = `
            <div class="absolute top-4 right-4">
                <input type="checkbox" data-id="${game.id}" class="game-checkbox w-6 h-6 border-3 border-black accent-black rounded-sm">
            </div>
            <div class="mb-4 pr-8">
                <h3 class="font-display font-black text-lg leading-tight mb-2 uppercase break-words">${game.title}</h3>
                <div class="flex flex-wrap gap-2">
                    <span class="neo-badge" style="background-color: ${platformColor} !important;">${game.platform}</span>
                    <span class="neo-badge ${statusColor}">${game.status}</span>
                </div>
            </div>
            <div class="mt-auto border-t-3 border-black pt-3 space-y-2">
                
                <div class="flex justify-between items-end">
                    <div class="text-xs font-bold text-gray-500 uppercase">Lokasi</div>
                    <div class="font-bold text-sm">${game.location}</div>
                </div>
                
                <div class="flex justify-between items-end">
                    <div class="text-xs font-bold text-gray-500 uppercase">Harga</div>
                    <div class="font-black text-lg">${game.price ? formatPrice(game.price) : 'Gratis'}</div>
                </div>
                
                <div class="flex justify-between items-end">
                    <div class="text-xs font-bold text-gray-500 uppercase">Subs Indo</div>
                    <div class="font-bold text-sm">${game.subsIndo ? 'Ada' : 'Tidak Ada'}</div>
                </div>
                
            </div>
            
            <div class="grid grid-cols-2 gap-2 mt-4">
                <button class="edit-btn neo-btn bg-white text-xs py-2 hover:bg-blue-200" data-id="${game.id}">EDIT</button>
                <button class="delete-btn neo-btn bg-black text-white text-xs py-2 hover:bg-red-600" data-id="${game.id}">HAPUS</button>
            </div>
        `;
        gameListCards.appendChild(card);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    document.querySelectorAll('.game-checkbox').forEach(cb => cb.addEventListener('change', updateBulkActionUI));
}

function renderList(type) {
    const container = document.getElementById(`${type}-list-container`);
    if(!container) return;
    const list = type === 'platform' ? platforms : locations;
    container.innerHTML = '';
    
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white border-2 border-black p-2 shadow-sm rounded-lg';
        
        let colorDot = '';
        if (type === 'platform') {
            colorDot = `<span class="w-4 h-4 border-2 border-black mr-2 inline-block rounded-sm" style="background-color: ${generatePlatformColor(item.name)}"></span>`;
        }

        div.innerHTML = `
            <div class="flex items-center">
                ${colorDot}
                <span class="font-bold text-sm">${item.name}</span>
            </div>
            <div class="flex gap-1">
                <button class="edit-item-btn p-1 hover:bg-yellow-200 border border-transparent hover:border-black transition rounded" data-id="${item.id}" data-type="${type}" data-name="${item.name}">✏️</button>
                <button class="delete-item-btn p-1 hover:bg-red-200 border border-transparent hover:border-black transition rounded" data-id="${item.id}" data-type="${type}" data-name="${item.name}">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- UI LOGIC (MULTI-ROW) ---

function createGameRowHTML(game = null) {
    const g = game || {};
    const isEditMode = !!game;
    
    const platformOptions = platforms.map(p => `<option value="${p.name}" ${g.platform === p.name ? 'selected' : ''}>${p.name}</option>`).join('');
    const locationOptions = locations.map(l => `<option value="${l.name}" ${g.location === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
    
    const deleteBtn = isEditMode ? '' : `<button type="button" class="remove-row-btn absolute top-0 right-0 bg-red-500 text-white w-8 h-8 flex items-center justify-center border-l-2 border-b-2 border-black font-bold hover:bg-red-600 z-10 rounded-tr-lg rounded-bl-lg" title="Hapus Baris">✕</button>`;
    
    // Logika untuk select Subs Indo
    // Nilai select akan menjadi string 'true' atau 'false'
    const subsIndoValue = g.subsIndo ? 'Ada' : 'Tidak Ada';

    return `
        <div class="game-row relative p-4 border-2 border-black bg-gray-50 mb-4 rounded-lg">
            ${deleteBtn}
            <div class="space-y-4">
                <div>
                    <label class="block font-black text-xs uppercase mb-1">JUDUL GAME</label>
                    <input type="text" class="game-title neo-input" value="${g.title || ''}" placeholder="Judul Game..." required>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block font-black text-xs uppercase mb-1">PLATFORM</label>
                        <select class="game-platform neo-input cursor-pointer">
                            ${platformOptions || '<option>Loading...</option>'}
                        </select>
                    </div>
                    <div>
                        <label class="block font-black text-xs uppercase mb-1">LOKASI</label>
                        <select class="game-location neo-input cursor-pointer">
                            ${locationOptions || '<option>Loading...</option>'}
                        </select>
                    </div>
                    <div>
                        <label class="block font-black text-xs uppercase mb-1">HARGA (IDR)</label>
                        <input type="number" class="game-price neo-input" value="${g.price || '0'}" min="0">
                    </div>
                    <div>
                        <label class="block font-black text-xs uppercase mb-1">STATUS</label>
                        <select class="game-status neo-input cursor-pointer">
                            <option ${g.status === 'Belum dimainkan' ? 'selected' : ''}>Belum dimainkan</option>
                            <option ${g.status === 'Dimainkan' ? 'selected' : ''}>Dimainkan</option>
                            <option ${g.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                        </select>
                    </div>
                </div>
                
                <!-- NEW: Subs Indo Select Dropdown -->
                <div class="pt-2">
                    <label class="block font-black text-xs uppercase mb-1">SUBTITLE INDONESIA</label>
                    <select class="game-subs-indo neo-input cursor-pointer">
                        <option value="true" ${subsIndoValue === 'Ada' ? 'selected' : ''}>Ada</option>
                        <option value="false" ${subsIndoValue === 'Tidak Ada' ? 'selected' : ''}>Tidak Ada</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

function addNewGameRow() {
    gameRowsContainer.insertAdjacentHTML('beforeend', createGameRowHTML());
}

if(gameRowsContainer) {
    gameRowsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-row-btn')) {
            e.target.closest('.game-row').remove();
        }
    });
}

function openModal(game = null) {
    document.getElementById('game-id').value = game ? game.id : '';
    modalTitle.textContent = game ? 'EDIT GAME' : 'TAMBAH GAME (BATCH)';
    gameRowsContainer.innerHTML = '';

    if (game) {
        gameRowsContainer.innerHTML = createGameRowHTML(game);
        addRowButton.classList.add('hidden');
    } else {
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

if(addGameButton) addGameButton.addEventListener('click', () => openModal());
if(addRowButton) addRowButton.addEventListener('click', addNewGameRow);
if(cancelButton) cancelButton.addEventListener('click', closeModal);

if(gameForm) {
    gameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        
        const id = document.getElementById('game-id').value;
        
        try {
            if (id) {
                const row = gameRowsContainer.querySelector('.game-row');
                // Mengambil nilai 'Ada' atau 'Tidak Ada', lalu konversi ke boolean
                const subsIndoValue = row.querySelector('.game-subs-indo').value === 'true';
                
                const gameData = {
                    title: row.querySelector('.game-title').value,
                    platform: row.querySelector('.game-platform').value,
                    location: row.querySelector('.game-location').value,
                    price: parseInt(row.querySelector('.game-price').value, 10) || 0,
                    status: row.querySelector('.game-status').value,
                    subsIndo: subsIndoValue, // Subs Indo (boolean)
                };
                await updateDoc(doc(db, 'games', currentUser.uid, 'userGames', id), gameData);
                showToast('DATA DIPERBARUI');
            } else {
                const rows = gameRowsContainer.querySelectorAll('.game-row');
                if (rows.length === 0) return showToast("Tidak ada data untuk disimpan", true);

                const batch = writeBatch(db);
                let count = 0;
                rows.forEach(row => {
                    const title = row.querySelector('.game-title').value.trim();
                    if (title) {
                        // Mengambil nilai 'Ada' atau 'Tidak Ada', lalu konversi ke boolean
                        const subsIndoValue = row.querySelector('.game-subs-indo').value === 'true';
                        
                        const gameData = {
                            title: title,
                            platform: row.querySelector('.game-platform').value,
                            location: row.querySelector('.game-location').value,
                            price: parseInt(row.querySelector('.game-price').value, 10) || 0,
                            status: row.querySelector('.game-status').value,
                            subsIndo: subsIndoValue, // Subs Indo (boolean)
                        };
                        const newGameRef = doc(collection(db, 'games', currentUser.uid, 'userGames'));
                        batch.set(newGameRef, gameData);
                        count++;
                    }
                });

                if (count > 0) {
                    await batch.commit();
                    showToast(`${count} GAME DITAMBAHKAN`);
                } else {
                    return showToast("Mohon isi judul game setidaknya satu.", true);
                }
            }
            closeModal();
        } catch (err) { 
            console.error(err);
            showToast("Terjadi kesalahan: " + err.message, true); 
        }
    });
}

// --- TAB SWITCHING ---
const tabs = document.getElementById('tabs');
const tabContents = document.querySelectorAll('.tab-content');

if(tabs) {
    tabs.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-btn')) return;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const targetId = e.target.dataset.tab;
        tabContents.forEach(content => {
            if (content.id === targetId) content.classList.remove('hidden');
            else content.classList.add('hidden');
        });
    });
}

// --- FILTER & PAGINATION Logic ---
function applyFiltersAndSort() {
    const titleInput = document.getElementById('filter-title');
    const platformInput = document.getElementById('filter-platform');
    const locationInput = document.getElementById('filter-location');
    const statusInput = document.getElementById('filter-status');
    const sortSelect = document.getElementById('sort-options'); 

    if (!titleInput || !platformInput || !locationInput || !statusInput || !sortSelect) return;

    const title = titleInput.value.toLowerCase();
    const platform = platformInput.value;
    const location = locationInput.value;
    const status = statusInput.value;
    const sortValue = sortSelect.value;

    filteredGames = games.filter(g => 
        g.title.toLowerCase().includes(title) &&
        (platform === '' || g.platform === platform) &&
        (location === '' || g.location === location) &&
        (status === '' || g.status === status)
    );

    filteredGames.sort((a, b) => {
        switch (sortValue) {
            case 'price-desc': // Termahal
                return (b.price || 0) - (a.price || 0);
            case 'price-asc': // Termurah
                return (a.price || 0) - (b.price || 0);
            case 'title-desc': // Z-A
                return b.title.localeCompare(a.title);
            case 'title-asc': // A-Z
            default:
                return a.title.localeCompare(b.title);
        }
    });
    
    displayPage();
}

function displayPage() {
    const start = (currentPage - 1) * gamesPerPage;
    renderGames(filteredGames.slice(start, start + gamesPerPage));
    
    if(!paginationContainer) return;
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
    if(totalPages > 1) {
        for(let i=1; i<=totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `w-8 h-8 border-2 border-black font-bold rounded-md ${i === currentPage ? 'bg-black text-white' : 'bg-white hover:bg-gray-200'}`;
            btn.onclick = () => { currentPage = i; displayPage(); };
            paginationContainer.appendChild(btn);
        }
    }
    updateBulkActionUI();
}

['filter-title', 'filter-platform', 'filter-location', 'filter-status', 'sort-options'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => { currentPage = 1; applyFiltersAndSort(); });
});

// --- POPULATE DROPDOWNS ---
function populateDropdowns() {
    const pOpts = `<option value="">SEMUA</option>` + platforms.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const lOpts = `<option value="">SEMUA</option>` + locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    
    const fp = document.getElementById('filter-platform');
    const fl = document.getElementById('filter-location');
    const bp = document.getElementById('bulk-platform');
    const bl = document.getElementById('bulk-location');

    if(fp) fp.innerHTML = pOpts;
    if(fl) fl.innerHTML = lOpts;
    if(bp) bp.innerHTML = pOpts.replace('SEMUA', '');
    if(bl) bl.innerHTML = lOpts.replace('SEMUA', '');
}

// --- OTHER ACTIONS ---
function handleEdit(e) {
    const id = e.target.dataset.id;
    const game = games.find(g => g.id === id);
    if(game) openModal(game);
}

function handleDelete(e) {
    const id = e.target.dataset.id;
    openDeleteConfirm(id, async () => {
        await deleteDoc(doc(db, 'games', currentUser.uid, 'userGames', id));
        showToast('GAME DIHAPUS');
    });
}

function openDeleteConfirm(id, callback) {
    deleteConfirmMessage.textContent = id ? "Yakin ingin menghapus game ini?" : "Yakin ingin menghapus game terpilih?";
    currentConfirmCallback = callback;
    deleteConfirmModal.classList.remove('hidden');
    deleteConfirmModal.classList.add('flex');
    setTimeout(() => deleteConfirmModalContent.classList.remove('scale-95', 'opacity-0'), 10);
}

if(confirmDeleteButton) {
    confirmDeleteButton.addEventListener('click', async () => {
        if(currentConfirmCallback) await currentConfirmCallback();
        deleteConfirmModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => deleteConfirmModal.classList.add('hidden'), 200);
    });
}
if(cancelDeleteButton) {
    cancelDeleteButton.addEventListener('click', () => {
        deleteConfirmModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => deleteConfirmModal.classList.add('hidden'), 200);
    });
}

// Bulk Actions
function updateBulkActionUI() {
    const selected = document.querySelectorAll('.game-checkbox:checked');
    const count = selected.length;
    if(count > 0 && bulkActionsBar) {
        bulkActionsBar.classList.remove('hidden');
        document.getElementById('selection-info').textContent = `${count} DIPILIH`;
    } else if (bulkActionsBar) {
        bulkActionsBar.classList.add('hidden');
    }
}

const selectAllCheckbox = document.getElementById('select-all-checkbox');
if(selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
        document.querySelectorAll('.game-checkbox').forEach(cb => cb.checked = e.target.checked);
        updateBulkActionUI();
    });
}

const bulkDeleteBtn = document.getElementById('bulk-delete-button');
if(bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
        const ids = Array.from(document.querySelectorAll('.game-checkbox:checked')).map(cb => cb.dataset.id);
        openDeleteConfirm(null, async () => {
            const batch = writeBatch(db);
            ids.forEach(id => batch.delete(doc(db, 'games', currentUser.uid, 'userGames', id)));
            await batch.commit();
            showToast(`${ids.length} GAME DIHAPUS`);
        });
    });
}

const bulkEditBtn = document.getElementById('bulk-edit-button');
if(bulkEditBtn) {
    bulkEditBtn.addEventListener('click', () => {
        const count = document.querySelectorAll('.game-checkbox:checked').length;
        bulkEditInfo.textContent = `MENGEDIT ${count} GAME`;
        bulkEditModal.classList.remove('hidden');
        bulkEditModal.classList.add('flex');
        setTimeout(() => bulkEditModalContent.classList.remove('scale-95', 'opacity-0'), 10);
    });
}

if(bulkEditCancelButton) {
    bulkEditCancelButton.addEventListener('click', () => {
        bulkEditModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => bulkEditModal.classList.add('hidden'), 200);
    });
}

if(bulkEditForm) {
    bulkEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ids = Array.from(document.querySelectorAll('.game-checkbox:checked')).map(cb => cb.dataset.id);
        const data = {};
        
        if(document.getElementById('bulk-update-platform-check').checked) data.platform = document.getElementById('bulk-platform').value;
        if(document.getElementById('bulk-update-location-check').checked) data.location = document.getElementById('bulk-location').value;
        if(document.getElementById('bulk-update-price-check').checked) data.price = parseInt(document.getElementById('bulk-price').value);
        if(document.getElementById('bulk-update-status-check').checked) data.status = document.getElementById('bulk-status').value;

        // NEW LOGIC: Bulk update Subs Indo
        if(document.getElementById('bulk-update-subs-indo-check').checked) {
            // Nilai dari select adalah string 'true' atau 'false'. Konversi ke boolean.
            data.subsIndo = document.getElementById('bulk-subs-indo').value === 'true';
        }


        const batch = writeBatch(db);
        ids.forEach(id => batch.update(doc(db, 'games', currentUser.uid, 'userGames', id), data));
        await batch.commit();
        showToast("UPDATE MASAL BERHASIL");
        bulkEditModal.classList.add('hidden');
    });
}

// --- CHARTS (UPDATED COLORS) ---
function updateCharts() {
    const totalPrice = games.reduce((sum, g) => sum + (g.price || 0), 0);
    const expensive = games.reduce((max, g) => (g.price > max.price ? g : max), { price: 0 });
    
    if(statsTotalPrice) statsTotalPrice.textContent = formatPrice(totalPrice);
    if(statsExpensive) statsExpensive.textContent = expensive.title ? `${expensive.title} (${formatPrice(expensive.price)})` : '-';

    const pData = {}; const lData = {}; const sData = {};
    games.forEach(g => {
        pData[g.platform] = (pData[g.platform] || 0) + 1;
        lData[g.location] = (lData[g.location] || 0) + 1;
        sData[g.status] = (sData[g.status] || 0) + 1;
    });

    const chartConfig = (type, labels, data, colors) => ({
        type: type,
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#000',
                borderWidth: 2
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: type === 'bar' ? {
                y: { grid: { color: '#000', lineWidth: 1 }, ticks: { color: '#000', font: { weight: 'bold' } } },
                x: { grid: { display: false }, ticks: { color: '#000', font: { weight: 'bold' } } }
            } : {}
        }
    });

    const sc = document.getElementById('status-chart');
    if(sc) {
        if(statusChart) statusChart.destroy();
        statusChart = new Chart(sc, chartConfig('bar', Object.keys(sData), Object.values(sData), '#a3e635'));
    }

    // Update Platform Chart agar warnanya sinkron dengan Badge
    const pc = document.getElementById('platform-chart');
    if(pc) {
        if(platformChart) platformChart.destroy();
        // Generate array warna berdasarkan label platform
        const platformLabels = Object.keys(pData);
        const platformColors = platformLabels.map(label => generatePlatformColor(label));
        
        platformChart = new Chart(pc, chartConfig('pie', platformLabels, Object.values(pData), platformColors));
    }

    const lc = document.getElementById('location-chart');
    if(lc) {
        if(locationChart) locationChart.destroy();
        locationChart = new Chart(lc, chartConfig('doughnut', Object.keys(lData), Object.values(lData), ['#fb923c', '#60a5fa', '#4ade80']));
    }
}

// --- MASTER DATA MANAGEMENT ---
const addPlatformBtn = document.getElementById('add-platform-button');
if(addPlatformBtn) {
    addPlatformBtn.addEventListener('click', async () => {
        const name = document.getElementById('new-platform-input').value.trim();
        if(name) {
            await addDoc(collection(db, 'games', currentUser.uid, 'userPlatforms'), { name });
            document.getElementById('new-platform-input').value = '';
            showToast('PLATFORM DITAMBAH');
        }
    });
}

const addLocationBtn = document.getElementById('add-location-button');
if(addLocationBtn) {
    addLocationBtn.addEventListener('click', async () => {
        const name = document.getElementById('new-location-input').value.trim();
        if(name) {
            await addDoc(collection(db, 'games', currentUser.uid, 'userLocations'), { name });
            document.getElementById('new-location-input').value = '';
            showToast('LOKASI DITAMBAH');
        }
    });
}

const setupItemListeners = (container) => {
    if(!container) return;
    container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-item-btn');
        const delBtn = e.target.closest('.delete-item-btn');
        
        if(editBtn) {
            editItemId.value = editBtn.dataset.id;
            editItemType.value = editBtn.dataset.type;
            editItemNameInput.value = editBtn.dataset.name;
            editItemTitle.textContent = `EDIT ${editBtn.dataset.type.toUpperCase()}`;
            
            editItemModal.classList.remove('hidden');
            editItemModal.classList.add('flex');
            setTimeout(() => editItemModalContent.classList.remove('scale-95', 'opacity-0'), 10);
        }
        
        if(delBtn) {
            openDeleteConfirm(null, async () => {
                const col = delBtn.dataset.type === 'platform' ? 'userPlatforms' : 'userLocations';
                await deleteDoc(doc(db, 'games', currentUser.uid, col, delBtn.dataset.id));
                showToast('ITEM DIHAPUS');
            });
        }
    });
};

setupItemListeners(document.getElementById('platform-list-container'));
setupItemListeners(document.getElementById('location-list-container'));

if(editItemCancelButton) {
    editItemCancelButton.addEventListener('click', () => {
        editItemModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => editItemModal.classList.add('hidden'), 200);
    });
}

if(editItemForm) {
    editItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editItemId.value;
        const type = editItemType.value;
        const name = editItemNameInput.value.trim();
        const col = type === 'platform' ? 'userPlatforms' : 'userLocations';
        
        await updateDoc(doc(db, 'games', currentUser.uid, col, id), { name });
        showToast('ITEM DIPERBARUI');
        editItemModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => editItemModal.classList.add('hidden'), 200);
    });
}

// --- LOGIKA BARU: DOWNLOAD & UPLOAD JSON ---

// 1. Download JSON
if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', () => {
        if (!currentUser) return showToast("Harap login terlebih dahulu", true);
        
        // Buat objek data yang akan dibackup
        const dataBackup = {
            games: games,
            platforms: platforms,
            locations: locations,
            backupDate: new Date().toISOString(),
            appVersion: "1.0"
        };

        // Convert ke string JSON
        const dataStr = JSON.stringify(dataBackup, null, 2);
        
        // Buat Blob dan Link untuk download
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", url);
        downloadAnchor.setAttribute("download", `koleksi-game-backup-${new Date().toISOString().slice(0,10)}.json`);
        
        // Trigger klik
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        
        // Bersihkan
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);
        
        showToast("Backup JSON diunduh!");
    });
}

// 2. Upload JSON Trigger
if (uploadJsonBtn && jsonFileInput) {
    uploadJsonBtn.addEventListener('click', () => {
        jsonFileInput.click();
    });

    jsonFileInput.addEventListener('change', async (e) => {
        if (!currentUser) return showToast("Harap login terlebih dahulu", true);
        
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Validasi sederhana
                if (!data.games && !data.platforms && !data.locations) {
                    throw new Error("Format JSON tidak dikenali.");
                }

                const batch = writeBatch(db);
                let count = 0;

                // Import Platforms (Cek duplikat berdasarkan nama)
                if (data.platforms && Array.isArray(data.platforms)) {
                    data.platforms.forEach(p => {
                        const exists = platforms.some(curr => curr.name.toLowerCase() === p.name.toLowerCase());
                        if (!exists && p.name) {
                            const newRef = doc(collection(db, 'games', currentUser.uid, 'userPlatforms'));
                            batch.set(newRef, { name: p.name });
                            count++;
                        }
                    });
                }

                // Import Locations (Cek duplikat berdasarkan nama)
                if (data.locations && Array.isArray(data.locations)) {
                    data.locations.forEach(l => {
                        const exists = locations.some(curr => curr.name.toLowerCase() === l.name.toLowerCase());
                        if (!exists && l.name) {
                            const newRef = doc(collection(db, 'games', currentUser.uid, 'userLocations'));
                            batch.set(newRef, { name: l.name });
                            count++;
                        }
                    });
                }

                // Import Games (Cek duplikat judul + platform agar tidak double)
                if (data.games && Array.isArray(data.games)) {
                    data.games.forEach(g => {
                        // Logic Cek Duplikat: Judul sama DAN Platform sama
                        const isDuplicate = games.some(curr => 
                            curr.title.toLowerCase() === g.title.toLowerCase() && 
                            curr.platform === g.platform
                        );

                        if (!isDuplicate && g.title) {
                            const newRef = doc(collection(db, 'games', currentUser.uid, 'userGames'));
                            batch.set(newRef, { // Menggunakan newRef yang baru dibuat
                                title: g.title,
                                platform: g.platform || 'Other',
                                location: g.location || 'Cloud',
                                price: g.price || 0,
                                status: g.status || 'Belum dimainkan',
                                subsIndo: g.subsIndo || false // Subs Indo
                            });
                            count++;
                        }
                    });
                }

                if (count > 0) {
                    await batch.commit();
                    showToast(`Sukses! ${count} data baru ditambahkan.`);
                } else {
                    showToast("Tidak ada data baru (semua sudah ada).", true);
                }

            } catch (err) {
                console.error("JSON Error:", err);
                showToast("Gagal membaca file JSON: " + err.message, true);
            }
            
            // Reset input agar bisa upload file yang sama lagi jika perlu
            jsonFileInput.value = '';
        };

        reader.readAsText(file);
    });
}

// --- NAVBAR SCROLL EFFECT ---
const navbar = document.getElementById('main-navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            navbar.classList.remove('bg-white');
            // More transparent and more blur
            navbar.classList.add('bg-white/30', 'backdrop-blur-xl');
        } else {
            navbar.classList.add('bg-white');
            navbar.classList.remove('bg-white/30', 'backdrop-blur-xl');
        }
    });
}

// Cek apakah browser mendukung Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker Registered!', reg))
      .catch(err => console.log('Service Worker Registration Failed:', err));
  });
}