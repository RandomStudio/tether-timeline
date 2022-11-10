export interface Point {
  x: number
  y: number
}

export type TrackType = "curve" | "video"

export interface Track {
  type: TrackType
  id: string
  name: string
}

export interface CurveTrack extends Track {
  type: "curve"
  curve: Point[]
}

export interface SampleLocation {
  name: string
  x: number
  y: number
  w: number
  h: number
  sx: number // horizontal spacing between samples, used when w > 1
  sy: number // vertical spacing between samples, used when h > 1
}

export interface VideoTrack extends Track {
  type: "video"
  video: {
    file: string | null
    loop: boolean
  }
  sampleLocations: SampleLocation[]
  currentValues: number[][] // each sample location can contain multiple pixels
}

export interface Timeline {
  id: string
  name: string
  duration: number
  loop: boolean
  tracks: Track[]
}

export interface TimelineState {
  timelines: Timeline[]
  selectedTimelineId: string
}
