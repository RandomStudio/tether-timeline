import { store } from '@/redux/store';
import { updateEvents } from '@/redux/timeline/slice';
import { EventTrigger, TrackMode } from '@/redux/timeline/types';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Stack,
} from '@mui/material';
import React, { useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import { TrackProps } from '../..';
import EventHandle from './event-handle';

const EventsEditor: React.FC<TrackProps> = ({
  width,
  height,
  scale,
  pxPerSecond,
  playPosition,
  track: { name, mode, events },
	onSave,
}) => {
	if (mode !== TrackMode.Event || !events) {
		return <></>
	}

	const [ selectedHandleIndex, setSelectedHandleIndex ] = useState(-1)
	const [ showEditDialog, setShowEditDialog ] = useState(false)
	const [ selectedEventData, setSelectedEventData ] = useState<EventTrigger>({ position: 0, data: '' })

	const onSingleClick = (_event: React.MouseEvent<HTMLDivElement>) => {
    setSelectedHandleIndex(-1)
  }

	const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const { clientX } = event
    const scrollLeft = (event.currentTarget as HTMLDivElement).parentElement?.parentElement?.parentElement?.scrollLeft || 0
    const position = (clientX + scrollLeft) / (width * scale)
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: [
				...events,
				{ position, data: '' } as EventTrigger
			]
		}))
		onSave()
	}

	const onMouseLeave = () => {
		//
	}

	const onClickEventHandle = (index: number) => {
		setSelectedHandleIndex(index === selectedHandleIndex ? -1 : index)
		setSelectedEventData({ ...events[index] })
	}

	const onDoubleClickEventHandle = (index: number) => {
		setSelectedHandleIndex(index === selectedHandleIndex ? -1 : index)
		setSelectedEventData({ ...events[index] })
		setShowEditDialog(true)
	}

	const onUpdateEventTime = (time: number) => {
		setSelectedEventData({ ...selectedEventData, position: time * pxPerSecond / width })
	}

	const onUpdateEventData = (data: string) => {
		setSelectedEventData({ ...selectedEventData, data })
	}

	const onConfirmEditEvent = () => {
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events.map((e, i) => (
				i === selectedHandleIndex ? {
					...selectedEventData
				} : e
			))
		}))
		onSave()
		setShowEditDialog(false)
	}

	const onDeleteEvent = () => {
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events.filter((_e, i) => i !== selectedHandleIndex)
		}))
		onSave()
		setSelectedHandleIndex(-1)
		setShowEditDialog(false)
	}

	return (
		<div
			className={styles.body}
			onDoubleClick={onDoubleClick}
			onMouseLeave={onMouseLeave}
			style={{ width: `${width * scale}px`, height: `${height}px`, }}
		>
			<div
          className={ styles.bg }
          style={{
            background: `repeating-linear-gradient(
              to right,
              #ddd 0px,
              #ddd 1px,
              #eee 1px,
              #eee ${pxPerSecond * scale}px
            )`
          }}
          onClick={onSingleClick}
        />
        <div className={ styles.playhead } style={{ left: `${playPosition * width * scale}px` }} />
			{ events.map(({ position, data }, index) => (
				<EventHandle
					key={index}
					position={position}
					data={data}
					selected={index === selectedHandleIndex}
					onClick={() => onClickEventHandle(index)}
					onDoubleClick={() => onDoubleClickEventHandle(index)}
				/>
			))}
			<Dialog open={showEditDialog}>
				<DialogTitle>Edit event</DialogTitle>
				<DialogContent>
					<Stack direction={'column'} spacing={'1em'} sx={{ marginTop: '0.5em' }}>
						<FormControl>
							<InputLabel htmlFor="form-item-time">Time</InputLabel>
							<OutlinedInput
								id="form-item-time"
								type="number"
								defaultValue={selectedEventData.position * width / pxPerSecond}
								endAdornment={<InputAdornment position="end">seconds</InputAdornment>}
								label="Time"
								onChange={e => onUpdateEventTime(Number(e.target.value))}
							/>
						</FormControl>
						<FormControl>
							<InputLabel htmlFor="form-item-data">Data</InputLabel>
							<OutlinedInput
								id="form-item-data"
								defaultValue={selectedEventData.data}
								label="Data"
								onChange={e => onUpdateEventData(e.target.value)}
							/>
						</FormControl>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button startIcon={<CloseIcon />} onClick={() => setShowEditDialog(false)}>
						Cancel
					</Button>
					<Button startIcon={<CheckIcon />} sx={{ color: 'green' }} onClick={onConfirmEditEvent}>
						Save
					</Button>
					<IconButton sx={{ color: 'darkred' }} onClick={onDeleteEvent}>
						<DeleteIcon />
					</IconButton>
				</DialogActions>
			</Dialog>
		</div>
	)
}

export default EventsEditor
