import { createSlice } from '@reduxjs/toolkit';

import { AnchorPoint, Timeline, TimelineSnapshot, TimelineState, Track } from './types';

import type { PayloadAction } from "@reduxjs/toolkit"
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
  oldName: string
  newName: string
}

interface UpdateCurvePayload {
  track: string
  curve: AnchorPoint[]
}

const getDefaultCurve = (): AnchorPoint[] => [
  {
    anchor: { x: 0.0, y: 0.5 },
    control_1: { x: 0.0, y: 0.5 },
    control_2: { x: 0.125, y: 0.5 }
  },
  {
    anchor: { x: 1.0, y: 0.5 },
    control_1: { x: 0.875, y: 0.5 },
    control_2: { x: 1.0, y: 0.5 }
  },
]

const getNewTimeline = (name: string): Timeline => ({
  name,
  duration: 10,
	fps: 60,
  loopPlayback: false,
  tracks: [{
    name: "Track 1",
    curve: getDefaultCurve(),
		events: [],
  } as Track],
	position: 0.0,
	isPlaying: false,
})

export const findTrack = (state: TimelineState, name: string): Track | undefined => (
  state.timelines.reduce((l: Track[], tl: Timeline) => [
    ...l,
    ...tl.tracks
  ], []).find(t => t.name === name)
)

const timelineEditorSlice = createSlice({
  name: 'timelineEditor',
  initialState: {
    timelines: [],
    selectedTimeline: null,
  } as TimelineState,
  reducers: {
    overwriteTimelineData(state, action: PayloadAction<TimelineState>) {
      const newState = action.payload
      console.log(`Received new state to overwrite in store:`, newState)
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
      console.log('Successfully validated new store data. Proceeding to overwrite.')
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
    addTimeline(state, _action: PayloadAction<void>) {
			let idx = state.timelines.length + 1;
			while (state.timelines.find(({ name }) => name === `Timeline ${idx}`)) {
				idx += 1;
			}
      const timeline = getNewTimeline(`Timeline ${idx}`)
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
            curve: getDefaultCurve(),
						events: [],
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
      const track = findTrack(state, action.payload.oldName)

      if (track) {
        track.name = action.payload.newName
      }
    },
    updateCurve(state, action: PayloadAction<UpdateCurvePayload>) {
      const track = findTrack(state, action.payload.track)

      if (track) {
        track.curve = action.payload.curve.map(({ anchor, control_1, control_2 }) => ({
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
  }
})

export const {
  overwriteTimelineData,
  selectTimeline,
	setTimelineState,
  addTimeline,
  removeTimeline,
  updateTimeline,
  addTrack,
  removeTrack,
  renameTrack,
  updateCurve,
} = timelineEditorSlice.actions

export default timelineEditorSlice.reducer
