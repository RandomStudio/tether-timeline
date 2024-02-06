import { store } from '@/redux/store';
import { updateColors } from '@/redux/timeline/slice';
import { ColorStop, Point, RGBFloat, TrackMode } from '@/redux/timeline/types';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import LabelIcon from '@mui/icons-material/Label';
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
import { useCallback, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import { TrackProps } from '../track';
import ColorPicker, { numberToRGBFloat, RGBFloatToNumber } from './color/colorpicker';
import Gradient from './color/gradient';
import Editor, { getMouseEventPosition } from './editor';

interface DragInfo {
	index: number
	start: number,
	position: number
	grabOffset: number
	moved: boolean
}

const emptyDragInfo: DragInfo = {
	index: -1,
	start: -1,
	position: -1,
	grabOffset: 0,
	moved: false,
}

const ColorGradientEditor = (props: TrackProps) => {
	const {
		width,
		height,
		scale,
		pxPerSecond,
		track: { name, mode, colors },
		onSave,
	} = props;

	// const keyboard = useContext(KeyboardContext)

	const [ selectedIndex, setSelectedIndex ] = useState(-1)
	const [ showEditDialog, setShowEditDialog ] = useState(false)
	const [ selectedColorStopData, setSelectedColorStopData ] = useState<ColorStop>({ position: 0, color: { r: 0, g: 0, b: 0 } })
	const [ dragInfo, setDragInfo ] = useState<DragInfo>({ ...emptyDragInfo })

	const onTrackClick = (_position: Point) => {

	}

	const onTrackPress = (_position: Point) => {
		setSelectedIndex(-1)
	}

	const onTrackDoubleClick = (position: Point) => {
		const { x } = position
		const colorStop = { position: x, color: { r: 0, g: 0, b: 0 } } as ColorStop
		store.dispatch(updateColors({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			colors: colors && colors.length ? [
				...colors,
				colorStop
			] : [
				colorStop
			]
		}))
		onSave()
	}

	const onTrackDrag = (_start: Point, position: Point) => {
		if (dragInfo.index > -1) {
			onDragHandle(position);
		}
	}

	const onTrackRelease = (position: Point) => {
		if (dragInfo.index > -1) {
			onReleaseHandle(position);
		}
	}

	const onGrabHandle = (event: React.MouseEvent<HTMLDivElement>, index: number) => {
		if (!colors || index > colors.length - 1 || index < 0) {
			return
		}
		setSelectedIndex(index)
		const { x } = getMouseEventPosition(event, width * scale, height)
		setDragInfo({
			index,
			start: x,
			position: x,
			grabOffset: colors[index].position - x,
			moved: false,
		})
	}

	const onDragHandle = (position: Point) => {
		const { x } = position
		setDragInfo({
			...dragInfo,
			position: x,
			moved: true,
		})
	}

	const onReleaseHandle = (position: Point) => {
		if (!dragInfo.moved) {
			setDragInfo({ ...emptyDragInfo })
			return
		}
		const { x } = position
		const delta = x - dragInfo.start
		store.dispatch(updateColors({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			colors: colors?.map((c, i) => (
				selectedIndex === i
					? {
						...c,
						position: c.position + delta
					}
					: c
			)) || []
		}))
		setDragInfo({ ...emptyDragInfo })
		onSave()
	}

	const onClickColorStop = (index: number) => {
		if (!colors || index > colors.length - 1 || index < 0) {
			return
		}
		setSelectedColorStopData({ ...colors[index] })
	}

	const onDoubleClickColorStop = (index: number) => {
		if (!colors || index > colors.length - 1 || index < 0) {
			return
		}
		setSelectedIndex(index)
		setSelectedColorStopData({ ...colors[index] })
		setShowEditDialog(true)
	}

	const onUpdateColorStopTime = (time: number) => {
		setSelectedColorStopData({ ...selectedColorStopData, position: time * pxPerSecond / width })
	}

	const onUpdateColorStopData = (color: RGBFloat) => {
		setSelectedColorStopData({ ...selectedColorStopData, color })
	}

	const onConfirmEditColorStop = useCallback(() => {
		if (selectedIndex === -1) {
			console.warn('Edited non-selected item. Ignoring.')
			return
		}
		store.dispatch(updateColors({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			colors: colors?.map((c, i) => (
				i === selectedIndex // this should only ever be a single entry
				? {
						...selectedColorStopData
					}
				: c
			)) || []
		}))
		onSave()
		setShowEditDialog(false)
	}, [colors, name, onSave, selectedColorStopData, selectedIndex])

	const onDeleteColorStop = useCallback(() => {
		store.dispatch(updateColors({
			timeline: store.getState().selectedTimeline || '',
			track: name,
			colors: colors?.filter((_c, i) => i !== selectedIndex) || []
		}))
		onSave()
		setSelectedIndex(-1)
		setShowEditDialog(false)
	}, [colors, name, onSave, selectedIndex])

	const onKeyDown = useCallback((key: string) => {
		switch (key.toLowerCase()) {
			case "delete":
			case "backspace":
				if (!showEditDialog && selectedIndex > -1) {
					onDeleteColorStop()
				}
				break
			case "enter":
				if (showEditDialog) {
					onConfirmEditColorStop()
				}
		}
	}, [onConfirmEditColorStop, onDeleteColorStop, selectedIndex, showEditDialog])

	if (mode !== TrackMode.Color || !colors) {
		return <></>
	}

	return (
		<>
		<Editor
			showDragRect={false}
			onTrackClick={onTrackClick}
			onTrackDoubleClick={onTrackDoubleClick}
			onTrackPress={onTrackPress}
			onTrackDrag={onTrackDrag}
			onTrackRelease={onTrackRelease}
			onKeyDown={onKeyDown}
			trackProps={props}
		>
			<Gradient
				colors={
					colors.map((c, i) => (
						i === dragInfo.index
							? { ...c, position: c.position + dragInfo.position - dragInfo.start }
							: c
					))
				}
			/>
			{ colors.map(({ position, color }, index) => (
				<div
					className={styles.colorStop}
					style={{
						left: index === dragInfo.index
							?	`${(position + dragInfo.position - dragInfo.start) * 100}%`
							: `${position * 100}%`
					}}
					onMouseDown={e => onGrabHandle(e, index)}
					onClick={() => onClickColorStop(index)}
					onDoubleClick={e => {
						e.stopPropagation();
						onDoubleClickColorStop(index);
					}}
				>
					<LabelIcon
						className={`${styles.label} ${index === selectedIndex ? styles.selected : ''}`}
						sx={{ color: `#${RGBFloatToNumber(color).toString(16).padStart(6, '0')}` }}
					/>
				</div>
			))}
		</Editor>
		<Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)}>
			<DialogTitle>Edit color</DialogTitle>
			<DialogContent>
				<Stack direction={'column'} spacing={'1em'} sx={{ marginTop: '0.5em' }}>
					<FormControl>
						<InputLabel htmlFor="form-item-time">Time</InputLabel>
						<OutlinedInput
							id="form-item-time"
							type="number"
							defaultValue={selectedColorStopData.position * width / pxPerSecond}
							endAdornment={<InputAdornment position="end">seconds</InputAdornment>}
							label="Time"
							onChange={e => onUpdateColorStopTime(Number(e.target.value))}
						/>
					</FormControl>
					<FormControl>
						<InputLabel>Color</InputLabel>
						<ColorPicker
							color={RGBFloatToNumber(selectedColorStopData.color)}
							onChange={(color: number) => {
								onUpdateColorStopData(numberToRGBFloat(color))
							}}
							enabled={true}
						/>
					</FormControl>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button startIcon={<CloseIcon />} onClick={() => setShowEditDialog(false)}>
					Cancel
				</Button>
				<Button startIcon={<CheckIcon />} sx={{ color: 'green' }} onClick={onConfirmEditColorStop}>
					Save
				</Button>
				<IconButton sx={{ color: 'darkred' }} onClick={onDeleteColorStop}>
					<DeleteIcon />
				</IconButton>
			</DialogActions>
		</Dialog>
		</>
	)
}

export default ColorGradientEditor
