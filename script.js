import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "", // Provided by environment
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
const gamesPerPage = 12; // Sedikit lebih banyak karena grid

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginButton = document.getElementById('login-button');
const logoutButtonText = document.getElementById('logout-button-text');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const gameListCards = document.getElementById('game-list-cards'); // Main container now
const addGameButton = document.getElementById('add-game-button');
const paginationContainer = document.getElementById('pagination-container');
const totalPriceElement = document.getElementById('total-price'); // Hidden but kept for logic
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

let gameIdToDelete = null; 
let currentConfirmCallback = null;
let platformChart, locationChart, statusChart;

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
        fetchPlatforms();
        fetchLocations();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
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
    toastMessage.textContent = message;
    
    // Style change based on error
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
        games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    gameListCards.innerHTML = '';
    
    if (!gamesToRender || gamesToRender.length === 0) {
        gameListCards.innerHTML = `<div class="col-span-full text-center py-12 border-3 border-black border-dashed bg-white opacity-75 font-bold">BELUM ADA GAME YANG COCOK.</div>`;
        return;
    }

    gamesToRender.forEach(game => {
        const card = document.createElement('div');
        // Neobrutalism Card Style
        card.className = 'neo-box p-4 flex flex-col justify-between h-full transition hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative bg-white';
        
        // Status Color Logic
        let statusColor = 'bg-gray-200';
        if(game.status === 'Dimainkan') statusColor = 'bg-cyan-300';
        if(game.status === 'Selesai') statusColor = 'bg-lime-400';
        
        card.innerHTML = `
            <div class="absolute top-4 right-4">
                <input type="checkbox" data-id="${game.id}" class="game-checkbox w-6 h-6 border-3 border-black accent-black">
            </div>
            
            <div class="mb-4 pr-8">
                <h3 class="font-display font-black text-lg leading-tight mb-2 uppercase break-words">${game.title}</h3>
                <div class="flex flex-wrap gap-2">
                    <span class="neo-badge bg-yellow-300">${game.platform}</span>
                    <span class="neo-badge ${statusColor}">${game.status}</span>
                </div>
            </div>
            
            <div class="mt-auto border-t-3 border-black pt-3">
                <div class="flex justify-between items-end mb-3">
                    <div class="text-xs font-bold text-gray-500 uppercase">Lokasi</div>
                    <div class="font-bold text-sm">${game.location}</div>
                </div>
                <div class="flex justify-between items-end mb-4">
                    <div class="text-xs font-bold text-gray-500 uppercase">Harga</div>
                    <div class="font-black text-lg">${game.price ? formatPrice(game.price) : 'Gratis'}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-2">
                    <button class="edit-btn neo-btn bg-white text-xs py-2 hover:bg-blue-200" data-id="${game.id}">EDIT</button>
                    <button class="delete-btn neo-btn bg-black text-white text-xs py-2 hover:bg-red-600" data-id="${game.id}">HAPUS</button>
                </div>
            </div>
        `;
        gameListCards.appendChild(card);
    });

    // Re-attach listeners
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    document.querySelectorAll('.game-checkbox').forEach(cb => cb.addEventListener('change', updateBulkActionUI));
}

