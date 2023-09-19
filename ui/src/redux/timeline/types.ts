export interface Point {
  x: number
  y: number
}

export interface AnchorPoint {
  anchor: Point
  control_1: Point
  control_2: Point
}

export interface EventTrigger {
	position: number
	data: string
}

export interface Track {
  name: string
	curve: AnchorPoint[]
	events: Array<EventTrigger>
}

export interface Timeline {
  name: string
  duration: number
	fps: number,
  loopPlayback: boolean
  tracks: Track[],
	position: number,
	isPlaying: boolean,
}

export interface TimelineState {
  timelines: Timeline[]
  selectedTimeline: string | null
}

export interface EventSnapshot {
	// timeline name
	timeline: string,
	// track name
	track: string,
	// event data
	event: string,
}

export interface TrackSnapshot {
	// track name
	name: string,
	// curve value at snapshot position, if any
	value?: number,
	// events at snapshot position, if any
	events: Array<string>,
}

export interface TimelineSnapshot {
	// timeline name
	name: String,
	// time at snapshot
	time: number,
	// normalized playhead position at snapshot
	position: number,
	// whether or not the timeline is currently playing
	isPlaying: boolean,
	// track snapshots at snapshot time
	tracks: Array<TrackSnapshot>,
}
