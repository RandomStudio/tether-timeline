import { KeyboardContext } from '@/context/keyboard-context';
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
import React, { useCallback, useContext, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { TrackProps } from '../track';
import Editor, { getMouseEventPosition } from './editor';
import EventHandle from './events/event-handle';

interface EventHandleDragInfo {
  id: string
	start: number,
	position: number
	grabOffset: number,
	moved: boolean
}

const emptyEventHandleDragInfo: EventHandleDragInfo = {
  id: '',
	start: 0,
	position: 0,
	grabOffset: 0,
	moved: false,
}

const EventsEditor = (props: TrackProps) => {

	const {
		width,
		height,
		scale,
		pxPerSecond,
		track: { name, mode, events },
		onSave,
	} = props

	const keyboard = useContext(KeyboardContext)

	const [ selectedIds, setSelectedIds ] = useState<Array<string>>([])
	const [ showEditDialog, setShowEditDialog ] = useState(false)
	const [ selectedEventData, setSelectedEventData ] = useState<EventTrigger>({ id: '', position: 0, data: '' })
	const [ eventHandleDragInfo, setEventHandleDragInfo ] = useState<EventHandleDragInfo>({ ...emptyEventHandleDragInfo })
	const [ isMultiSelecting, setIsMultiSelecting ] = useState(false)

	const onTrackClick = (_position: Point) => {

	}

	const onTrackPress = (_position: Point) => {
		setSelectedIds([])
	}

	const onTrackDoubleClick = (position: Point) => {
		const { x } = position
		const event = { id: uuidv4(), position: x, data: '' } as EventTrigger
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events && events.length ? [
				...events,
				event
			] : [
				event
			]
		}))
		onSave()
	}

	const onTrackDrag = (start: Point, position: Point) => {
		if (eventHandleDragInfo.id !== '') {
			// drag selected handle(s)
			onDragEventHandle(position)
		} else {
			setIsMultiSelecting(true)
			// select handles within drag area
			setSelectedIds(
				events?.reduce((l, e, _i) => (
					e.position >= Math.min(start.x, position.x) &&
					e.position <= Math.max(start.x, position.x)
						? [ ...l, e.id ]
						: l
				), new Array<string>) || []
			)
		}
	}

	const onTrackRelease = (position: Point) => {
		setIsMultiSelecting(false)
		if (eventHandleDragInfo.id !== '') {
			onReleaseEventHandle(position);
		}
	}

	const onGrabEventHandle = (event: React.MouseEvent<HTMLDivElement>, id: string) => {
		const item = events?.find(e => e.id === id)
		if (!item) {
			console.warn('Could not find handle with selected id')
			return
		}
		if (!selectedIds.includes(id)) {
			if (keyboard.isShiftKeyPressed) {
				setSelectedIds([ ...selectedIds, id ])
			} else {
				setSelectedIds([id])
			}
		}
		// indicate that we're not dragging a selection box, but moving handles instead
		setIsMultiSelecting(false)
		const { x } = getMouseEventPosition(event, width * scale, height)
		const handlePosition = item!.position
    setEventHandleDragInfo({
      id,
			start: x,
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
		const delta = x - eventHandleDragInfo.start
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events?.map((e, _i) => (
				selectedIds.includes(e.id)
					? { ...e, position: e.position + delta }
					: e
			)).sort((a, b) => a.position - b.position) || []
		}))
		setEventHandleDragInfo({ ...emptyEventHandleDragInfo })
		onSave()
	}

	const onClickEventHandle = (id: string) => {
		const item = events?.find(e => e.id === id)
		if (!item) {
			console.warn('Could not find handle with selected id')
			return
		}
		// mouse down (a.k.a. grab) already updates the selected indices
		setSelectedEventData({ ...item })
	}

	const onDoubleClickEventHandle = (id: string) => {
		const item = events?.find(e => e.id === id)
		if (!item) {
			console.warn('Could not find handle with selected id')
			return
		}
		// select only the clicked handle
		setSelectedIds([item.id])
		setSelectedEventData({ ...item })
		setShowEditDialog(true)
	}

	const onUpdateEventTime = (time: number) => {
		setSelectedEventData({ ...selectedEventData, position: time * pxPerSecond / width })
	}

	const onUpdateEventData = (data: string) => {
		setSelectedEventData({ ...selectedEventData, data })
	}

	const onConfirmEditEvent = useCallback(() => {
		if (selectedEventData.id === '') {
			console.warn('Edited non-selected item. Ignoring.')
			return
		}
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events?.map((e, _i) => (
				e.id === selectedEventData.id // this should only ever be a single entry
				? {
						...selectedEventData
					}
				: e
			)) || []
		}))
		onSave()
		setShowEditDialog(false)
	}, [events, name, onSave, selectedEventData])

	const onDeleteEvent = useCallback(() => {
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events?.filter((e, _i) => !selectedIds.includes(e.id)) || []
		}))
		onSave()
		setSelectedIds([])
		setShowEditDialog(false)
	}, [events, name, onSave, selectedIds])

	const onKeyDown = useCallback((key: string) => {
		switch (key.toLowerCase()) {
			case "delete":
			case "backspace":
				if (!showEditDialog && selectedIds.length) {
					onDeleteEvent()
				}
				break
			case "enter":
				if (showEditDialog) {
					onConfirmEditEvent()
				}
		}
	}, [showEditDialog, selectedIds, onConfirmEditEvent, onDeleteEvent])

	if (mode !== TrackMode.Event || !events) {
		return <></>
	}

	return (
		<>
		<Editor
			showDragRect={isMultiSelecting}
			onTrackClick={onTrackClick}
			onTrackDoubleClick={onTrackDoubleClick}
			onTrackPress={onTrackPress}
			onTrackDrag={onTrackDrag}
			onTrackRelease={onTrackRelease}
			onKeyDown={onKeyDown}
			trackProps={props}
		>
			{ events.map(({ id, position, data }) => (
				<EventHandle
					id={id}
					key={id}
					position={selectedIds.includes(id) ? position + (eventHandleDragInfo.position - eventHandleDragInfo.start) : position}
					data={data}
					selected={selectedIds.includes(id)}
					onMouseDown={e => onGrabEventHandle(e, id)}
					onClick={() => onClickEventHandle(id)}
					onDoubleClick={() => onDoubleClickEventHandle(id)}
				/>
			))}
		</Editor>
		<Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)}>
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
		</>
	)
}

export default EventsEditor
