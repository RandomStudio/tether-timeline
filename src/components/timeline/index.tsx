import React from "react"
import { store } from "../../redux/store"
import { CurveTrack, Timeline, TrackType, VideoTrack } from "../../redux/timeline/types"
import { addTrack, updateTimeline } from "../../redux/timeline/slice"
import { Button, ButtonGroup, Checkbox, FormControl, FormControlLabel, IconButton, InputAdornment, OutlinedInput, Slider, Stack, TextField } from "@mui/material"
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import AddIcon from '@mui/icons-material/Add';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import TrackComponent from "./track"
import TimeTrack from "./timetrack"
import styles from "styles/components/timeline/timeline.module.scss"
import { calculateValue } from "./track/editors/curve"

const PX_PER_SECOND = 50

export interface TrackValue {
  type: "single"
  trackType: TrackType
  trackId: string
  trackName: string
  value: number
}

export interface TrackValueList {
  type: "list"
  trackType: TrackType
  trackId: string
  trackName: string
  values: number[][]
}

export interface TimelineProps {
  timeline: Timeline
  onAutoPopulate: ((id: string) => void) | null
  onUpdate: ((values: (TrackValue | TrackValueList)[]) => void) | null // emit an array of single value or lists of values
}

export interface TimelineState {
  position: number
  scale: number
  largeTrackHeight: boolean
  playing: boolean
  lastUpdatedAt: number
  interval?: NodeJS.Timer
  elementWidth: number
  settingDuration: boolean
}

class TimelineComponent extends React.Component<TimelineProps, TimelineState> {

  constructor(props: TimelineProps) {
    super(props)
    this.state = {
      position: 0,
      largeTrackHeight: false,
      scale: 1,
      playing: false,
      lastUpdatedAt: 0,
      settingDuration: false,
    } as TimelineState
  }

