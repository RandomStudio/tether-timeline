export interface Point {
  x: number
  y: number
}

export interface AnchorPoint {
	id: string
  anchor: Point
  control_1: Point
  control_2: Point
}

export interface EventTrigger {
	id: string
	position: number
	data: string
}

export interface RGBFloat {
	r: number
	g: number
	b: number
	a: number
}

export interface ColorStop {
	position: number
	color: RGBFloat
}

export enum TrackMode {
	Curve = "Curve",
	Event = "Event",
	Color = "Color",
}

export interface Track {
  name: string
	mode: TrackMode
	curve: AnchorPoint[] | null
	events: EventTrigger[] | null
	colors: ColorStop[] | null
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
	events?: Array<string>,
	// color at snapshot poisition, if any
	color?: RGBFloat,
}

export interface TimelineSnapshot {
	// timeline name
	name: string,
	// time at snapshot
	time: number,
	// normalized playhead position at snapshot
	position: number,
	// whether or not the timeline is currently playing
	isPlaying: boolean,
	// track snapshots at snapshot time
	tracks: Array<TrackSnapshot>,
}
