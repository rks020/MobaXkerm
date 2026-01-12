import { useState, useRef, useEffect } from 'react';
import { Edit, X } from 'lucide-react';

interface RenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRename: (newName: string) => void;
    currentName: string;
}

export function RenameModal({ isOpen, onClose, onRename, currentName }: RenameModalProps) {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(currentName);
            setTimeout(() => inputRef.current?.select(), 100);
        }
    }, [isOpen, currentName]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && name.trim() !== currentName) {
            onRename(name.trim());
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
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Edit size={20} className="text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Rename Session</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Session Name</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors mb-6"
                        placeholder="Enter new name"
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
                            disabled={!name.trim() || name.trim() === currentName}
                            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-black bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Rename
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
