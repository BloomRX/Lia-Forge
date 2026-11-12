const assert = require('node:assert/strict');
const { assertTrustedIpcEvent, isTrustedIpcEvent } = require('../electron/ipc-guard.cjs');

const mainFrame = { url: 'file:///app/dist/index.html' };
const sender = { mainFrame };
const mainWindow = { webContents: sender };
const isTrustedNavigation = (url) => url === mainFrame.url;

assert.equal(isTrustedIpcEvent({ sender, senderFrame: mainFrame }, mainWindow, isTrustedNavigation), true);
assert.doesNotThrow(() => assertTrustedIpcEvent({ sender, senderFrame: mainFrame }, mainWindow, isTrustedNavigation));
assert.equal(isTrustedIpcEvent({ sender, senderFrame: { url: mainFrame.url } }, mainWindow, isTrustedNavigation), false, 'A same-origin subframe is not the privileged main frame.');
assert.equal(isTrustedIpcEvent({ sender, senderFrame: { url: 'https://untrusted.example/' } }, mainWindow, isTrustedNavigation), false, 'An untrusted frame cannot use privileged IPC.');
assert.equal(isTrustedIpcEvent({ sender, senderFrame: mainFrame }, { webContents: {} }, isTrustedNavigation), false, 'A different window cannot use privileged IPC.');
assert.equal(isTrustedIpcEvent({ sender }, mainWindow, isTrustedNavigation), false, 'Missing sender-frame metadata fails closed.');
assert.throws(() => assertTrustedIpcEvent({ sender }, mainWindow, isTrustedNavigation), /IPC inválida/);

console.log('IPC guard smoke test passed.');
