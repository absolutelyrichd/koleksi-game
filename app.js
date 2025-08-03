import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, writeBatch, onSnapshot, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Edit, Download, Upload, LogOut, Filter, X } from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
// Gunakan konfigurasi yang diberikan oleh pengguna
const firebaseConfig = {
    apiKey: "AIzaSyAzJTL179V9bT-DfefZq9gcG8Tz88VzLmQ",
    authDomain: "koleksi-game.firebaseapp.com",
    projectId: "koleksi-game",
    storageBucket: "koleksi-game.appspot.com",
    messagingSenderId: "222959670551",
    appId: "1:222959670551:web:048b1e2c4ef16b7bd31352",
    measurementId: "G-BYYCM7R4M8"
};

// --- INISIALISASI FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DATA KONSTAN ---
const PLATFORMS = ["Steam", "Epic Games", "GOG", "PCSX", "Lainnya"];
const LOCATIONS = ["Internal SSD", "HDD Eksternal 2TB", "HDD Eksternal 4TB", "Cloud"];
const STATUSES = ["Dimainkan", "Belum Dimainkan", "Selesai", "Ditinggalkan"];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

// --- KOMPONEN UTAMA: App ---
export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error saat login:", error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error saat logout:", error);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Memuat...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
            {user ? (
                <GameDashboard user={user} onLogout={handleLogout} />
            ) : (
                <LoginScreen onLogin={handleLogin} />
            )}
        </div>
    );
}

// --- KOMPONEN: LoginScreen ---
const LoginScreen = ({ onLogin }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
        <div className="text-center p-8 bg-gray-800 rounded-2xl shadow-2xl">
            <h1 className="text-4xl font-bold text-white mb-2">Dasbor Koleksi Game</h1>
            <p className="text-gray-400 mb-8">Kelola dan lacak semua game favorit Anda di satu tempat.</p>
            <button
                onClick={onLogin}
                className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-transform transform hover:scale-105 duration-300"
            >
                <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.804 9.81C34.553 5.822 29.588 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.843-5.368C34.553 5.822 29.588 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
                    <path fill="#1976D2" d="M43.611 20.083H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.238 44 30.025 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
                </svg>
                Masuk dengan Google
            </button>
        </div>
    </div>
);

// --- KOMPONEN: GameDashboard ---
const GameDashboard = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('Daftar Game');
    const [games, setGames] = useState([]);
    const [loadingGames, setLoadingGames] = useState(true);
    const gamesCollectionRef = useMemo(() => collection(db, 'users', user.uid, 'games'), [user.uid]);

    useEffect(() => {
        setLoadingGames(true);
        const unsubscribe = onSnapshot(gamesCollectionRef, (snapshot) => {
            const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGames(gamesData);
            setLoadingGames(false);
        }, (error) => {
            console.error("Error fetching games:", error);
            setLoadingGames(false);
        });

        return () => unsubscribe();
    }, [gamesCollectionRef]);

    const addGame = async (game) => {
        try {
            await addDoc(gamesCollectionRef, game);
        } catch (error) {
            console.error("Error adding game: ", error);
        }
    };
    
    const updateGame = async (id, updatedGame) => {
        const gameDoc = doc(db, 'users', user.uid, 'games', id);
        try {
            await updateDoc(gameDoc, updatedGame);
        } catch (error) {
            console.error("Error updating game: ", error);
        }
    };

    const deleteGame = async (id) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus game ini?")) {
            const gameDoc = doc(db, 'users', user.uid, 'games', id);
            try {
                await deleteDoc(gameDoc);
            } catch (error) {
                console.error("Error deleting game: ", error);
            }
        }
    };
    
    const tabs = ['Daftar Game', 'Statistik', 'Aksi Masal', 'Manajemen Data'];

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="flex flex-col sm:flex-row justify-between items-center mb-8">
                <div className="flex items-center mb-4 sm:mb-0">
                    <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-full mr-4 border-2 border-indigo-500"/>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{user.displayName}'s</h1>
                        <h2 className="text-xl font-semibold text-gray-300">Koleksi Game</h2>
                    </div>
                </div>
                <button onClick={onLogout} className="flex items-center px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors duration-300">
                    <LogOut size={18} className="mr-2"/>
                    Logout
                </button>
            </header>

            <nav className="mb-8">
                <div className="flex space-x-2 sm:space-x-4 border-b border-gray-700">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 sm:px-4 py-3 font-semibold text-sm sm:text-base transition-colors duration-300 ${
                                activeTab === tab
                                    ? 'border-b-2 border-indigo-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg min-h-[60vh]">
                {loadingGames ? (
                    <div className="flex justify-center items-center h-full">Memuat data game...</div>
                ) : (
                    <>
                        {activeTab === 'Daftar Game' && <GameList games={games} onAddGame={addGame} onUpdateGame={updateGame} onDeleteGame={deleteGame} />}
                        {activeTab === 'Statistik' && <Statistics games={games} />}
                        {activeTab === 'Aksi Masal' && <BulkActions games={games} userId={user.uid} />}
                        {activeTab === 'Manajemen Data' && <DataManagement games={games} userId={user.uid} />}
                    </>
                )}
            </main>
        </div>
    );
};

