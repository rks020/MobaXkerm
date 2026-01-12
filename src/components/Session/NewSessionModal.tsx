import { useState, useEffect } from 'react';
import { X, Server, Terminal, ArrowRight, Shield, Save, Folder } from 'lucide-react';
import { sessionStore, SavedSession } from '../../lib/sessionStore';

interface SessionConfig {
    name: string;
    host: string;
    username: string;
    port: number;
    password?: string;
    type: 'ssh' | 'local';
    parentId?: string;
}

interface NewSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (config: SessionConfig) => void;
    onSave?: () => void; // Callback to refresh parent list
    initialParentId?: string;
    initialData?: SavedSession;
}

export function NewSessionModal({ isOpen, onClose, onConnect, onSave, initialParentId, initialData }: NewSessionModalProps) {
    const [activeTab, setActiveTab] = useState<'ssh' | 'local'>('ssh');
    const [host, setHost] = useState('');
    const [username, setUsername] = useState('root');
    const [port, setPort] = useState(22);
    const [password, setPassword] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [parentId, setParentId] = useState<string>('');
    const [folders, setFolders] = useState<SavedSession[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Load folders for dropdown
            const sessions = sessionStore.getSessions();
            setFolders(sessions.filter(s => s.type === 'folder'));

            if (initialData) {
                // Edit Mode
                setActiveTab(initialData.type as 'ssh' | 'local');
                setSessionName(initialData.name);
                setParentId(initialData.parentId || '');

                if (initialData.config) {
                    setHost(initialData.config.host || '');
                    setUsername(initialData.config.username || 'root');
                    setPort(initialData.config.port || 22);
                    setPassword(initialData.config.password || '');
                }
            } else {
                // New Session Mode
                setSessionName('');
                setHost('');
                setUsername('root');
                setPort(22);
                setPassword('');
                // Set initial parent if provided
                if (initialParentId) {
                    setParentId(initialParentId);
                } else {
                    setParentId('');
                }
            }
        }
    }, [isOpen, initialParentId, initialData]);

    if (!isOpen) return null;

    const getConfig = (): SessionConfig => ({
        name: sessionName || (activeTab === 'local' ? 'Local Terminal' : host || 'New Connection'),
        host,
        username,
        port,
        password,
        type: activeTab,
        parentId: parentId || undefined
    });

    const handleConnect = () => {
        onConnect(getConfig());
        onClose();
    };

    const handleSave = () => {
        const config = getConfig();

        if (initialData) {
            // Update existing
            const updated: SavedSession = {
                ...initialData,
                name: config.name,
                type: config.type,
                parentId: config.parentId || null,
                config: {
                    host: config.host,
                    username: config.username,
                    port: config.port,
                    password: config.password
                }
            };
            sessionStore.updateSession(updated);
        } else {
            // Create new
            const newSession: SavedSession = {
                id: crypto.randomUUID(),
                name: config.name,
                type: config.type,
                parentId: config.parentId || null,
                config: {
                    host: config.host,
                    username: config.username,
                    port: config.port,
                    password: config.password
                }
            };
            sessionStore.addSession(newSession);
        }

        if (onSave) onSave();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#18181b] w-full max-w-md rounded-2xl shadow-2xl shadow-black/50 border border-white/10 overflow-hidden relative">

                {/* Header */}
                <div className="relative px-6 pt-6 pb-2 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-lg font-semibold text-white tracking-tight">{initialData ? 'Edit Session' : 'New Session'}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Configure your connection details</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 py-4 flex gap-2 border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('ssh')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'ssh'
                            ? 'bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/10'
                            : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}
                    >
                        <Server size={16} /> SSH
                    </button>
                    <button
                        onClick={() => setActiveTab('local')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'local'
                            ? 'bg-emerald-600/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/10'
                            : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}
                    >
                        <Terminal size={16} /> Local
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 relative space-y-4">

                    {/* Common: Name & Folder */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Session Name</label>
                            <input
                                type="text"
                                value={sessionName}
                                onChange={e => setSessionName(e.target.value)}
                                placeholder="My Server"
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Folder</label>
                            <div className="relative">
                                <select
                                    value={parentId}
                                    onChange={e => setParentId(e.target.value)}
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                                >
                                    <option value="">(Root)</option>
                                    {folders.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                                <Folder size={14} className="absolute right-3 top-2.5 text-gray-600 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {activeTab === 'ssh' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Remote Host</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={host}
                                        onChange={e => setHost(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-gray-700"
                                        placeholder="ip address or hostname"
                                        autoFocus
                                    />
                                    <div className="absolute right-3 top-3.5 text-gray-600 group-hover:text-gray-500 transition-colors pointer-events-none">
                                        <Server size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3">
                                    <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Username</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                        placeholder="root"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Port</label>
                                    <input
                                        type="number"
                                        value={port}
                                        onChange={e => setPort(Number(e.target.value))}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-center"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Password <span className="text-gray-600 lowercase font-normal">(optional)</span></label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                        placeholder="••••••••"
                                    />
                                    <div className="absolute right-3 top-3.5 text-gray-600 pointer-events-none">
                                        <Shield size={14} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-emerald-500/20">
                                <Terminal size={32} className="text-emerald-400" />
                            </div>
                            <h3 className="text-white font-medium mb-1">Local Terminal</h3>
                            <p className="text-sm text-gray-500 max-w-[200px]">Launch a standard shell based on your system defaults.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 mt-2 flex gap-3">
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={16} /> Save
                    </button>
                    <button
                        onClick={handleConnect}
                        className={`flex-[2] py-3.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2 group ${activeTab === 'ssh'
                            ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                            }`}>
                        {activeTab === 'ssh' ? 'Connect' : 'Launch'}
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
