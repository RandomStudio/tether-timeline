import React, { useEffect, useRef, useState } from "react"
import { RootState, store } from "@/redux/store";
import { SampleLocation, VideoTrack } from "@/redux/timeline/types"
import { appendSampleLocations, replaceSampleLocations, setVideoSampleValues, updateVideo } from "@/redux/timeline/slice";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, Input, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
import FileOpenIcon from '@mui/icons-material/FileOpen';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { TrackProps } from ".."

import styles from "styles/components/timeline/track.module.scss"
import { useSelector } from "react-redux";

const defaultSampleLocation = { name: '', x: 0, y: 0, w: 1, h: 1, sx: 1, sy: 1 }

const getColumnName = (n: number): string => {
  var ordA = 'a'.charCodeAt(0);
  var ordZ = 'z'.charCodeAt(0);
  var len = ordZ - ordA + 1;

  var s = "";
  while(n >= 0) {
      s = String.fromCharCode(n % len + ordA) + s;
      n = Math.floor(n / len) - 1;
  }
  return s.toUpperCase();
}

const createSampleLocationEditor = (
  location: SampleLocation,
  index: number,
  onChange: (idx: number, s: SampleLocation) => void,
  onRemove: (i: number) => void
) => {
  const { name, x, y, w, h, sx, sy } = location
  return (
    <div key={`sle-${index}`} style={{ padding: '1em', marginBottom: '0', backgroundColor: index % 2 == 1 ? '#efefef' : '#fff' }}>
      <Stack direction="column">
        <Stack direction="row">
          <TextField
            size="small" variant="outlined" sx={{ width: 333 }}
            label="Name" value={name}
            onChange={e => onChange(index, { ...location, name: e.target.value })}
          />
          <Button size="small" sx={{ width: 70 }} onClick={() => onRemove(index)}>
            <DeleteIcon />
          </Button>
        </Stack>
        <Stack direction="row" sx={{ marginTop: 1 }}>
          <TextField
            size="small" variant="outlined" sx={{ maxWidth: 60, marginRight: 1 }}
            label="x" value={x}
            onChange={e => onChange(index, { ...location, x: Number(e.target.value) })}
          />
          <TextField
            size="small" variant="outlined" sx={{ maxWidth: 60, marginRight: 1 }}
            label="y" value={y}
            onChange={e => onChange(index, { ...location, y: Number(e.target.value) })}
          />
          <TextField
            size="small" variant="outlined" sx={{ maxWidth: 60, marginRight: 1 }}
            label="w" value={w}
            onChange={e => onChange(index, { ...location, w: Number(e.target.value) })}
          />
          <TextField
            size="small" variant="outlined" sx={{ maxWidth: 60, marginRight: 1 }}
            label="h" value={h}
            onChange={e => onChange(index, { ...location, h: Number(e.target.value) })}
          />
          <TextField
            size="small" variant="outlined" sx={{ maxWidth: 60, marginRight: 1 }}
            label="sx" value={sx}
            onChange={e => onChange(index, { ...location, sx: Number(e.target.value) })}
          />
          <TextField
            size="small" variant="outlined" sx={{ maxWidth: 60, marginRight: 1 }}
            label="sy" value={sy}
            onChange={e => onChange(index, { ...location, sy: Number(e.target.value) })}
          />

        </Stack>
      </Stack>
    </div>
  )
}

interface VideoEditorProps extends TrackProps {
  track: VideoTrack
}