// --- KOMPONEN: GameList ---
const GameList = ({ games, onAddGame, onUpdateGame, onDeleteGame }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingGame, setEditingGame] = useState(null);

    const handleAddClick = () => {
        setEditingGame(null);
        setShowModal(true);
    };

    const handleEditClick = (game) => {
        setEditingGame(game);
        setShowModal(true);
    };

    const handleSave = (game) => {
        if (editingGame) {
            onUpdateGame(editingGame.id, game);
        } else {
            onAddGame(game);
        }
        setShowModal(false);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Daftar Game ({games.length})</h3>
                <button onClick={handleAddClick} className="flex items-center px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105">
                    <Plus size={20} className="mr-2"/>
                    Tambah Game
                </button>
            </div>
            {games.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-gray-400">Koleksi game Anda masih kosong.</p>
                    <p className="text-gray-500">Klik "Tambah Game" untuk memulai.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-gray-600 text-gray-400">
                            <tr>
                                <th className="p-4">Nama Game</th>
                                <th className="p-4">Platform</th>
                                <th className="p-4">Lokasi</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {games.map(game => (
                                <tr key={game.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="p-4 font-semibold text-white">{game.name}</td>
                                    <td className="p-4">{game.platform}</td>
                                    <td className="p-4">{game.location}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                            game.status === 'Dimainkan' ? 'bg-blue-500/30 text-blue-300' :
                                            game.status === 'Belum Dimainkan' ? 'bg-yellow-500/30 text-yellow-300' :
                                            game.status === 'Selesai' ? 'bg-green-500/30 text-green-300' :
                                            'bg-red-500/30 text-red-300'
                                        }`}>
                                            {game.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleEditClick(game)} className="p-2 text-gray-400 hover:text-white"><Edit size={18}/></button>
                                        <button onClick={() => onDeleteGame(game.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {showModal && <GameModal game={editingGame} onSave={handleSave} onClose={() => setShowModal(false)} />}
        </div>
    );
};

// --- KOMPONEN: GameModal (untuk Tambah/Edit) ---
const GameModal = ({ game, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: game?.name || '',
        platform: game?.platform || PLATFORMS[0],
        location: game?.location || LOCATIONS[0],
        status: game?.status || STATUSES[0],
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name) {
            alert("Nama game tidak boleh kosong!");
            return;
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-6 text-white">{game ? 'Edit Game' : 'Tambah Game Baru'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="name">Nama Game</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="platform">Platform</label>
                        <select id="platform" name="platform" value={formData.platform} onChange={handleChange} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="location">Lokasi</label>
                        <select id="location" name="location" value={formData.location} onChange={handleChange} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2" htmlFor="status">Status</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">{game ? 'Simpan Perubahan' : 'Tambah'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- KOMPONEN: Statistics ---
const Statistics = ({ games }) => {
    const platformData = useMemo(() => {
        const counts = games.reduce((acc, game) => {
            acc[game.platform] = (acc[game.platform] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [games]);

    const locationData = useMemo(() => {
        const counts = games.reduce((acc, game) => {
            acc[game.location] = (acc[game.location] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [games]);
    
    const statusData = useMemo(() => {
        const counts = games.reduce((acc, game) => {
            acc[game.status] = (acc[game.status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [games]);

    if (games.length === 0) {
        return <div className="text-center py-16 text-gray-400">Tidak ada data untuk ditampilkan. Tambahkan beberapa game terlebih dahulu.</div>;
    }

    return (
        <div>
            <h3 className="text-2xl font-bold text-white mb-8">Statistik Koleksi</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-900/50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-white mb-4">Game per Platform</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                {platformData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }}/>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-white mb-4">Game per Status</h4>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#82ca9d" paddingAngle={5} label>
                               {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }}/>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg lg:col-span-2">
                    <h4 className="text-lg font-semibold text-white mb-4">Game per Lokasi Penyimpanan</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={locationData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                            <XAxis dataKey="name" stroke="#A0AEC0" />
                            <YAxis stroke="#A0AEC0" />
                            <Tooltip cursor={{fill: 'rgba(100,116,139,0.2)'}} contentStyle={{ backgroundColor: '#333', border: 'none' }}/>
                            <Legend />
                            <Bar dataKey="value" fill="#8884d8" name="Jumlah Game" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// --- KOMPONEN: BulkActions ---
const BulkActions = ({ games, userId }) => {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [filters, setFilters] = useState({ platform: '', location: '', status: '' });
    const [showEditModal, setShowEditModal] = useState(false);

    const filteredGames = useMemo(() => {
        return games.filter(game => {
            return (filters.platform ? game.platform === filters.platform : true) &&
                   (filters.location ? game.location === filters.location : true) &&
                   (filters.status ? game.status === filters.status : true);
        });
    }, [games, filters]);

    const handleSelect = (id) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredGames.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredGames.map(g => g.id)));
        }
    };

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const clearFilters = () => {
        setFilters({ platform: '', location: '', status: '' });
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            alert("Pilih setidaknya satu game untuk dihapus.");
            return;
        }
        if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.size} game yang dipilih?`)) {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                const gameDoc = doc(db, 'users', userId, 'games', id);
                batch.delete(gameDoc);
            });
            try {
                await batch.commit();
                setSelectedIds(new Set());
                alert("Game yang dipilih berhasil dihapus.");
            } catch (error) {
                console.error("Error deleting games in bulk: ", error);
                alert("Gagal menghapus game.");
            }
        }
    };
    
    const handleUpdateSelected = async (updateData) => {
        if (selectedIds.size === 0) {
            setShowEditModal(false);
            return;
        }
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            const gameDoc = doc(db, 'users', userId, 'games', id);
            batch.update(gameDoc, updateData);
        });
        try {
            await batch.commit();
            setSelectedIds(new Set());
            setShowEditModal(false);
            alert("Game yang dipilih berhasil diperbarui.");
        } catch (error) {
            console.error("Error updating games in bulk: ", error);
            alert("Gagal memperbarui game.");
        }
    };

    return (
        <div>
            <h3 className="text-2xl font-bold text-white mb-4">Aksi Masal</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm text-gray-400">Filter Platform</label>
                        <select name="platform" value={filters.platform} onChange={handleFilterChange} className="w-full mt-1 p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Semua</option>
                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">Filter Lokasi</label>
                        <select name="location" value={filters.location} onChange={handleFilterChange} className="w-full mt-1 p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Semua</option>
                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">Filter Status</label>
                        <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full mt-1 p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Semua</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <button onClick={clearFilters} className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors duration-300">
                        <Filter size={16} className="mr-2"/>
                        Hapus Filter
                    </button>
                </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
                <div className="text-gray-300">{selectedIds.size} item dipilih</div>
                <div>
                     <button onClick={() => setShowEditModal(true)} disabled={selectedIds.size === 0} className="mr-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-300">
                        Edit
                    </button>
                    <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-300">
                        Hapus
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b border-gray-600 text-gray-400">
                        <tr>
                            <th className="p-4 w-12"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size === filteredGames.length && filteredGames.length > 0} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-indigo-600 focus:ring-indigo-500" /></th>
                            <th className="p-4">Nama Game</th>
                            <th className="p-4">Platform</th>
                            <th className="p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredGames.map(game => (
                            <tr key={game.id} className={`border-b border-gray-700 ${selectedIds.has(game.id) ? 'bg-indigo-900/30' : 'hover:bg-gray-700/50'}`}>
                                <td className="p-4"><input type="checkbox" onChange={() => handleSelect(game.id)} checked={selectedIds.has(game.id)} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-indigo-600 focus:ring-indigo-500" /></td>
                                <td className="p-4 font-semibold text-white">{game.name}</td>
                                <td className="p-4">{game.platform}</td>
                                <td className="p-4">{game.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredGames.length === 0 && <div className="text-center py-16 text-gray-400">Tidak ada game yang cocok dengan filter Anda.</div>}
            </div>
            {showEditModal && <BulkEditModal onSave={handleUpdateSelected} onClose={() => setShowEditModal(false)} />}
        </div>
    );
};

