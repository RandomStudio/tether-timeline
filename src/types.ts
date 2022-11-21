import { IpcRendererEvent } from "electron";

export interface TrackValues {
  track: string
  values: number[] | number[][]
}
export interface IElectronAPI {
  onPlayTimeline: (callback: (name: string) => void) => void
  selectVideoFile: () => Promise<string>,
  sendTimelineUpdate: (name: string, time: number, tracks: TrackValues[]) => void
  sendTimelineCompleted: (name: string) => void
  importJSON: () => Promise<string>
  exportJSON: (json: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: IElectronAPI,
  }
}
