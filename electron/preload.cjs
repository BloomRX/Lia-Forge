const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('liaForge', Object.freeze({
  isDesktop: true,
  readWorkspaceAssets: () => ipcRenderer.invoke('lia-forge:assets:read'),
  writeWorkspaceAssets: (assets) => ipcRenderer.invoke('lia-forge:assets:write', assets),
  openAssetStageFolder: (payload) => ipcRenderer.invoke('lia-forge:assets:manual:open-folder', payload),
  completeAssetStageManually: (payload) => ipcRenderer.invoke('lia-forge:assets:manual:complete-stage', payload),
  skipOptionalAssetStage: (payload) => ipcRenderer.invoke('lia-forge:assets:manual:skip-stage', payload),
  renderSpritesheetFromExistingModel: (payload) => ipcRenderer.invoke('lia-forge:assets:auto:render-spritesheet', payload),
  generateComfyUiConcept: (payload) => ipcRenderer.invoke('lia-forge:assets:auto:generate-concept', payload),
  getHumanoidWorkflowPlan: (payload) => ipcRenderer.invoke('lia-forge:workflow:humanoid:plan', payload),
  listWorkflowRuns: () => ipcRenderer.invoke('lia-forge:workflow:runs:list'),
  readWorkflowRun: (runId) => ipcRenderer.invoke('lia-forge:workflow:runs:read', runId),
  resumeBlenderWorkflowRun: (payload) => ipcRenderer.invoke('lia-forge:workflow:runs:resume-blender', payload),
  onWorkflowEvent: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('lia-forge:workflow:event', listener);
    return () => ipcRenderer.removeListener('lia-forge:workflow:event', listener);
  },
  getExternalToolStatus: () => ipcRenderer.invoke('lia-forge:tools:status'),
  openExternalTool: (payload) => ipcRenderer.invoke('lia-forge:tools:open', payload),
  chooseAndOpenExternalApplication: (payload) => ipcRenderer.invoke('lia-forge:tools:choose-and-open', payload),
  openComfyUiInterface: (payload) => ipcRenderer.invoke('lia-forge:tools:open-comfyui', payload),
  getComfyUiStatus: () => ipcRenderer.invoke('lia-forge:comfyui:status'),
  listComfyUiWorkflows: () => ipcRenderer.invoke('lia-forge:comfyui:workflows:list'),
  readComfyUiWorkflow: (workflowId) => ipcRenderer.invoke('lia-forge:comfyui:workflows:read', workflowId),
  getManagedProcesses: () => ipcRenderer.invoke('lia-forge:processes:list'),
  // Studio (F8): mesmos métodos da API HTTP do Vite, via IPC no desktop.
  studio: Object.freeze({
    overview: () => ipcRenderer.invoke('lia-forge:studio:overview'),
    workflows: () => ipcRenderer.invoke('lia-forge:studio:workflows'),
    preflight: (capabilityIds = null) => ipcRenderer.invoke('lia-forge:studio:preflight', { capabilityIds }),
    providers: () => ipcRenderer.invoke('lia-forge:studio:providers'),
    configureProvider: (payload) => ipcRenderer.invoke('lia-forge:studio:providers:configure', payload),
    plan: (payload) => ipcRenderer.invoke('lia-forge:studio:plan', payload),
    run: (payload) => ipcRenderer.invoke('lia-forge:studio:run', payload),
    runs: () => ipcRenderer.invoke('lia-forge:studio:runs:list'),
    readRun: (runId) => ipcRenderer.invoke('lia-forge:studio:runs:read', runId),
    reviewStep: (payload) => ipcRenderer.invoke('lia-forge:studio:runs:review', payload),
    exportRun: (payload) => ipcRenderer.invoke('lia-forge:studio:runs:export', payload),
    vfxPreview: (payload) => ipcRenderer.invoke('lia-forge:studio:vfx-preview', payload),
    listAssets: () => ipcRenderer.invoke('lia-forge:studio:assets:list'),
    upsertAsset: (record) => ipcRenderer.invoke('lia-forge:studio:assets:upsert', record),
    rightsReport: () => ipcRenderer.invoke('lia-forge:studio:rights'),
    readArtifact: (relativePath) => ipcRenderer.invoke('lia-forge:studio:artifact', relativePath),
    declareAssetRights: (payload) => ipcRenderer.invoke('lia-forge:studio:assets:rights', payload),
    attachRunToAsset: (payload) => ipcRenderer.invoke('lia-forge:studio:assets:attach-run', payload),
  }),
  reportActivities: (activities) => ipcRenderer.send('lia-forge:activities:report', activities),
}));