// --- KOMPONEN: BulkEditModal ---
const BulkEditModal = ({ onSave, onClose }) => {
    const [updateData, setUpdateData] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (value) {
            setUpdateData(prev => ({ ...prev, [name]: value }));
        } else {
            const { [name]: _, ...rest } = updateData;
            setUpdateData(rest);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (Object.keys(updateData).length === 0) {
            alert("Pilih setidaknya satu properti untuk diubah.");
            return;
        }
        onSave(updateData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-6 text-white">Edit Game Terpilih</h2>
                <p className="text-gray-400 mb-6">Hanya field yang diisi yang akan diperbarui. Biarkan kosong untuk tidak mengubah.</p>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="platform">Platform Baru</label>
                        <select name="platform" onChange={handleChange} defaultValue="" className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">-- Jangan Ubah --</option>
                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="location">Lokasi Baru</label>
                        <select name="location" onChange={handleChange} defaultValue="" className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">-- Jangan Ubah --</option>
                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2" htmlFor="status">Status Baru</label>
                        <select name="status" onChange={handleChange} defaultValue="" className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">-- Jangan Ubah --</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Terapkan Perubahan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- KOMPONEN: DataManagement ---
const DataManagement = ({ games, userId }) => {
    const handleDownload = () => {
        const dataStr = JSON.stringify(games.map(({id, ...rest}) => rest), null, 2); // Hapus ID saat download
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', 'koleksi_game.json');
        linkElement.click();
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedGames = JSON.parse(e.target.result);
                if (!Array.isArray(importedGames)) {
                    throw new Error("Format JSON tidak valid. Harus berupa array of objects.");
                }
                
                // Validasi sederhana
                const isValid = importedGames.every(g => g.name && g.platform && g.location && g.status);
                if (!isValid) {
                    throw new Error("Beberapa objek game dalam file JSON tidak memiliki properti yang diperlukan (name, platform, location, status).");
                }

                if (window.confirm(`Anda akan mengimpor ${importedGames.length} game. Ini akan MENGHAPUS semua data game yang ada saat ini. Lanjutkan?`)) {
                    // Hapus data lama
                    const existingGamesSnapshot = await getDocs(collection(db, 'users', userId, 'games'));
                    const deleteBatch = writeBatch(db);
                    existingGamesSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
                    await deleteBatch.commit();
                    
                    // Tambah data baru
                    const addBatch = writeBatch(db);
                    importedGames.forEach(game => {
                        const newGameRef = doc(collection(db, 'users', userId, 'games'));
                        addBatch.set(newGameRef, game);
                    });
                    await addBatch.commit();

                    alert("Data berhasil diimpor!");
                }
            } catch (error) {
                console.error("Error parsing or uploading JSON: ", error);
                alert(`Gagal memuat file JSON: ${error.message}`);
            } finally {
                 // Reset input file agar bisa upload file yang sama lagi
                event.target.value = null;
            }
        };
        reader.readAsText(file);
    };

    return (
        <div>
            <h3 className="text-2xl font-bold text-white mb-6">Manajemen Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-900/50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center"><Download size={20} className="mr-3 text-green-400"/>Unduh Data</h4>
                    <p className="text-gray-400 mb-4">Simpan seluruh koleksi game Anda sebagai file JSON. Berguna untuk backup.</p>
                    <button onClick={handleDownload} className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors duration-300">
                        Unduh JSON
                    </button>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center"><Upload size={20} className="mr-3 text-blue-400"/>Muat Data</h4>
                    <p className="text-gray-400 mb-4">Muat koleksi game dari file JSON. <strong className="text-red-400">Perhatian:</strong> Ini akan menimpa data Anda saat ini.</p>
                    <input type="file" id="json-upload" accept=".json" onChange={handleFileUpload} className="hidden"/>
                    <label htmlFor="json-upload" className="w-full cursor-pointer flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors duration-300">
                        Pilih File JSON untuk Dimuat
                    </label>
                </div>
            </div>
        </div>
    );
};
