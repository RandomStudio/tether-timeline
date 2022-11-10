import { IpcRendererEvent } from "electron";


export interface IElectronAPI {
  onPlayTimeline: (callback: (name: string) => void) => void
  selectVideoFile: () => Promise<string>,
  sendTimelineCompleted: (name: string) => void
  importJSON: () => Promise<string>
  exportJSON: (json: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: IElectronAPI,
  }
}
