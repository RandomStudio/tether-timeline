import { IpcRendererEvent } from "electron";

interface TrackValue {
  track: string
  value?: number
  colors?: number[][]
}

export interface IElectronAPI {
  onStartPlayback: (callback: (name: string) => void) => void
  onStopPlayback: (callback: () => void) => void
  selectVideoFile: () => Promise<string>,
  sendTimelineStarted: (name: string) => void
  sendTimelineUpdate: (name: string, time: number, tracks: TrackValue[]) => void
  sendTimelineCompleted: (name: string) => void
  importJSON: () => Promise<string>
  exportJSON: (json: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: IElectronAPI,
  }
}
