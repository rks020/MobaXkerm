"use strict";
const electron = require("electron");
const listeners = /* @__PURE__ */ new Map();
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel, listener) {
    if (!listeners.has(channel)) {
      listeners.set(channel, /* @__PURE__ */ new Map());
    }
    const channelMap = listeners.get(channel);
    if (!channelMap.has(listener)) {
      const subscription = (event, ...args) => listener(event, ...args);
      channelMap.set(listener, subscription);
      electron.ipcRenderer.on(channel, subscription);
    }
    return this;
  },
  off(channel, listener) {
    const channelMap = listeners.get(channel);
    if (channelMap && channelMap.has(listener)) {
      const subscription = channelMap.get(listener);
      electron.ipcRenderer.removeListener(channel, subscription);
      channelMap.delete(listener);
    }
    return this;
  },
  removeAllListeners(channel) {
    const channelMap = listeners.get(channel);
    if (channelMap) {
      channelMap.forEach((subscription) => {
        electron.ipcRenderer.removeListener(channel, subscription);
      });
      channelMap.clear();
      listeners.delete(channel);
    }
    return this;
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
