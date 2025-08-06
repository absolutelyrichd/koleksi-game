// Mengambil referensi ke elemen-elemen DOM
const authButton = document.getElementById('auth-button');
const userInfo = document.getElementById('user-info');
const pageContent = document.getElementById('page-content');
const navLinks = document.querySelectorAll('nav a');
const gameListBody = document.getElementById('game-list-body');
const addGameBtn = document.getElementById('add-game-btn');
const gameModal = document.getElementById('game-modal');
const gameForm = document.getElementById('game-form');
const modalTitle = document.getElementById('modal-title');
const gameIdInput = document.getElementById('game-id');
const gameTitleInput = document.getElementById('game-title');
const gamePlatformInput = document.getElementById('game-platform');
const gameLocationInput = document.getElementById('game-location');
const gameStatusInput = document.getElementById('game-status');
const closeModalButtons = document.querySelectorAll('.close-button');
const paginationControls = document.getElementById('pagination-controls');

// Statistik
const statTotalGames = document.getElementById('stat-total-games');
const statNotPlayed = document.getElementById('stat-not-played');
const statPlaying = document.getElementById('stat-playing');
const statCompleted = document.getElementById('stat-completed');
const statHdd2tb = document.getElementById('stat-hdd2tb');
const statSteam = document.getElementById('stat-steam');

// Aksi Massal
const bulkActionStatus = document.getElementById('bulk-action-status');
const applyBulkStatusBtn = document.getElementById('apply-bulk-status-btn');
const bulkActionPlatform = document.getElementById('bulk-action-platform');
const applyBulkPlatformBtn = document.getElementById('apply-bulk-platform-btn');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

// Manajemen Data
const downloadJsonBtn = document.getElementById('download-json-btn');
const uploadJsonInput = document.getElementById('upload-json-input');

// Modal Konfirmasi
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const cancelConfirmBtn = document.getElementById('cancel-confirm-btn');
const executeConfirmBtn = document.getElementById('execute-confirm-btn');

// Variabel Firebase dari window
const auth = window.firebaseAuth;
const db = window.firebaseDb;
const provider = window.googleAuthProvider;
const signInWithPopup = window.firebaseSignInWithPopup;
const signOut = window.firebaseSignOut;
const onAuthStateChanged = window.firebaseOnAuthStateChanged;
const collection = window.firebaseCollection;
const addDoc = window.firebaseAddDoc;
const getDocs = window.firebaseGetDocs;
const doc = window.firebaseDoc;
const updateDoc = window.firebaseUpdateDoc;
const deleteDoc = window.firebaseDeleteDoc;
const onSnapshot = window.firebaseOnSnapshot;
const query = window.firebaseQuery;
const setDoc = window.firebaseSetDoc;

let currentUser = null;
let allGames = []; // Menyimpan semua game yang diambil dari Firestore
const gamesPerPage = 10;
let currentPage = 1;

// --- Fungsi Utilitas ---

/**
 * Menampilkan pesan konfirmasi kepada pengguna.
 * @param {string} message - Pesan yang akan ditampilkan.
 * @returns {Promise<boolean>} - Mengembalikan true jika pengguna mengkonfirmasi, false jika membatalkan.
 */
function showConfirmModal(message) {
    confirmMessage.textContent = message;
    confirmModal.style.display = 'flex';
    return new Promise((resolve) => {
        executeConfirmBtn.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(true);
        };
        cancelConfirmBtn.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(false);
        };
    });
}

/**
 * Menampilkan halaman yang dipilih dan menyembunyikan halaman lainnya.
 * @param {string} pageId - ID dari elemen halaman yang akan ditampilkan.
 */