  setDuration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { timeline: { id, name, loop } } = this.props
    store.dispatch(updateTimeline({
      id,
      name,
      loop,
      duration: Number(event.target.value)
    }))
  }

  toggleLargeTrackHeight = () => {
    const { largeTrackHeight } = this.state
    this.setState({ largeTrackHeight: !largeTrackHeight })
  }

  setScale = (event: Event, scale: number | number[]) => {
    this.setState({ scale: Array.isArray(scale) ? scale[0] : scale })
  }

  addTrack = () => {
    const { timeline: { id } } = this.props
    store.dispatch(addTrack({ timelineId: id }))
  }

  play = (fromPosition: number = NaN) => {
    const { playing, position } = this.state
    if (playing) {
      this.setState({
        position: Math.max(0, Math.min(1, fromPosition)),
        lastUpdatedAt: Date.now(),
      })
      return
    }
    const { interval } = this.state
    clearInterval(interval)
    this.setState({
      playing: true,
      position: !isNaN(fromPosition) ? Math.max(0, Math.min(1, fromPosition)) : position,
      lastUpdatedAt: Date.now(),
      interval: setInterval(this.update, 1000 / 60)
    })
    this.update()
  }

  pause = () => {
    const { playing } = this.state
    if (!playing) return
    const { interval } = this.state
    clearInterval(interval)
    this.setState({
      playing: false,
      interval: undefined
    })
  }

  togglePlayback = () => {
    const { playing } = this.state
    if (!playing) {
      this.play()
    } else {
      this.pause()
    }
  }

  update = () => {
    const { timeline: { name, duration, loop } } = this.props
    const { position, playing, lastUpdatedAt, interval } = this.state
    if (!playing) {
      return
    }

    const now = Date.now()
    const elapsed = now - lastUpdatedAt
    const nextpos = (position + (0.001 * elapsed) / duration)
    const completed = !loop && nextpos >= 1.0
    if (completed) clearInterval(interval)
    this.setState({
      position: Math.max(0, loop ? nextpos % 1.0 : Math.min(1, nextpos)),
      lastUpdatedAt: now,
      playing: completed ? false : playing
    })

    this.emitValues()

    if (completed) {
      window.electronAPI.sendTimelineCompleted(name)
    }
  }

  emitValues = () => {
    const { timeline: { tracks }, onUpdate } = this.props
    const { position } = this.state
    if (onUpdate != null) {
      onUpdate(tracks.reduce((list, t) => {
        switch(t.type) {
          case "curve":
            return [
              ...list,
              {
                type: "single",
                trackType: t.type,
                trackId: t.id,
                trackName: t.name,
                value: calculateValue((t as CurveTrack).curve, position)
              } as TrackValue
            ]
          case "video":
            return [
              ...list,
              {
                type: "list",
                trackType: t.type,
                trackId: t.id,
                trackName: t.name,
                values: (t as VideoTrack).currentValues
              } as TrackValueList
            ]
          default:
            return list
        }
      }, [] as (TrackValue | TrackValueList)[]))
    }
  }

  fastRewind = () => {
    const { timeline: { duration } } = this.props
    const { position } = this.state
    this.setState({
      playing: false,
      position: Math.max(0, Math.round(position * duration - 1) / duration)
    })
    this.update()
  }

  fastForward = () => {
    const { timeline: { duration } } = this.props
    const { position } = this.state
    this.setState({
      playing: false,
      position: Math.min(1, Math.round(position * duration + 1) / duration)
    })
    this.update()
  }

  skipToStart = () => {
    this.setState({ playing: false, position: 0 })
    this.update()
  }

  skipToEnd = () => {
    this.setState({ playing: false, position: 1 })
    this.update()
  }

  toggleLoop = () => {
    const { timeline: { loop } } = this.props
    store.dispatch(updateTimeline({ ...this.props.timeline, loop: !loop }))
  }

  seekToPosition = (pos: number) => {
    this.setState({
      position: pos,
      lastUpdatedAt: Date.now()
    })

    this.emitValues()
  }

  formatTimecode = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds - 60 * min);
    return `${min}:${sec.toString().padStart(2, '0')}.${Math.floor(1000 * (seconds - sec)).toString().padEnd(3, '0')}`;
  }

  componentWillUnmount(): void {
    const { interval } = this.state
    clearInterval(interval)
  }

  render() {
    const { timeline: { id, duration, loop, tracks }, onAutoPopulate } = this.props
    const { position, largeTrackHeight, scale, playing, settingDuration } = this.state
    return (
      <div className={ styles.timeline }>
        <div className={ styles.controls }>
          <ButtonGroup size="small" variant="contained">
            <Button onClick={this.skipToStart} disabled={position <= 0}>
              <SkipPreviousIcon />
            </Button>
            <Button onClick={this.fastRewind} disabled={position <= 0}>
              <FastRewindIcon />
            </Button>
            <Button onClick={this.togglePlayback}>
              { playing ? <PauseIcon /> : <PlayArrowIcon /> }
            </Button>
            <Button onClick={this.fastForward} disabled={position >= 1}>
              <FastForwardIcon />
            </Button>
            <Button onClick={this.skipToEnd} disabled={position >= 1}>
              <SkipNextIcon />
            </Button>
          </ButtonGroup>
          <span className={ styles.time }>{ this.formatTimecode(position * duration) } sec</span>
          <div className={ styles.spacer } />
          <div className={ styles['view-control'] }>
            <Button size="small" variant="contained" style={{ marginRight: '1em' }} onClick={this.toggleLargeTrackHeight}>
              { largeTrackHeight ? <UnfoldLessIcon /> : <UnfoldMoreIcon /> }
            </Button>
            <ZoomOutIcon />
            <Slider
              size="small"
              value={scale}
              min={0.1}
              max={10}
              step={0.01}
              onChange={this.setScale}
              style={{ width: '200px' }}
              valueLabelDisplay="auto"
            />
            <ZoomInIcon />
          </div>
        </div>
        <div className={ styles.scroller }>
          <div className={ styles.tracks }>
            <TimeTrack
              width={duration * PX_PER_SECOND}
              scale={scale}
              duration={duration}
              pxPerSecond={PX_PER_SECOND}
              position={position}
              onSelectPosition={this.seekToPosition}
            />
            { tracks.map((track, index) => (
              <TrackComponent
                key={`track-${index}`}
                width={duration * PX_PER_SECOND}
                height={largeTrackHeight ? 100 : 50}
                scale={scale}
                duration={duration}
                pxPerSecond={PX_PER_SECOND}
                playPosition={position}
                track={track}
              />
            ))}
          </div>
        </div>
        { !playing && (
          <div className={ styles.controls }>
            <span>Duration:</span>
            <FormControl variant="standard" size="small">
              <Stack direction="row">
                { settingDuration && (
                  <>
                    <OutlinedInput
                      type="number"
                      value={duration}
                      endAdornment={<InputAdornment position="end">seconds</InputAdornment>}
                      style={{ margin: '0.5em' }}
                      onChange={this.setDuration}
                    />
                    <IconButton size="small" onClick={e => this.setState({ settingDuration: false })}>
                      <CheckIcon />
                    </IconButton>
                  </>
                )}
                { !settingDuration && (
                  <>
                    <TextField
                      variant="outlined" style={{ margin: '0.5em' }}
                      value={`${duration} second${duration !== 1 ? 's' : ''}`}
                    />
                    <IconButton size="small" onClick={e => this.setState({ settingDuration: true })}>
                      <EditIcon />
                    </IconButton>
                  </>
                )}
              </Stack>
            </FormControl>
            <FormControlLabel
              control={<Checkbox checked={loop} onClick={this.toggleLoop} />}
              label="Loop"
              className={ styles['loop-control'] }
            />
            <div className={ styles.spacer } />
            { onAutoPopulate != null && (
              <Button
                size="small"
                variant="contained"
                style={{ marginRight: '0.5em' }}
                onClick={() => onAutoPopulate(id)}>
                Auto populate
              </Button>
            )}
            <Button size="small" variant="contained" onClick={this.addTrack}>
              <AddIcon />
            </Button>
          </div>
        )}
      </div>
    )
  }
}

export default TimelineComponent
