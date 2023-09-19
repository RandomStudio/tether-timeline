import { store } from '@/redux/store';
import { removeTrack } from '@/redux/timeline/slice';
import { Track } from '@/redux/timeline/types';
import DeleteIcon from '@mui/icons-material/Delete';
import { Button } from '@mui/material';
import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import CurveEditor from './editors/curve';

export interface TrackProps {
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
  track,
	onSave,
}) => {
  const { name } = track

  const ref = useRef(null)

  const [ _bounds, setBounds ] = useState({ x: 0})

  useLayoutEffect(() => {
    if (ref.current) {
      //@ts-ignore
      const { left } = ref.current.getBoundingClientRect() || { left: 0 }
      setBounds({
        x: left
      });
    }
  }, []);

  const deleteTrack = () => {
    store.dispatch(removeTrack(name))
  }

  return (
    <div
      ref={ref}
      className={ `${styles.track} ${styles.curve}` }
      style={{ width: `${width * scale}px` }}
    >
      <div className={ styles.header }>
        <Button size="small" onClick={deleteTrack}>
          <DeleteIcon fontSize="small" sx={{ color: "#000000" }} />
        </Button>
        <p className={ styles.name }>{ name }</p>
        <div className={ styles.spacer } />
      </div>
        <CurveEditor
          width={width}
          height={height}
          scale={scale}
          duration={duration}
          pxPerSecond={pxPerSecond}
          playPosition={playPosition}
          track={track}
					onSave={onSave}
        />
    </div>
  )
}

export default TrackComponent
