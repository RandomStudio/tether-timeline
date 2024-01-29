import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { AnchorPoint, EventTrigger, Timeline, TimelineSnapshot, TimelineState, Track, TrackMode } from './types';

import type { PayloadAction } from "@reduxjs/toolkit"
interface AddTimelinePayload {
	name: string
	duration: number
	fps: number
	loopPlayback: boolean
}

interface RenameTimelinePayload {
  oldName: string
  newName: string
}

interface UpdateTimelinePayload {
  name: string
  duration: number
	fps: number
  loopPlayback: boolean
}

interface AddTrackPayload {
  timeline: string
  trackName?: string
}

interface RenameTrackPayload {
	timeline: string
  oldName: string
  newName: string
}

interface SetTrackModePayload {
	timeline: string,
	track: string,
	mode: TrackMode,
}

interface UpdateCurvePayload {
	timeline: string
  track: string
  curve: AnchorPoint[]
}

interface UpdateEventsPayload {
	timeline: string
	track: string
	events: Array<EventTrigger>
}

const getDefaultCurve = (): AnchorPoint[] => [
  {
		id: uuidv4(),
    anchor: { x: 0.0, y: 0.5 },
    control_1: { x: 0.0, y: 0.5 },
    control_2: { x: 0.125, y: 0.5 }
  },
  {
		id: uuidv4(),
    anchor: { x: 1.0, y: 0.5 },
    control_1: { x: 0.875, y: 0.5 },
    control_2: { x: 1.0, y: 0.5 }
  },
]

export const findTrack = (state: TimelineState, timeline: string, name: string): Track | undefined => (
	state.timelines.find(tl => tl.name === timeline)?.tracks.find(t => t.name === name)
)

// const findAnchorPointId = (state: TimelineState, timeline: string, track: string, point: AnchorPoint): string | undefined => (
// 	findTrack(state, timeline, track)?.curve?.find(c => (
// 		c.anchor.x === point.anchor.x && c.anchor.y === point.anchor.y &&
// 		c.control_1.x === point.control_1.x && c.control_1.y === point.control_1.y &&
// 		c.control_2.x === point.control_2.x && c.control_2.y === point.control_2.y
// 	))?.id
// )

// const findEventId = (state: TimelineState, timeline: string, track: string, event: EventTrigger): string | undefined => (
// 	findTrack(state, timeline, track)?.events?.find(e => (
// 		e.position === event.position && e.data === event.data
// 	))?.id
// )