function showPage(pageId) {
    document.querySelectorAll('#page-content > div').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageId).classList.remove('hidden');

    // Perbarui status aktif di sidebar
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`[id="nav-${pageId.replace('-page', '')}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Perbarui judul utama
    const mainTitle = document.querySelector('.main-content h1');
    if (pageId === 'dashboard-page') mainTitle.textContent = 'Dashboard';
    if (pageId === 'game-list-page') mainTitle.textContent = 'Daftar Game';
    if (pageId === 'statistics-page') mainTitle.textContent = 'Statistik Game';
    if (pageId === 'bulk-actions-page') mainTitle.textContent = 'Aksi Massal';
    if (pageId === 'data-management-page') mainTitle.textContent = 'Manajemen Data';

    // Jika masuk ke halaman daftar game, muat ulang daftar
    if (pageId === 'game-list-page' && currentUser) {
        loadGames();
    }
    // Jika masuk ke halaman statistik, perbarui statistik
    if (pageId === 'statistics-page' && currentUser) {
        updateStatistics();
    }
}

/**
 * Menampilkan modal tambah/edit game.
 * @param {Object} [gameData=null] - Data game untuk diedit. Jika null, modal akan dalam mode tambah.
 */
function openGameModal(gameData = null) {
    gameForm.reset(); // Reset form
    gameIdInput.value = ''; // Kosongkan ID game

    if (gameData) {
        modalTitle.textContent = 'Edit Game';
        gameIdInput.value = gameData.id;
        gameTitleInput.value = gameData.title;
        gamePlatformInput.value = gameData.platform;
        gameLocationInput.value = gameData.location;
        gameStatusInput.value = gameData.status;
    } else {
        modalTitle.textContent = 'Tambah Game Baru';
    }
    gameModal.style.display = 'flex';
}

/**
 * Menutup modal tambah/edit game.
 */
function closeGameModal() {
    gameModal.style.display = 'none';
}

// --- Autentikasi Firebase ---

/**
 * Menangani login pengguna dengan Google.
 */
async function signIn() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error saat login dengan Google:", error);
        alert("Gagal login dengan Google. Silakan coba lagi.");
    }
}

/**
 * Menangani logout pengguna.
 */
async function signOutUser() {
    const confirmed = await showConfirmModal("Apakah Anda yakin ingin logout?");
    if (confirmed) {
        try {
            await signOut(auth);
            // onAuthStateChanged akan menangani pembaruan UI
        } catch (error) {
            console.error("Error saat logout:", error);
            alert("Gagal logout. Silakan coba lagi.");
        }
    }
}

/**
 * Mendengarkan perubahan status autentikasi.
 */
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        authButton.textContent = 'Logout';
        userInfo.textContent = `Login sebagai: ${user.displayName || user.email}`;
        userInfo.classList.remove('hidden');
        authButton.onclick = signOutUser;
        // Muat game setelah login
        loadGames();
        updateStatistics();
        showPage('game-list-page'); // Arahkan ke daftar game setelah login
    } else {
        authButton.textContent = 'Login dengan Google';
        userInfo.textContent = '';
        userInfo.classList.add('hidden');
        authButton.onclick = signIn;
        allGames = []; // Kosongkan data game saat logout
        displayGames(allGames); // Kosongkan tabel
        showPage('dashboard-page'); // Kembali ke dashboard saat logout
    }
});

// --- CRUD Game (Firestore) ---

/**
 * Memuat daftar game dari Firestore.
 */
async function loadGames() {
    if (!currentUser) {
        gameListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Silakan login untuk melihat koleksi game Anda.</td></tr>';
        return;
    }

    try {
        const gamesColRef = collection(db, 'games', currentUser.uid, 'myGames');
        // Menggunakan onSnapshot untuk real-time updates
        onSnapshot(gamesColRef, (snapshot) => {
            allGames = [];
            snapshot.forEach(doc => {
                allGames.push({ id: doc.id, ...doc.data() });
            });
            // Sortir game berdasarkan judul secara default
            allGames.sort((a, b) => a.title.localeCompare(b.title));
            displayGames(allGames);
            updatePaginationControls();
            updateStatistics(); // Perbarui statistik setiap kali data game berubah
        }, (error) => {
            console.error("Error mengambil game secara real-time:", error);
            gameListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Gagal memuat game.</td></tr>';
        });
    } catch (error) {
        console.error("Error saat memuat game:", error);
        gameListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Gagal memuat game.</td></tr>';
    }
}

/**
 * Menampilkan game ke tabel dengan paginasi.
 * @param {Array<Object>} games - Array objek game untuk ditampilkan.
 */
function displayGames(games) {
    gameListBody.innerHTML = '';
    if (games.length === 0) {
        gameListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada game dalam koleksi Anda.</td></tr>';
        return;
    }

    const startIndex = (currentPage - 1) * gamesPerPage;
    const endIndex = startIndex + gamesPerPage;
    const gamesToDisplay = games.slice(startIndex, endIndex);

    gamesToDisplay.forEach(game => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-3 px-4 whitespace-nowrap">${game.title}</td>
            <td class="py-3 px-4 whitespace-nowrap">${game.platform}</td>
            <td class="py-3 px-4 whitespace-nowrap">${game.location}</td>
            <td class="py-3 px-4 whitespace-nowrap">${game.status}</td>
            <td class="py-3 px-4 whitespace-nowrap">
                <button data-id="${game.id}" class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button data-id="${game.id}" class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm">
                    <i class="fas fa-trash-alt"></i> Hapus
                </button>
            </td>
        `;
        gameListBody.appendChild(row);
    });

    // Tambahkan event listener untuk tombol edit dan hapus
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.onclick = (e) => {
            const gameId = e.target.dataset.id;
            const gameToEdit = allGames.find(g => g.id === gameId);
            if (gameToEdit) {
                openGameModal(gameToEdit);
            }
        };
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = async (e) => {
            const gameId = e.target.dataset.id;
            const confirmed = await showConfirmModal("Apakah Anda yakin ingin menghapus game ini?");
            if (confirmed) {
                deleteGame(gameId);
            }
        };
    });
}

