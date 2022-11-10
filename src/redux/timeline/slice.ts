import { createSlice, nanoid } from "@reduxjs/toolkit"
import type { PayloadAction } from "@reduxjs/toolkit"
import { CurveTrack, Point, Timeline, TimelineState, Track, VideoTrack } from "./types"

interface UpdateTimelinePayload {
  id: string
  name: string
  duration: number
  loop: boolean
}

interface AddTrackPayload {
  timelineId: string
  trackName?: string
}

interface SetTrackTypePayload {
  id: string
  type: string
}

interface RenameTrackPayload {
  id: string
  name: string
}

interface UpdateCurvePayload {
  trackId: string
  curve: Point[]
}

interface VideoSamplePayload {
  trackId: string
  values: number[][] // each sample location gets a list of color values
}

interface SetSampleLocationsPayload {
  fromTrackId: string
  toTrackId: string
}

const getDefaultCurve = (): Point[] => [
  { x: 0.0, y: 0.0 },
  { x: 1.0, y: 0.0 },
]

const getNewTimeline = (name: string): Timeline => ({
  id: nanoid(),
  name,
  duration: 10,
  loop: false,
  tracks: [{
    type: "curve",
    id: nanoid(),
    name: "Track 1",
    curve: getDefaultCurve(),
  } as CurveTrack]
})

export const findTrackById = (state: TimelineState, id: string): Track | undefined => (
  state.timelines.reduce((l: Track[], tl: Timeline) => [
    ...l,
    ...tl.tracks
  ], []).find(t => t.id === id)
)

const initialTimeline = getNewTimeline("Timeline 1")

