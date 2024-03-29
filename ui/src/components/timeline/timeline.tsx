import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import {
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  OutlinedInput,
  Slider,
  Stack,
} from '@mui/material';
import React from 'react';
import styles from 'styles/components/timeline/timeline.module.scss';

import { store } from '../../redux/store';
import { addTrack, updateTimeline } from '../../redux/timeline/slice';
import { Timeline } from '../../redux/timeline/types';
import TimeTrack from './timetrack/timetrack';
import TrackComponent from './track/track';

const PX_PER_SECOND = 100

export interface TimelineProps {
  timeline: Timeline,
	onChange: () => void,
	onPlay: () => void,
	onPause: () => void,
	onSeek: (position: number) => void,
}


export interface TimelineState {
  scale: number
  lastUpdatedAt: number
  interval?: NodeJS.Timer
  elementWidth: number
  settingDuration: boolean
}

class TimelineComponent extends React.Component<TimelineProps, TimelineState> {

  constructor(props: TimelineProps) {
    super(props)
    this.state = {
      scale: 1,
      lastUpdatedAt: 0,
      settingDuration: false,
    } as TimelineState
  }

  setDuration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { timeline: { name, fps, loopPlayback }, onChange } = this.props
		const newTimeline = {
      name,
			fps,
      duration: Number(event.target.value),
      loopPlayback,
    } as Timeline
    store.dispatch(updateTimeline(newTimeline))
		onChange()
  }

  setScale = (scale: number) => {
    this.setState({ scale: Math.max(0, scale) })
  }

	updateScaleSlider = (_event: Event, scale: number | number[]) => {
    this.setScale(Array.isArray(scale) ? scale[0] : scale)
  }

  addTrack = () => {
    const { timeline: { name }, onChange } = this.props
    store.dispatch(addTrack({ timeline: name }))
		onChange()
  }

  play = () => {
		const { onPlay } = this.props
		onPlay()
  }

  pause = () => {
    const { onPause } = this.props
		onPause()
  }

  togglePlayback = () => {
    const { timeline: { isPlaying } } = this.props
    if (!isPlaying) {
      this.play()
    } else {
      this.pause()
    }
  }

  fastRewind = () => {
		const { timeline: { duration, position }, onSeek } = this.props
		onSeek(Math.max(0, Math.round(position * duration - 1) / duration))
  }

  fastForward = () => {
    const { timeline: { duration, position }, onSeek } = this.props
		onSeek(Math.min(1, Math.round(position * duration + 1) / duration))
  }

  skipToStart = () => {
    const { onSeek } = this.props
		onSeek(0)
  }

  skipToEnd = () => {
    const { onSeek } = this.props
		onSeek(1)
  }

  toggleLoop = () => {
    const { timeline: { loopPlayback }, onChange } = this.props
		const newTimeline = { ...this.props.timeline, loopPlayback: !loopPlayback }
    store.dispatch(updateTimeline(newTimeline))
		onChange()
  }

  seekToPosition = (pos: number) => {
    const { onSeek } = this.props
		onSeek(Math.max(0, Math.min(1, pos)))
  }

  formatTimecode = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds - 60 * min);
    return `${min}:${sec.toString().padStart(2, '0')}.${Math.floor(1000 * (seconds - sec)).toString().padEnd(3, '0')}`;
  }

  render() {
    const { timeline: { name, duration, loopPlayback, tracks, position, isPlaying }, onChange } = this.props
    const { scale, settingDuration } = this.state
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
              { isPlaying ? <PauseIcon /> : <PlayArrowIcon /> }
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
            <ZoomOutIcon onClick={() => this.setScale(Math.max(0, this.state.scale - 0.1))} />
            <Slider
              size="small"
              value={scale}
              min={0.01}
              max={8.0}
              step={0.01}
              onChange={this.updateScaleSlider}
              style={{ width: '200px' }}
              valueLabelDisplay="auto"
            />
            <ZoomInIcon onClick={() => this.setScale(Math.min(8, this.state.scale + 0.1))} />
          </div>
        </div>
        <div className={ `${styles.scroller} scroll_container` }>
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
								timeline={name}
                width={duration * PX_PER_SECOND}
                height={75}
                scale={scale}
                duration={duration}
                pxPerSecond={PX_PER_SECOND}
                playPosition={position}
                track={track}
								onSave={onChange}
              />
            ))}
          </div>
        </div>
        { !isPlaying && (
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
                    <IconButton size="small" onClick={_e => this.setState({ settingDuration: false })}>
                      <CheckIcon />
                    </IconButton>
                  </>
                )}
                { !settingDuration && (
                  <>
										<p style={{margin: '0.5em'}}>{ `${duration} second${duration !== 1 ? 's' : ''}` }</p>
                    <IconButton size="small" onClick={_e => this.setState({ settingDuration: true })}>
                      <EditIcon />
                    </IconButton>
                  </>
                )}
              </Stack>
            </FormControl>
            <FormControlLabel
              control={<Checkbox checked={loopPlayback} onClick={this.toggleLoop} />}
              label="Loop"
              className={ styles['loop-control'] }
            />
            <div className={ styles.spacer } />
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
