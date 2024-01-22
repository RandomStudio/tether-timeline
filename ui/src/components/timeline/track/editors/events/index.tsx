import { store } from '@/redux/store';
import { updateEvents } from '@/redux/timeline/slice';
import { EventTrigger, TrackMode } from '@/redux/timeline/types';
import Logger from '@/utils/logger';
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

interface DragInfo {
  index: number
  startX: number
  offsetX: number
}

const emptyDragInfo: DragInfo = {
  index: -1,
  startX: 0,
  offsetX: 0,
}

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
	const [ dragInfo, setDragInfo ] = useState<DragInfo>({ ...emptyDragInfo })

	const onSingleClick = (_event: React.MouseEvent<HTMLDivElement>) => {
    setSelectedHandleIndex(-1)
  }

	const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const { clientX } = event
    const scrollLeft = (event.currentTarget as HTMLDivElement).parentElement?.parentElement?.parentElement?.scrollLeft || 0
    const position = (clientX + scrollLeft) / (width * scale)
		Logger.debug(`** Double clicked track`, clientX, scrollLeft, position)
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

	const onGrabEventHandle = (event: React.MouseEvent<HTMLDivElement>, index: number) => {
		setSelectedHandleIndex(index)
		const { pageX } = event
    const scrollLeft = (event.currentTarget as HTMLDivElement).parentElement?.parentElement?.parentElement?.scrollLeft || 0
    const position = (pageX + scrollLeft) / (width * scale)
		Logger.debug(`*** Grabbed handle ${index}, pageX: ${pageX}, scrollLeft: ${scrollLeft}, position: ${position}`)
    setDragInfo({
      index,
      startX: event.pageX,
      offsetX: 0,
    })
	}

	const onDrag = (event: React.MouseEvent<HTMLDivElement>) => {
		if (dragInfo.index < 0) return;
		// const { startX } = dragInfo;
		// setDragInfo({
			// 	...dragInfo,
			// 	offsetX: event.pageX - startX
			// })

		const { pageX } = event
		const { startX } = dragInfo
    const scrollLeft = (event.currentTarget as HTMLDivElement).parentElement?.parentElement?.parentElement?.scrollLeft || 0
    const position = (pageX + scrollLeft) / (width * scale)
		Logger.debug(`*** Dragged handle ${dragInfo.index}, pageX: ${pageX}, scrollLeft: ${scrollLeft}, position: ${position}`)
		setDragInfo({
      ...dragInfo,
			offsetX: pageX - startX
    })
	}

	const stopDrag = () => {
		if (dragInfo.index < 0) return;
		if (dragInfo.offsetX === 0) {
			setDragInfo({ ...emptyDragInfo })
			return;
		}
		const { offsetX } = dragInfo
		store.dispatch(updateEvents({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			events: events.map((e, i) => (
				i === dragInfo.index
					? { ...e, position: e.position + (offsetX / (width * scale)) }
					: e
			)).sort((a, b) => a.position - b.position)
		}))
		setDragInfo({ ...emptyDragInfo })
		onSave()
	}

	const onRelease = (_event: React.MouseEvent<HTMLDivElement>) => {
		stopDrag()
	}

	const onMouseLeave = () => {
		const doSave = dragInfo.index > -1;
		stopDrag();
		if (doSave) {
			onSave()
		}
	}

	const onClickEventHandle = (index: number) => {
		Logger.debug(`*** Clicked handle`, index);
		// setSelectedHandleIndex(index === selectedHandleIndex ? -1 : index)
		setSelectedEventData({ ...events[index] })
	}

	const onDoubleClickEventHandle = (index: number) => {
		Logger.debug(`*** Double clicked handle`, index);
		stopDrag();
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
		<div
			className={styles.body}
			onDoubleClick={onDoubleClick}
			onMouseMove={onDrag}
			onMouseUp={onRelease}
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
					position={index === dragInfo.index ? position + (dragInfo.offsetX / (width * scale)) : position}
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
		</div>
	)
}

export default EventsEditor
