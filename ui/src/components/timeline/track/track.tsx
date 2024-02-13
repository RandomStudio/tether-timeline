import { store } from '@/redux/store';
import { removeTrack, setTrackMode } from '@/redux/timeline/slice';
import { Track, TrackMode } from '@/redux/timeline/types';
import DeleteIcon from '@mui/icons-material/Delete';
import { IconButton, MenuItem, Select } from '@mui/material';
import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import ColorGradientEditor from './editors/color-gradient-editor';
import CurveEditor from './editors/curve-editor';
import EventsEditor from './editors/events-editor';

export interface TrackProps {
	timeline: string,
  playPosition: number
  width: number
  height: number
  scale: number
  duration: number
  pxPerSecond: number
  track: Track
	onSave: () => void
}

const TrackComponent: React.FC<TrackProps> = ({
	width,
	height,
	scale,
	duration,
	pxPerSecond,
	playPosition,
	timeline,
	track,
	onSave,
}) => {
  const { name, mode, curve } = track

  const ref = useRef<HTMLDivElement>(null)

  const [ _bounds, setBounds ] = useState({ x: 0})

  useLayoutEffect(() => {
    if (ref.current) {
      const { left } = ref.current.getBoundingClientRect() || { left: 0 }
      setBounds({
        x: left
      });
    }
  }, []);

  const deleteTrack = () => {
    store.dispatch(removeTrack(name))
  }

	const onChangeTrackMode = (value: TrackMode) => {
		store.dispatch(setTrackMode({ timeline, track: name, mode: value }))
		onSave()
  }

  return (
    <div
      ref={ref}
      className={ `${styles.track} ${styles.curve}` }
      style={{ width: `${width * scale}px` }}
    >
      <div className={ styles.header }>
        <IconButton size="small" onClick={deleteTrack}>
          <DeleteIcon fontSize="small" sx={{ color: "#000000" }} />
        </IconButton>
        <p className={ styles.name }>{ name }</p>
        <div className={ styles.spacer } />
				<Select
					size="small"
					variant="outlined"
					sx={{ margin: '0.25em' }}
					value={mode}
					onChange={e => onChangeTrackMode(e.target.value as TrackMode)}
				>
          <MenuItem value={TrackMode.Curve}>Curve</MenuItem>
          <MenuItem value={TrackMode.Event}>Event</MenuItem>
          <MenuItem value={TrackMode.Color}>Color</MenuItem>
        </Select>
      </div>
			{ mode === TrackMode.Curve && !!curve && (
        <CurveEditor
					timeline={timeline}
          width={width}
          height={height}
          scale={scale}
          duration={duration}
          pxPerSecond={pxPerSecond}
          playPosition={playPosition}
          track={track}
					onSave={onSave}
        />
			)}
			{ mode === TrackMode.Event && (
				<EventsEditor
					timeline={timeline}
					width={width}
					height={height}
          scale={scale}
          duration={duration}
          pxPerSecond={pxPerSecond}
          playPosition={playPosition}
          track={track}
					onSave={onSave}
				/>
			)}
			{ mode === TrackMode.Color && (
				<ColorGradientEditor
					timeline={timeline}
					width={width}
					height={height}
					scale={scale}
					duration={duration}
					pxPerSecond={pxPerSecond}
					playPosition={playPosition}
					track={track}
					onSave={onSave}
				/>
			)}
    </div>
  )
}

export default TrackComponent
