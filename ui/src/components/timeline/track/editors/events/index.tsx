import { store } from '@/redux/store';
import { updateEvents } from '@/redux/timeline/slice';
import { EventTrigger, Point, TrackMode } from '@/redux/timeline/types';
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

import Editor, { getMouseEventPosition } from '..';
import { TrackProps } from '../..';
import EventHandle from './event-handle';

interface EventHandleDragInfo {
  index: number
	position: number
	grabOffset: number,
	moved: boolean
}

const emptyEventHandleDragInfo: EventHandleDragInfo = {
  index: -1,
	position: 0,
	grabOffset: 0,
	moved: false,
}

const EventsEditor: React.FC<TrackProps> = (props: TrackProps) => {

	const {
		width,
		height,
		scale,
		pxPerSecond,
		track: { name, mode, events },
		onSave,
	} = props

	if (mode !== TrackMode.Event || !events) {
		return <></>
	}

	const [ selectedHandleIndex, setSelectedHandleIndex ] = useState(-1)
	const [ showEditDialog, setShowEditDialog ] = useState(false)
	const [ selectedEventData, setSelectedEventData ] = useState<EventTrigger>({ position: 0, data: '' })
	const [ eventHandleDragInfo, setEventHandleDragInfo ] = useState<EventHandleDragInfo>({ ...emptyEventHandleDragInfo })

	const onTrackClick = (_position: Point) => {
		setSelectedHandleIndex(-1)
	}

	const onTrackDoubleClick = (position: Point) => {
		const { x } = position
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: [
				...events,
				{ position: x, data: '' } as EventTrigger
			]
		}))
		onSave()
	}

	const onTrackDrag = (_start: Point, position: Point) => {
		if (eventHandleDragInfo.index >= 0) {
			onDragEventHandle(position);
		}
	}

	const onTrackRelease = (position: Point) => {
		if (eventHandleDragInfo.index >= 0) {
			onReleaseEventHandle(position);
		}
	}

	const onGrabEventHandle = (event: React.MouseEvent<HTMLDivElement>, index: number) => {
		setSelectedHandleIndex(index)
		const { x } = getMouseEventPosition(event, width * scale, height)
		const handlePosition = events[index].position
    setEventHandleDragInfo({
      index,
			position: x,
			grabOffset: handlePosition - x,
			moved: false,
    })
	}

	const onDragEventHandle = (position: Point) => {
		const { x } = position
		setEventHandleDragInfo({
      ...eventHandleDragInfo,
			position: x,
			moved: true,
    })
	}

	const onReleaseEventHandle = (position: Point) => {
		if (!eventHandleDragInfo.moved) {
			setEventHandleDragInfo({ ...emptyEventHandleDragInfo })
			return;
		}
		const { x } = position
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events.map((e, i) => (
				i === eventHandleDragInfo.index
					? { ...e, position: x + eventHandleDragInfo.grabOffset }
					: e
			)).sort((a, b) => a.position - b.position)
		}))
		setEventHandleDragInfo({ ...emptyEventHandleDragInfo })
		onSave()
	}

	const onClickEventHandle = (index: number) => {
		// setSelectedHandleIndex(index === selectedHandleIndex ? -1 : index)
		setSelectedEventData({ ...events[index] })
	}

	const onDoubleClickEventHandle = (index: number) => {
		// setSelectedHandleIndex(index === selectedHandleIndex ? -1 : index)
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
		<Editor
			onTrackClick={onTrackClick}
			onTrackDoubleClick={onTrackDoubleClick}
			onTrackDrag={onTrackDrag}
			onTrackRelease={onTrackRelease}
			trackProps={props}
		>
			{ events.map(({ position, data }, index) => (
				<EventHandle
					key={index}
					position={index === eventHandleDragInfo.index ? eventHandleDragInfo.position + eventHandleDragInfo.grabOffset : position}
					data={data}
					selected={index === selectedHandleIndex}
					onMouseDown={e => onGrabEventHandle(e, index)}
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
		</Editor>
	)
}

export default EventsEditor