/**
 * Menambahkan atau memperbarui game di Firestore.
 * @param {Event} e - Objek event dari submit form.
 */
async function addOrUpdateGame(e) {
    e.preventDefault();
    if (!currentUser) {
        alert("Anda harus login untuk menambah/mengedit game.");
        return;
    }

    const gameId = gameIdInput.value;
    const gameData = {
        title: gameTitleInput.value,
        platform: gamePlatformInput.value,
        location: gameLocationInput.value,
        status: gameStatusInput.value
    };

    try {
        if (gameId) {
            // Update game
            const gameRef = doc(db, 'games', currentUser.uid, 'myGames', gameId);
            await updateDoc(gameRef, gameData);
            alert('Game berhasil diperbarui!');
        } else {
            // Add new game
            const gamesColRef = collection(db, 'games', currentUser.uid, 'myGames');
            await addDoc(gamesColRef, gameData);
            alert('Game berhasil ditambahkan!');
        }
        closeGameModal();
    } catch (error) {
        console.error("Error saat menambah/memperbarui game:", error);
        alert("Gagal menyimpan game. Silakan coba lagi.");
    }
}

/**
 * Menghapus game dari Firestore.
 * @param {string} id - ID dokumen game yang akan dihapus.
 */
async function deleteGame(id) {
    if (!currentUser) {
        alert("Anda harus login untuk menghapus game.");
        return;
    }

    try {
        const gameRef = doc(db, 'games', currentUser.uid, 'myGames', id);
        await deleteDoc(gameRef);
        alert('Game berhasil dihapus!');
    } catch (error) {
        console.error("Error saat menghapus game:", error);
        alert("Gagal menghapus game. Silakan coba lagi.");
    }
}

// --- Paginasi ---

/**
 * Memperbarui kontrol paginasi.
 */
