import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------

const listeners = new Map<string, Map<any, any>>();

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: any) {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Map());
    }
    const channelMap = listeners.get(channel)!;

    // Avoid double-wrapping
    if (!channelMap.has(listener)) {
      const subscription = (event: any, ...args: any[]) => listener(event, ...args);
      channelMap.set(listener, subscription);
      ipcRenderer.on(channel, subscription);
    }
    return this;
  },
  off(channel: string, listener: any) {
    const channelMap = listeners.get(channel);
    if (channelMap && channelMap.has(listener)) {
      const subscription = channelMap.get(listener);
      ipcRenderer.removeListener(channel, subscription);
      channelMap.delete(listener);
    }
    return this;
  },
  removeAllListeners(channel: string) {
    // Must remove all listeners we tracked for this channel
    const channelMap = listeners.get(channel);
    if (channelMap) {
      channelMap.forEach((subscription) => {
        ipcRenderer.removeListener(channel, subscription);
      });
      channelMap.clear();
      listeners.delete(channel);
    }
    return this;
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})