const timelineEditorSlice = createSlice({
  name: 'timelineEditor',
  initialState: {
    timelines: [initialTimeline],
    selectedTimelineId: initialTimeline.id,
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
          if (!Object.keys(timeline).includes('id')
            || !Object.keys(timeline).includes('name')
            || !Object.keys(timeline).includes('duration')
            || !Object.keys(timeline).includes('loop')
            || !Object.keys(timeline).includes('tracks')) {
            console.error(`Malformed timeline data. Expected properties are id, name, duration, loop, tracks. Received: ${Object.keys(timeline).join(', ')}.`)
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
      if (!Object.keys(newState).includes('selectedTimelineId')) {
        newState.selectedTimelineId = newState.timelines[0].id
      }
      console.log('Successfully validated new store data. Proceeding to overwrite.')
      return {
        ...state,
        ...newState
      }
    },
    selectTimeline(state, action: PayloadAction<string>) {
      const timeline = state.timelines.find(t => t.id === action.payload)
      if (timeline) {
        state.selectedTimelineId = action.payload
      }
    },
    selectTimelineByName(state, action: PayloadAction<string>) {
      const timeline = state.timelines.find(t => (
        t.name.toLowerCase() === action.payload.toLowerCase()
        || t.name.toLowerCase() === action.payload.toLowerCase().replace('_', ' ')
      ))
      if (timeline) {
        state.selectedTimelineId = timeline.id
      }
    },
    addTimeline(state, action: PayloadAction<void>) {
      const timeline = getNewTimeline(`Sequence ${state.timelines.length + 1}`)
      state.timelines.push(timeline)
      state.selectedTimelineId = timeline.id
    },
    removeTimeline(state, action: PayloadAction<string>) {
      if (state.timelines.length < 2) return
      const timelines = state.timelines.filter(({ id }) => id != action.payload)
      if (timelines.length < 1) return
      return {
        ...state,
        timelines,
        selectedTimelineId: timelines[0].id
      }
    },
    updateTimeline(state, action: PayloadAction<UpdateTimelinePayload>) {
      return {
        ...state,
        timelines: state.timelines.map(t => (
          t.id == action.payload.id
            ? { ...t, ...action.payload }
            : t
        ))
      }
    },
    addTrack(state, action: PayloadAction<AddTrackPayload>) {
      const timeline = state.timelines.find(t => t.id === action.payload.timelineId)
      if (timeline) {
        const name = action.payload.trackName || `Track ${timeline.tracks.length + 1}`
        timeline.tracks = [
          ...timeline?.tracks,
          {
            type: "curve",
            id: nanoid(),
            name: name,
            curve: getDefaultCurve()
          } as CurveTrack
        ]
      }
    },
    removeTrack(state, action: PayloadAction<string>) {
      state.timelines = state.timelines.map(tl => ({
        ...tl,
        tracks: tl.tracks.filter(t => (
          t.id !== action.payload
        ))
      }))
    },
    setTrackType(state, action: PayloadAction<SetTrackTypePayload>) {
      state.timelines.forEach(tl => {
        tl.tracks = tl.tracks.reduce((list, track) => {
          if (track.id !== action.payload.id) {
            return [ ...list, track ] as Track[]
          } else {
            switch (action.payload.type) {
              case "curve":
                return [
                  ...list,
                  {
                    type: "curve",
                    id: track.id,
                    name: track.name,
                    curve: getDefaultCurve()
                  } as CurveTrack
                ] as Track[]
              case "video":
                return [
                  ...list,
                  {
                    type: "video",
                    id: track.id,
                    name: track.name,
                    video: {
                      file: null,
                      loop: true
                    },
                    sampleLocations: [],
                    currentValues: []
                  } as VideoTrack
                ] as Track[]
              default:
                return list as Track[]
            }
          }
        }, [] as Track[])
      })
    },
    renameTrack(state, action: PayloadAction<RenameTrackPayload>) {
      const track = findTrackById(state, action.payload.id)

      if (track) {
        track.name = action.payload.name
      }
    },
    updateCurve(state, action: PayloadAction<UpdateCurvePayload>) {
      const track = findTrackById(state, action.payload.trackId)

      if (track && track.type === "curve") {
        (track as CurveTrack).curve = action.payload.curve.map(c => ({
          x: Math.max(0, Math.min(1, c.x)),
          y: Math.max(0, Math.min(1, c.y))
        }))
      }
    },
    updateVideo(state, action: PayloadAction<VideoTrack>) {
      const track = findTrackById(state, action.payload.id)

      if (track && track.type === "video") {
        const t = track as VideoTrack
        t.name = action.payload.name
        t.video = {
          ...action.payload.video
        }
        t.sampleLocations = action.payload.sampleLocations ? [
          ...action.payload.sampleLocations
        ] : []
      }
    },
    appendSampleLocations(state, action: PayloadAction<SetSampleLocationsPayload>) {
      const src = findTrackById(state, action.payload.fromTrackId) as VideoTrack
      const dst = findTrackById(state, action.payload.toTrackId) as VideoTrack
      if (src && src.type === "video" && dst && dst.type === "video") {
        // ensure that we are not storing references to src's sample locations in dst
        const toCopy = src.sampleLocations.map(l => ({
          ...l
        }))
        dst.sampleLocations = dst.sampleLocations ? [
          ...dst.sampleLocations,
          ...toCopy
        ] : toCopy
      }
    },
    replaceSampleLocations(state, action: PayloadAction<SetSampleLocationsPayload>) {
      const src = findTrackById(state, action.payload.fromTrackId) as VideoTrack
      const dst = findTrackById(state, action.payload.toTrackId) as VideoTrack
      if (src && src.type === "video" && dst && dst.type === "video") {
        // ensure that we are not storing references to src's sample locations in dst
        dst.sampleLocations = src.sampleLocations.map(l => ({
            ...l
        }))
      }
    },
    setVideoSampleValues(state, action: PayloadAction<VideoSamplePayload>) {
      const track = findTrackById(state, action.payload.trackId)

      if (track && track.type === "video") {
        (track as VideoTrack).currentValues = [
          ...action.payload.values
        ]
      }
    }
  }
})

export const {
  overwriteTimelineData,
  selectTimeline,
  selectTimelineByName,
  addTimeline,
  removeTimeline,
  updateTimeline,
  addTrack,
  removeTrack,
  setTrackType,
  renameTrack,
  updateCurve,
  updateVideo,
  appendSampleLocations,
  replaceSampleLocations,
  setVideoSampleValues
} = timelineEditorSlice.actions

export default timelineEditorSlice.reducer