function updatePaginationControls() {
    paginationControls.innerHTML = '';
    const totalPages = Math.ceil(allGames.length / gamesPerPage);

    if (totalPages <= 1) return; // Tidak perlu paginasi jika hanya ada satu halaman atau kurang

    // Tombol Sebelumnya
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Sebelumnya';
    prevButton.className = `px-4 py-2 rounded-lg ${currentPage === 1 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`;
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayGames(allGames);
            updatePaginationControls();
        }
    };
    paginationControls.appendChild(prevButton);

    // Nomor Halaman
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-4 py-2 rounded-lg mx-1 ${currentPage === i ? 'bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`;
        pageButton.onclick = () => {
            currentPage = i;
            displayGames(allGames);
            updatePaginationControls();
        };
        paginationControls.appendChild(pageButton);
    }

    // Tombol Selanjutnya
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Selanjutnya';
    nextButton.className = `px-4 py-2 rounded-lg ${currentPage === totalPages ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`;
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayGames(allGames);
            updatePaginationControls();
        }
    };
    paginationControls.appendChild(nextButton);
}

// --- Statistik Game ---

/**
 * Memperbarui tampilan statistik game.
 */
function updateStatistics() {
    const totalGames = allGames.length;
    const notPlayed = allGames.filter(game => game.status === 'Belum dimainkan').length;
    const playing = allGames.filter(game => game.status === 'Dimainkan').length;
    const completed = allGames.filter(game => game.status === 'Tamat').length;
    const hdd2tb = allGames.filter(game => game.location === 'HDD Eksternal 2TB').length;
    const steamGames = allGames.filter(game => game.platform === 'Steam').length;

    statTotalGames.textContent = totalGames;
    statNotPlayed.textContent = notPlayed;
    statPlaying.textContent = playing;
    statCompleted.textContent = completed;
    statHdd2tb.textContent = hdd2tb;
    statSteam.textContent = steamGames;
}

// --- Aksi Massal ---

/**
 * Menerapkan perubahan status massal pada game yang dipilih (atau semua game jika tidak ada pilihan).
 */
async function applyBulkStatus() {
    if (!currentUser) {
        alert("Anda harus login untuk melakukan aksi massal.");
        return;
    }
    const newStatus = bulkActionStatus.value;
    if (!newStatus) {
        alert("Silakan pilih status baru.");
        return;
    }

    const confirmed = await showConfirmModal(`Apakah Anda yakin ingin mengubah status ${allGames.length} game menjadi "${newStatus}"?`);
    if (!confirmed) return;

    try {
        for (const game of allGames) {
            const gameRef = doc(db, 'games', currentUser.uid, 'myGames', game.id);
            await updateDoc(gameRef, { status: newStatus });
        }
        alert("Status game berhasil diperbarui secara massal!");
        bulkActionStatus.value = ""; // Reset dropdown
    } catch (error) {
        console.error("Error saat memperbarui status massal:", error);
        alert("Gagal memperbarui status game secara massal.");
    }
}

/**
 * Menerapkan perubahan platform massal pada game yang dipilih (atau semua game jika tidak ada pilihan).
 */
async function applyBulkPlatform() {
    if (!currentUser) {
        alert("Anda harus login untuk melakukan aksi massal.");
        return;
    }
    const newPlatform = bulkActionPlatform.value;
    if (!newPlatform) {
        alert("Silakan pilih platform baru.");
        return;
    }

    const confirmed = await showConfirmModal(`Apakah Anda yakin ingin mengubah platform ${allGames.length} game menjadi "${newPlatform}"?`);
    if (!confirmed) return;

    try {
        for (const game of allGames) {
            const gameRef = doc(db, 'games', currentUser.uid, 'myGames', game.id);
            await updateDoc(gameRef, { platform: newPlatform });
        }
        alert("Platform game berhasil diperbarui secara massal!");
        bulkActionPlatform.value = ""; // Reset dropdown
    } catch (error) {
        console.error("Error saat memperbarui platform massal:", error);
        alert("Gagal memperbarui platform game secara massal.");
    }
}

/**
 * Menghapus semua game dari koleksi pengguna.
 */