const timelineEditorSlice = createSlice({
  name: 'timelineEditor',
  initialState: {
    timelines: [],
    selectedTimeline: null,
  } as TimelineState,
  reducers: {
    overwriteTimelineData(state, action: PayloadAction<TimelineState>) {
      const newState = action.payload
      console.debug(`Received new state to overwrite in store:`, newState)
      if (!Object.keys(newState).includes('timelines')) {
        console.error('Cannot overwrite timeline data; property "timelines" is missing.')
        return
      }
      if (!Array.isArray(newState.timelines)) {
        console.warn('Incorrect formatting of timelines array. Reformatting.')
        let hasError = false
        const keys = Object.keys(newState.timelines)
        for (let i = 0; i < keys.length; ++i) {
          const timeline = newState.timelines[keys[i]]
          if (!timeline) {
            console.error(`Malformed timeline data; encountered empty timeline object at key ${keys[i]}`)
            hasError = true
            break
          }
          if (!Object.keys(timeline).includes('name')
            || !Object.keys(timeline).includes('duration')
            || !Object.keys(timeline).includes('fps')
            || !Object.keys(timeline).includes('loop')
            || !Object.keys(timeline).includes('tracks')) {
            console.error(`Malformed timeline data. Expected properties are name, duration, fps, loop, tracks. Received: ${Object.keys(timeline).join(', ')}.`)
            hasError = true
            break
          }
        }
        if (hasError) {
          return
        }
      }
      if (!newState.timelines.length) {
        console.error('Cannot overwrite timeline data; timelines array is empty.')
        return
      }
      if (!Object.keys(newState).includes('selectedTimeline')) {
        newState.selectedTimeline = newState.timelines.length ? newState.timelines[0].name : null
      }

      console.debug('Successfully validated new store data. Proceeding to overwrite.')
      return {
        ...state,
				...newState
      }
    },
		setTimelineState(state, action: PayloadAction<TimelineSnapshot>) {
			const timeline = state.timelines.find(t => t.name === action.payload.name);
			if (timeline) {
				timeline.position = action.payload.position;
				timeline.isPlaying = action.payload.isPlaying;
			}
		},
    selectTimeline(state, action: PayloadAction<string>) {
      const timeline = state.timelines.find(t => t.name === action.payload)
      if (timeline) {
        state.selectedTimeline = action.payload
      }
    },
    addTimeline(state, action: PayloadAction<AddTimelinePayload>) {
			const { name, duration, fps, loopPlayback } = action.payload
      const timeline: Timeline = {
				name,
				duration,
				fps,
				loopPlayback,
				tracks: [{
					name: "Track 1",
					mode: TrackMode.Curve,
					curve: getDefaultCurve(),
					events: null,
				} as Track],
				position: 0.0,
				isPlaying: false,
			}
      state.timelines.push(timeline)
      state.selectedTimeline = timeline.name
    },
    removeTimeline(state, action: PayloadAction<string>) {
      if (state.timelines.length < 1) return
      const timelines = state.timelines.filter(({ name }) => name != action.payload)
      return {
        ...state,
        timelines,
        selectedTimeline: timelines.length ? timelines[0].name : null,
      }
    },
		renameTimeline(state, action: PayloadAction<RenameTimelinePayload>) {
			const timeline = state.timelines.find(t => t.name === action.payload.oldName);
			if (timeline) {
				timeline.name = action.payload.newName;
			}
			if (state.selectedTimeline === action.payload.oldName) {
				state.selectedTimeline = action.payload.newName;
			}
		},
    updateTimeline(state, action: PayloadAction<UpdateTimelinePayload>) {
      return {
        ...state,
        timelines: state.timelines.map(t => (
          t.name == action.payload.name
            ? { ...t, ...action.payload }
            : t
        ))
      }
    },
    addTrack(state, action: PayloadAction<AddTrackPayload>) {
      const timeline = state.timelines.find(t => t.name === action.payload.timeline)
      if (timeline) {
				let idx = timeline.tracks.length + 1
				while (timeline.tracks.find(({ name }) => name === `Track ${idx}`)) {
					idx += 1;
				}
        const name = action.payload.trackName || `Track ${idx}`
        timeline.tracks = [
          ...timeline?.tracks,
          {
            name,
						mode: TrackMode.Curve,
            curve: getDefaultCurve(),
						events: null,
          } as Track
        ]
      }
    },
    removeTrack(state, action: PayloadAction<string>) {
      state.timelines = state.timelines.map(tl => ({
        ...tl,
        tracks: tl.tracks.filter(({ name }) => name !== action.payload)
      }))
    },
    renameTrack(state, action: PayloadAction<RenameTrackPayload>) {
      const track = findTrack(state, action.payload.timeline, action.payload.oldName)

      if (track) {
        track.name = action.payload.newName
      }
    },
		setTrackMode(state, action: PayloadAction<SetTrackModePayload>) {
			const track = findTrack(state, action.payload.timeline, action.payload.track)
			if (track && action.payload.mode !== track.mode) {
				track.mode = action.payload.mode
				if (track.mode === TrackMode.Curve) {
					track.curve = getDefaultCurve()
					track.events = null
				} else {
					track.curve = null
					track.events = []
				}
			}
		},
    updateCurve(state, action: PayloadAction<UpdateCurvePayload>) {
      const track = findTrack(state, action.payload.timeline, action.payload.track)

      if (track) {
        track.curve = action.payload.curve.map(({ id, anchor, control_1, control_2 }) => ({
					id,
          anchor: {
            x: Math.max(0, Math.min(1, anchor.x)),
            y: Math.max(0, Math.min(1, anchor.y))
          },
          control_1: {
            x: Math.max(0, Math.min(1, control_1.x)),
            y: Math.max(0, Math.min(1, control_1.y))
          },
          control_2: {
            x: Math.max(0, Math.min(1, control_2.x)),
            y: Math.max(0, Math.min(1, control_2.y))
          },
        }))
      }
    },
		updateEvents(state, action: PayloadAction<UpdateEventsPayload>) {
			const track = findTrack(state, action.payload.timeline, action.payload.track)
			if (track) {
				track.events = action.payload.events
			}
		},
  }
})

export const {
  overwriteTimelineData,
  selectTimeline,
	setTimelineState,
  addTimeline,
  removeTimeline,
	renameTimeline,
  updateTimeline,
  addTrack,
  removeTrack,
  renameTrack,
	setTrackMode,
  updateCurve,
	updateEvents,
} = timelineEditorSlice.actions

export default timelineEditorSlice.reducer
