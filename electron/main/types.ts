import { logger } from "@randomstudio/tether"

export interface ConfigOptions {
  loglevel: logger.LogLevelDesc
  ioFilePath: string
  tether: {
    host: string
    port: number
    username?: string
    password?: string
    subscription: string
    agentID?: string
  }
}

export interface TrackValues {
  track: string
  values: number[] | number[][]
}
