function isTrustedIpcEvent(event, mainWindow, isTrustedNavigation) {
  const sender = event?.sender;
  const frame = event?.senderFrame;
  return Boolean(mainWindow
    && sender
    && sender === mainWindow.webContents
    && frame
    && frame === sender.mainFrame
    && typeof isTrustedNavigation === 'function'
    && isTrustedNavigation(frame.url));
}

function assertTrustedIpcEvent(event, mainWindow, isTrustedNavigation) {
  if (!isTrustedIpcEvent(event, mainWindow, isTrustedNavigation)) {
    throw new Error('Solicitação IPC inválida.');
  }
}

module.exports = { isTrustedIpcEvent, assertTrustedIpcEvent };