async function bulkDeleteGames() {
    if (!currentUser) {
        alert("Anda harus login untuk melakukan aksi massal.");
        return;
    }

    const confirmed = await showConfirmModal("Apakah Anda yakin ingin menghapus SEMUA game dalam koleksi Anda? Tindakan ini tidak dapat dibatalkan.");
    if (!confirmed) return;

    try {
        for (const game of allGames) {
            const gameRef = doc(db, 'games', currentUser.uid, 'myGames', game.id);
            await deleteDoc(gameRef);
        }
        alert("Semua game berhasil dihapus!");
    } catch (error) {
        console.error("Error saat menghapus game secara massal:", error);
        alert("Gagal menghapus semua game.");
    }
}

// --- Manajemen Data ---

/**
 * Mengunduh data game sebagai file JSON.
 */
function downloadJson() {
    if (!currentUser) {
        alert("Anda harus login untuk mengunduh data.");
        return;
    }
    if (allGames.length === 0) {
        alert("Tidak ada data game untuk diunduh.");
        return;
    }

    const dataStr = JSON.stringify(allGames, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koleksi_game_${currentUser.uid}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Data game berhasil diunduh!");
}

/**
 * Mengunggah data game dari file JSON.
 * Ini akan menimpa semua data game yang ada.
 */
async function uploadJson(event) {
    if (!currentUser) {
        alert("Anda harus login untuk mengunggah data.");
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const confirmed = await showConfirmModal("Mengunggah file JSON akan MENIMPA SEMUA data game Anda yang ada. Apakah Anda yakin ingin melanjutkan?");
    if (!confirmed) {
        event.target.value = ''; // Reset input file
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const uploadedGames = JSON.parse(e.target.result);
            if (!Array.isArray(uploadedGames)) {
                throw new Error("Format JSON tidak valid. Harap unggah array objek game.");
            }

            // Hapus semua game yang ada terlebih dahulu
            for (const game of allGames) {
                const gameRef = doc(db, 'games', currentUser.uid, 'myGames', game.id);
                await deleteDoc(gameRef);
            }

            // Tambahkan game dari file JSON
            for (const gameData of uploadedGames) {
                // Hapus ID jika ada, karena Firestore akan membuat ID baru
                const { id, ...dataToSave } = gameData;
                const gamesColRef = collection(db, 'games', currentUser.uid, 'myGames');
                await addDoc(gamesColRef, dataToSave);
            }
            alert("Data game berhasil dimuat dari JSON!");
            event.target.value = ''; // Reset input file
        } catch (error) {
            console.error("Error saat mengunggah JSON:", error);
            alert(`Gagal memuat data dari JSON: ${error.message}.`);
            event.target.value = ''; // Reset input file
        }
    };
    reader.readAsText(file);
}

// --- Event Listeners ---

// Navigasi Sidebar
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = e.currentTarget.id.replace('nav-', '') + '-page';
        showPage(pageId);
    });
});

// Tombol Tambah Game
addGameBtn.addEventListener('click', () => openGameModal());

// Submit Form Game
gameForm.addEventListener('submit', addOrUpdateGame);

// Tutup Modal
closeModalButtons.forEach(button => {
    button.addEventListener('click', closeGameModal);
});
window.addEventListener('click', (event) => {
    if (event.target === gameModal) {
        closeGameModal();
    }
    if (event.target === confirmModal) {
        confirmModal.style.display = 'none'; // Tutup modal konfirmasi jika klik di luar
    }
});

// Aksi Massal Event Listeners
applyBulkStatusBtn.addEventListener('click', applyBulkStatus);
applyBulkPlatformBtn.addEventListener('click', applyBulkPlatform);
bulkDeleteBtn.addEventListener('click', bulkDeleteGames);

// Manajemen Data Event Listeners
downloadJsonBtn.addEventListener('click', downloadJson);
uploadJsonInput.addEventListener('change', uploadJson);

// Inisialisasi: Tampilkan halaman dashboard saat pertama kali dimuat
document.addEventListener('DOMContentLoaded', () => {
    showPage('dashboard-page');
});

