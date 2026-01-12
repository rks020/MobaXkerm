import { useState, useRef, useEffect } from 'react';
import { FolderPlus, X } from 'lucide-react';

interface FolderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, parentId?: string) => void;
    initialParentId?: string;
}

export function FolderModal({ isOpen, onClose, onCreate, initialParentId }: FolderModalProps) {
    const [folderName, setFolderName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setFolderName('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (folderName.trim()) {
            onCreate(folderName.trim(), initialParentId);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-[#18181b] w-full max-w-sm rounded-xl border border-white/10 shadow-2xl p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                            <FolderPlus size={20} className="text-yellow-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Create New Folder</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Folder Name</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={folderName}
                        onChange={e => setFolderName(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors mb-6"
                        placeholder="e.g. Production Servers"
                    />

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!folderName.trim()}
                            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-black bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Create Folder
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
