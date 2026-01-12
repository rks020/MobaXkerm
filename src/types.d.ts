export interface IpcRenderer {
    on(channel: string, func: (...args: any[]) => void): void;
    off(channel: string, func: (...args: any[]) => void): void;
    send(channel: string, ...args: any[]): void;
    invoke(channel: string, ...args: any[]): Promise<any>;
    removeAllListeners(channel: string): void;
}

declare global {
    interface Window {
        ipcRenderer: IpcRenderer;
    }
}
