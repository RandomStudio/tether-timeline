import React, { useLayoutEffect, useRef, useState } from "react"
import { store } from "@/redux/store"
import { removeTrack, setTrackType } from "@/redux/timeline/slice"
import { CurveTrack, Track, VideoTrack } from "@/redux/timeline/types"
import { Button, MenuItem, Select } from "@mui/material"
import DeleteIcon from '@mui/icons-material/Delete'
import CurveEditor from "./editors/curve"
import VideoEditor from "./editors/video"

import styles from "styles/components/timeline/track.module.scss"

export interface TrackProps {
  playPosition: number
  width: number
  height: number
  scale: number
  duration: number
  pxPerSecond: number
  track: Track
}

const TrackComponent: React.FC<TrackProps> = ({
  width,
  height,
  scale,
  duration,
  pxPerSecond,
  playPosition,
  track,
}) => {
  const { type, id, name } = track

  const ref = useRef(null)

  const [ bounds, setBounds ] = useState({ x: 0})

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
    store.dispatch(removeTrack(id))
  }

  const onChangeTrackType = (value: string) => {
    store.dispatch(setTrackType({ id, type: value }))
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
        <Select size="small" variant="outlined" value={type} onChange={e => onChangeTrackType(e.target.value)}>
          <MenuItem value="curve">Curve</MenuItem>
          <MenuItem value="video">Video</MenuItem>
        </Select>
      </div>
      { type === "curve" && (
        <CurveEditor
          width={width}
          height={height}
          scale={scale}
          duration={duration}
          pxPerSecond={pxPerSecond}
          playPosition={playPosition}
          track={track as CurveTrack}
        />
      )}
      { type === "video" && (
        <VideoEditor
          width={width}
          height={height}
          scale={scale}
          duration={duration}
          pxPerSecond={pxPerSecond}
          playPosition={playPosition}
          track={track as VideoTrack}
        />
      )}
    </div>
  )
}

export default TrackComponent