function renderList(type) {
    const container = document.getElementById(`${type}-list-container`);
    const list = type === 'platform' ? platforms : locations;
    container.innerHTML = '';
    
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white border-2 border-black p-2 shadow-sm';
        div.innerHTML = `
            <span class="font-bold text-sm">${item.name}</span>
            <div class="flex gap-1">
                <button class="edit-item-btn p-1 hover:bg-yellow-200 border border-transparent hover:border-black transition" data-id="${item.id}" data-type="${type}" data-name="${item.name}">✏️</button>
                <button class="delete-item-btn p-1 hover:bg-red-200 border border-transparent hover:border-black transition" data-id="${item.id}" data-type="${type}" data-name="${item.name}">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- UI LOGIC ---

function createGameRowHTML(game = {}) {
    // Dynamic Options
    const platformOptions = platforms.map(p => `<option value="${p.name}" ${game.platform === p.name ? 'selected' : ''}>${p.name}</option>`).join('');
    const locationOptions = locations.map(l => `<option value="${l.name}" ${game.location === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
    
    return `
        <div class="game-row space-y-4">
            <div>
                <label class="block font-black text-xs uppercase mb-1">JUDUL GAME</label>
                <input type="text" class="game-title neo-input" value="${game.title || ''}" required>
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
                    <input type="number" class="game-price neo-input" value="${game.price || '0'}" min="0">
                </div>
                <div>
                    <label class="block font-black text-xs uppercase mb-1">STATUS</label>
                    <select class="game-status neo-input cursor-pointer">
                        <option ${game.status === 'Belum dimainkan' ? 'selected' : ''}>Belum dimainkan</option>
                        <option ${game.status === 'Dimainkan' ? 'selected' : ''}>Dimainkan</option>
                        <option ${game.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

function openModal(game = null) {
    document.getElementById('game-id').value = game ? game.id : '';
    modalTitle.textContent = game ? 'EDIT GAME' : 'TAMBAH GAME BARU';
    gameRowsContainer.innerHTML = createGameRowHTML(game);
    
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
cancelButton.addEventListener('click', closeModal);
gameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const row = gameRowsContainer.querySelector('.game-row');
    const gameData = {
        title: row.querySelector('.game-title').value,
        platform: row.querySelector('.game-platform').value,
        location: row.querySelector('.game-location').value,
        price: parseInt(row.querySelector('.game-price').value, 10),
        status: row.querySelector('.game-status').value,
    };

    try {
        const id = document.getElementById('game-id').value;
        if (id) {
            await updateDoc(doc(db, 'games', currentUser.uid, 'userGames', id), gameData);
            showToast('DATA DIPERBARUI');
        } else {
            await addDoc(collection(db, 'games', currentUser.uid, 'userGames'), gameData);
            showToast('GAME DITAMBAHKAN');
        }
        closeModal();
    } catch (err) { showToast(err.message, true); }
});

// --- TAB SWITCHING ---
const tabs = document.getElementById('tabs');
const tabContents = document.querySelectorAll('.tab-content');

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

// --- FILTER & PAGINATION Logic (Simplified) ---
function applyFiltersAndSort() {
    const title = document.getElementById('filter-title').value.toLowerCase();
    const platform = document.getElementById('filter-platform').value;
    const location = document.getElementById('filter-location').value;
    const status = document.getElementById('filter-status').value;

    filteredGames = games.filter(g => 
        g.title.toLowerCase().includes(title) &&
        (platform === '' || g.platform === platform) &&
        (location === '' || g.location === location) &&
        (status === '' || g.status === status)
    );
    
    displayPage();
}

function displayPage() {
    const start = (currentPage - 1) * gamesPerPage;
    renderGames(filteredGames.slice(start, start + gamesPerPage));
    
    // Update pagination UI
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
    if(totalPages > 1) {
        for(let i=1; i<=totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `w-8 h-8 border-2 border-black font-bold ${i === currentPage ? 'bg-black text-white' : 'bg-white hover:bg-gray-200'}`;
            btn.onclick = () => { currentPage = i; displayPage(); };
            paginationContainer.appendChild(btn);
        }
    }
    
    updateBulkActionUI(); // Reset checkboxes
}

['filter-title', 'filter-platform', 'filter-location', 'filter-status'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { currentPage = 1; applyFiltersAndSort(); });
});

// --- POPULATE DROPDOWNS ---
function populateDropdowns() {
    const pOpts = `<option value="">SEMUA</option>` + platforms.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const lOpts = `<option value="">SEMUA</option>` + locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    
    document.getElementById('filter-platform').innerHTML = pOpts;
    document.getElementById('filter-location').innerHTML = lOpts;
    document.getElementById('bulk-platform').innerHTML = pOpts.replace('SEMUA', '');
    document.getElementById('bulk-location').innerHTML = lOpts.replace('SEMUA', '');
}

// --- OTHER ACTIONS (Edit, Delete, Bulk) ---
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

document.getElementById('confirm-delete-button').addEventListener('click', async () => {
    if(currentConfirmCallback) await currentConfirmCallback();
    deleteConfirmModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => deleteConfirmModal.classList.add('hidden'), 200);
});
document.getElementById('cancel-delete-button').addEventListener('click', () => {
    deleteConfirmModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => deleteConfirmModal.classList.add('hidden'), 200);
});

// Bulk Actions
function updateBulkActionUI() {
    const selected = document.querySelectorAll('.game-checkbox:checked');
    const count = selected.length;
    
    if(count > 0) {
        bulkActionsBar.classList.remove('hidden');
        document.getElementById('selection-info').textContent = `${count} DIPILIH`;
    } else {
        bulkActionsBar.classList.add('hidden');
    }
}

document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
    document.querySelectorAll('.game-checkbox').forEach(cb => cb.checked = e.target.checked);
    updateBulkActionUI();
});

document.getElementById('bulk-delete-button').addEventListener('click', () => {
    const ids = Array.from(document.querySelectorAll('.game-checkbox:checked')).map(cb => cb.dataset.id);
    openDeleteConfirm(null, async () => {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(doc(db, 'games', currentUser.uid, 'userGames', id)));
        await batch.commit();
        showToast(`${ids.length} GAME DIHAPUS`);
    });
});

document.getElementById('bulk-edit-button').addEventListener('click', () => {
    const count = document.querySelectorAll('.game-checkbox:checked').length;
    bulkEditInfo.textContent = `MENGEDIT ${count} GAME`;
    bulkEditModal.classList.remove('hidden');
    bulkEditModal.classList.add('flex');
    setTimeout(() => bulkEditModalContent.classList.remove('scale-95', 'opacity-0'), 10);
});

document.getElementById('bulk-edit-cancel-button').addEventListener('click', () => {
    bulkEditModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => bulkEditModal.classList.add('hidden'), 200);
});

bulkEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ids = Array.from(document.querySelectorAll('.game-checkbox:checked')).map(cb => cb.dataset.id);
    const data = {};
    
    if(document.getElementById('bulk-update-platform-check').checked) data.platform = document.getElementById('bulk-platform').value;
    if(document.getElementById('bulk-update-location-check').checked) data.location = document.getElementById('bulk-location').value;
    if(document.getElementById('bulk-update-price-check').checked) data.price = parseInt(document.getElementById('bulk-price').value);
    if(document.getElementById('bulk-update-status-check').checked) data.status = document.getElementById('bulk-status').value;

    const batch = writeBatch(db);
    ids.forEach(id => batch.update(doc(db, 'games', currentUser.uid, 'userGames', id), data));
    await batch.commit();
    showToast("UPDATE MASAL BERHASIL");
    bulkEditModal.classList.add('hidden');
});

// --- CHARTS ---
function updateCharts() {
    const totalPrice = games.reduce((sum, g) => sum + (g.price || 0), 0);
    const expensive = games.reduce((max, g) => (g.price > max.price ? g : max), { price: 0 });
    
    statsTotalPrice.textContent = formatPrice(totalPrice);
    statsExpensive.textContent = expensive.title ? `${expensive.title} (${formatPrice(expensive.price)})` : '-';

    const pData = {}; const lData = {}; const sData = {};
    games.forEach(g => {
        pData[g.platform] = (pData[g.platform] || 0) + 1;
        lData[g.location] = (lData[g.location] || 0) + 1;
        sData[g.status] = (sData[g.status] || 0) + 1;
    });

    // Neobrutal Chart Options
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

    if(statusChart) statusChart.destroy();
    statusChart = new Chart(document.getElementById('status-chart'), chartConfig('bar', Object.keys(sData), Object.values(sData), '#a3e635'));

    if(platformChart) platformChart.destroy();
    platformChart = new Chart(document.getElementById('platform-chart'), chartConfig('pie', Object.keys(pData), Object.values(pData), ['#22d3ee', '#f472b6', '#facc15', '#a3e635', '#c084fc']));

    if(locationChart) locationChart.destroy();
    locationChart = new Chart(document.getElementById('location-chart'), chartConfig('doughnut', Object.keys(lData), Object.values(lData), ['#fb923c', '#60a5fa', '#4ade80']));
}

// --- MASTER DATA MANAGEMENT ---
document.getElementById('add-platform-button').addEventListener('click', async () => {
    const name = document.getElementById('new-platform-input').value.trim();
    if(name) {
        await addDoc(collection(db, 'games', currentUser.uid, 'userPlatforms'), { name });
        document.getElementById('new-platform-input').value = '';
        showToast('PLATFORM DITAMBAH');
    }
});

document.getElementById('add-location-button').addEventListener('click', async () => {
    const name = document.getElementById('new-location-input').value.trim();
    if(name) {
        await addDoc(collection(db, 'games', currentUser.uid, 'userLocations'), { name });
        document.getElementById('new-location-input').value = '';
        showToast('LOKASI DITAMBAH');
    }
});

// Event Delegation for Edit/Delete Items
const setupItemListeners = (container) => {
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

editItemCancelButton.addEventListener('click', () => {
    editItemModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => editItemModal.classList.add('hidden'), 200);
});

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