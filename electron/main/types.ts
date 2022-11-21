import { IClientOptions, logger } from "@randomstudio/tether"

interface TetherConfig extends IClientOptions {
  startPlaybackTopic: string
  stopPlaybackTopic: string
  agentID?: string
}
export interface ConfigOptions {
  loglevel: logger.LogLevelDesc
  ioFilePath: string
  tether: TetherConfig
}

interface Color {
  r: number
  g: number
  b: number
}

export interface TrackValue {
  track: string
  value?: number
  colors?: Color[][]
}
