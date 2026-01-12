export interface SavedSession {
    id: string;
    name: string;
    parentId?: string | null;
    type: 'folder' | 'ssh' | 'local';
    config?: any;
    expanded?: boolean; // For UI toggle state
    children?: SavedSession[]; // For tree structure
}

const STORAGE_KEY = 'mobaxkerm_sessions';

export const sessionStore = {
    getSessions: (): SavedSession[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load sessions', e);
            return [];
        }
    },

    saveSessions: (sessions: SavedSession[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        } catch (e) {
            console.error('Failed to save sessions', e);
        }
    },

    addSession: (session: SavedSession) => {
        const sessions = sessionStore.getSessions();
        sessions.push(session);
        sessionStore.saveSessions(sessions);
    },

    renameSession: (sessionId: string, newName: string) => {
        const sessions = sessionStore.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            session.name = newName;
            sessionStore.saveSessions(sessions);
        }
    },

    moveSession: (sessionId: string, newParentId: string | null) => {
        const sessions = sessionStore.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            session.parentId = newParentId;
            sessionStore.saveSessions(sessions);
        }
    },

    // Helper to build tree from flat list (if we stored flat) 
    // But we will store flat list with parentId for simplicity in management, 
    // and build tree for display.
    buildTree: (sessions: SavedSession[]): SavedSession[] => {
        const map = new Map<string, SavedSession>();
        const roots: SavedSession[] = [];

        // First pass: create copies and map them
        sessions.forEach(s => {
            map.set(s.id, { ...s, children: [] });
        });

        // Second pass: link children
        sessions.forEach(s => {
            const node = map.get(s.id)!;
            if (s.parentId && map.has(s.parentId)) {
                map.get(s.parentId)!.children!.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }
};