const VideoEditor: React.FC<VideoEditorProps> = ({
  width,
  height,
  scale,
  duration,
  pxPerSecond,
  playPosition,
  track,
}) => {
  const { id, video: { file, loop }, sampleLocations } = track

  const { timelines } = useSelector((state: RootState) => state.timeline)
  const allTracks = timelines.reduce((list, tl) => (
    [
      ...list,
      ...tl.tracks.map(t => ({
        id: t.id,
        label: `${tl.name}: ${t.name}`
      }))
    ]
  ), [] as ({ id: string, label: string })[])
  const [ selectedTrackId, setSelectedTrackId ] = useState<string>('')

  const [ cols, setCols] = useState<number>(6)
  const [ rows, setRows] = useState<number>(4)
  const [ offsetX, setOffsetX] = useState<number>(50)
  const [ offsetY, setOffsetY] = useState<number>(50)
  const [ spacingX, setSpacingX] = useState<number>(100)
  const [ spacingY, setSpacingY] = useState<number>(100)

  const videoRef = useRef<HTMLVideoElement>(null!)

  const [ canvas, setCanvas ] = useState<OffscreenCanvas | null>(null)
  const [ ctx, setContext ] = useState<OffscreenCanvasRenderingContext2D | null>(null)
  const [ isSettingSampleLocations, setIsSettingSampleLocations ] = useState<boolean>(false)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = onVideoLoaded
    }
    return () => {
      if (videoRef.current) videoRef.current.onloadedmetadata = null
    }
  }, [file])

  useEffect(() => {
    if (videoRef.current && videoRef.current.duration > 0) {
      try {
        videoRef.current.currentTime = (playPosition * duration) % videoRef.current.duration
        onVideoSeeked()
      } catch (e) {
        console.warn(`Could not seek video of duration ${videoRef.current.duration} to position ${(playPosition * duration) % videoRef.current.duration}`)
      }
    }
  }, [playPosition])

  const browse = async () => {
    const f = await window.electronAPI.selectVideoFile()
    store.dispatch(updateVideo({
      ...track, video: { file: f, loop }
    }))
  }

  const addSampleLocation = () => {
    store.dispatch(updateVideo({
      ...track,
      sampleLocations: sampleLocations ? [
        ...sampleLocations,
        { ...defaultSampleLocation }
      ] : [ { ...defaultSampleLocation } ]
    }))
  }

  const clearSampleLocations = () => {
    store.dispatch(updateVideo({
      ...track,
      sampleLocations: []
    }))
  }

  const changeSampleLocation = (idx: number, loc: SampleLocation) => {
    store.dispatch(updateVideo({
      ...track,
      sampleLocations: sampleLocations.map((s, i) => (
        i === idx ? loc : s
      ))
    }))
  }

  const removeSampleLocation = (idx: number) => {
    store.dispatch(updateVideo({
      ...track,
      sampleLocations: sampleLocations.filter((s, i) => i !== idx)
    }))
  }

  const onAppendSampleLocations = (trackId: string) => {
    if (!trackId || trackId === '') {
      console.warn("Cannot copy sample locations from a non-existent track")
      return
    }
    store.dispatch(appendSampleLocations({ fromTrackId: trackId, toTrackId: track.id }))
  }

  const onReplaceSampleLocations = (trackId: string) => {
    if (!trackId || trackId === '') {
      console.warn("Cannot copy sample locations from a non-existent track")
      return
    }
    store.dispatch(replaceSampleLocations({ fromTrackId: trackId, toTrackId: track.id }))
  }

  const generateSamplePoints = () => {
    const locations = []
    for (let y = 0; y < rows; ++y) {
      for (let x = 0; x < cols; ++x) {
        const newLoc: SampleLocation = {
          name: `${getColumnName(x)}${(y + 1).toString().padStart(rows.toString().length, '0')}`,
          x: offsetX + x * spacingX,
          y: offsetY + y * spacingY,
          w: 1, h: 1, sx: 1, sy: 1
        }
        locations.push(newLoc)
      }
    }
    store.dispatch(updateVideo({
      ...track,
      sampleLocations: sampleLocations
        ? [ ...sampleLocations, ...locations ]
        : [ ...locations ]
    }))
  }

  const onVideoLoaded = () => {
    if (videoRef.current) {
      setCanvas(new OffscreenCanvas(videoRef.current.videoWidth, videoRef.current.videoWidth))
      if (canvas) {
        setContext(canvas.getContext("2d", {
          willReadFrequently: true,
        }))
        onVideoSeeked()
      }
    }
  }

  const fract = (x : number): number => x - Math.floor(x)

  const mix = (a: Uint8ClampedArray, b: Uint8ClampedArray, factor: number) => {
    return a.map((v, i) => i < b.length ? v + factor * (b[i] - v) : v)
  }

  const onVideoSeeked = () => {
    if (canvas && videoRef.current) {
      if (!ctx) setContext(canvas.getContext("2d", {
        willReadFrequently: true,
      }))
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      store.dispatch(setVideoSampleValues({
        trackId: id,
        values: sampleLocations.map(({ x, y, w, h, sx, sy }) => {
          const clrs: number[] = []
          for (let j = 0; j < h; ++j) {
            for (let i = 0; i < w; ++i) {
              const cx = x + i * sx,
                    cy = Math.round(y + j * sy)
              const clr = fract(cx) === 0.0
                ? ctx?.getImageData(cx, cy, 1, 1).data
                : mix(ctx?.getImageData(Math.floor(cx), cy, 1, 1).data!, ctx?.getImageData(Math.ceil(cx), cy, 1, 1).data!, fract(cx))
              // TODO also interpolate pixel values vertically, not just horizontally
              if (clr && clr.length >= 3) {
                clrs.push(clr[0] << 16 | clr[1] << 8 | clr[2])
              } else {
                clrs.push(0)
              }
            }
          }
          return clrs
        })
      }))
    }
  }

  return (
    <div
      className={ `${styles.body} ${styles.video}` }
      style={{ height: `${height}px` }}
    >
      <video
        ref={videoRef}
        height={`${0.8 * height}px`}
        src={file || ''}
        style={{ margin: `0 ${0.1 * height}px`, aspectRatio: file ? 'auto' : 6/5 }}
        autoPlay={false}
        crossOrigin="Anonymous"
      />
      <p className={`${styles.fileName} ${file == null ? styles.blank : ''}`}>
        { file?.split('/').pop() || 'Please select a video file' }
      </p>
      <IconButton size="small" onClick={browse}>
        <FileOpenIcon />
      </IconButton>
      <IconButton size="small" onClick={() => setIsSettingSampleLocations(!isSettingSampleLocations)}>
        <MyLocationIcon />
      </IconButton>
      <Dialog open={isSettingSampleLocations}>
        <DialogTitle>Set sample locations</DialogTitle>
        <DialogContent>
          <div className={ styles.sampleLocationList }>
            { sampleLocations?.map((loc, i) => (
              createSampleLocationEditor(loc, i, changeSampleLocation, removeSampleLocation)
            ))}
          </div>
          <Button size="small" variant="contained" style={{margin: '0.5em'}} onClick={() => clearSampleLocations()}>
            <DeleteIcon />
          </Button>
          <Button size="small" variant="contained" style={{margin: '0.5em auto'}} onClick={() => addSampleLocation()}>
            <AddIcon />
          </Button>
          <div className={ styles.sampleLocationGenerator }>
            <p>Generate multiple sample locations in one go:</p>
            <div className={ styles.row }>
              <FormControl variant="standard" size="small" sx={{ maxWidth: 80, marginRight: '0.5em' }}>
                <InputLabel>cols</InputLabel>
                <Input type="number" value={cols} onChange={e => setCols(Number(e.target.value))} />
              </FormControl>
              <FormControl variant="standard" size="small" sx={{ maxWidth: 80, marginRight: '0.5em' }}>
                <InputLabel>offset x</InputLabel>
                <Input type="number" value={offsetX} onChange={e => setOffsetX(Number(e.target.value))} />
              </FormControl>
              <FormControl variant="standard" size="small" sx={{ maxWidth: 80, marginRight: '0.5em' }}>
                <InputLabel>spacing x</InputLabel>
                <Input type="number" value={spacingX} onChange={e => setSpacingX(Number(e.target.value))} />
              </FormControl>
            </div>
            <div className={ styles.row }>
            <FormControl variant="standard" size="small" sx={{ maxWidth: 80, marginRight: '0.5em' }}>
                <InputLabel>rows</InputLabel>
                <Input type="number" value={rows} onChange={e => setRows(Number(e.target.value))} />
              </FormControl>
              <FormControl variant="standard" size="small" sx={{ maxWidth: 80, marginRight: '0.5em' }}>
                <InputLabel>offset y</InputLabel>
                <Input type="number" value={offsetY} onChange={e => setOffsetY(Number(e.target.value))} />
              </FormControl>
              <FormControl variant="standard" size="small" sx={{ maxWidth: 80, marginRight: '0.5em' }}>
                <InputLabel>spacing y</InputLabel>
                <Input type="number" value={spacingY} onChange={e => setSpacingY(Number(e.target.value))} />
              </FormControl>
            </div>
            <Button
              size="small"
              variant="contained"
              style={{margin: '0.5em auto'}}
              onClick={() => generateSamplePoints()}
            >
              Generate
            </Button>
          </div>
          <div className={ styles.copyFromScene }>
            <p>Copy from another track:</p>
            <Stack direction="row">
              <Select size="small" style={{ width: '100%' }} value={selectedTrackId}
                onChange={e => setSelectedTrackId(e.target.value)}>
                { allTracks.map(({ id, label }) => (
                  <MenuItem key={id} value={id}>{ label }</MenuItem>
                ))}
              </Select>
              <Button size="small" variant="contained" style={{ marginLeft: '0.5em' }}
                disabled={selectedTrackId === ''}
                onClick={e => onAppendSampleLocations(selectedTrackId) }>
                Append
              </Button>
              <Button size="small" variant="contained" style={{ marginLeft: '0.5em' }}
                disabled={selectedTrackId === ''}
                onClick={e => onReplaceSampleLocations(selectedTrackId) }>
                Replace
              </Button>
            </Stack>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSettingSampleLocations(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default VideoEditor
