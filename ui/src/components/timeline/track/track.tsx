import { store } from '@/redux/store';
import { removeTrack, renameTrack, setTrackMode } from '@/redux/timeline/slice';
import { Track, TrackMode } from '@/redux/timeline/types';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
} from '@mui/material';
import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import ColorGradientEditor from './editors/color-gradient-editor';
import CurveEditor from './editors/curve-editor';
import EventsEditor from './editors/events-editor';

export interface TrackProps {
	timeline: string
  playPosition: number
  width: number
  height: number
  scale: number
  duration: number
  pxPerSecond: number
  track: Track
	onSave: () => void
}

interface EditableTrackData {
	name: string
	mode: TrackMode
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
	const [ showEditDialog, setShowEditDialog ] = useState(false)
	const [ editedTrackData, setEditedTrackData ] = useState<EditableTrackData>({ name, mode })

  useLayoutEffect(() => {
    if (ref.current) {
      const { left } = ref.current.getBoundingClientRect() || { left: 0 }
      setBounds({
        x: left
      });
    }
  }, []);

	const onClickEditTrack = () => {
		setEditedTrackData({
			name,
			mode
		})
		setShowEditDialog(true)
	}

	const onChangeTrackName = (name: string) => {
		setEditedTrackData({
			...editedTrackData,
			name
		})
	}

	const onChangeTrackMode = (mode: TrackMode) => {
		setEditedTrackData({
			...editedTrackData,
			mode
		})
  }

	const onConfirmEditTrack = () => {
		store.dispatch(setTrackMode({ timeline, track: name, mode: editedTrackData.mode }))
		store.dispatch(renameTrack({ timeline, oldName: name, newName: editedTrackData.name }))
		onSave()
		setShowEditDialog(false)
	}

	const onDeleteTrack = () => {
		store.dispatch(removeTrack(name))
		setShowEditDialog(false)
	}

  return (
		<>
    <div
      ref={ref}
      className={ `${styles.track} ${styles.curve}` }
      style={{ width: `${width * scale}px` }}
    >
      <div className={ styles.header }>
        <p className={ styles.name }>{ name }</p>
				<span className={styles.mode}>({ mode })</span>
        <div className={ styles.spacer } />
				<IconButton size="small" onClick={_e => onClickEditTrack()}>
					<EditIcon />
				</IconButton>
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
		<Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)}>
			<DialogTitle>Edit track</DialogTitle>
			<DialogContent>
				<Stack direction={'column'} spacing={'1em'} sx={{ marginTop: '0.5em' }}>
					<FormControl>
						<InputLabel htmlFor="form-item-name">Name</InputLabel>
						<OutlinedInput
							id="form-item-name"
							type="text"
							defaultValue={editedTrackData.name}
							label="Name"
							onChange={e => onChangeTrackName(e.target.value)}
						/>
					</FormControl>
					<FormControl>
						<InputLabel htmlFor="form-item-mode">Mode</InputLabel>
						<Select
							size="small"
							variant="outlined"
							sx={{ margin: '0.25em' }}
							value={editedTrackData.mode}
							onChange={e => onChangeTrackMode(e.target.value as TrackMode)}
						>
							<MenuItem value={TrackMode.Curve}>Curve</MenuItem>
							<MenuItem value={TrackMode.Event}>Event</MenuItem>
							<MenuItem value={TrackMode.Color}>Color</MenuItem>
						</Select>
					</FormControl>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button startIcon={<CloseIcon />} onClick={() => setShowEditDialog(false)}>
					Cancel
				</Button>
				<Button startIcon={<CheckIcon />} sx={{ color: 'green' }} onClick={onConfirmEditTrack}>
					Save
				</Button>
				<IconButton sx={{ color: 'darkred' }} onClick={onDeleteTrack}>
					<DeleteIcon />
				</IconButton>
			</DialogActions>
		</Dialog>
		</>
  )
}

export default TrackComponent
