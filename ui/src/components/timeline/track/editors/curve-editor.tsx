import { KeyboardContext } from '@/context/keyboard-context';
import { store } from '@/redux/store';
import { updateCurve } from '@/redux/timeline/slice';
import { AnchorPoint, Point, TrackMode } from '@/redux/timeline/types';
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
import styles from 'styles/components/timeline/track.module.scss';
import { v4 as uuidv4 } from 'uuid';

import { cubicBezier, findTForX } from '../../../../utils/bezier-helper';
import { TrackProps } from '../track';
import Editor, { getMouseEventPosition } from './editor';

enum PointDragType {
  ANCHOR,
  CONTROL_1,
  CONTROL_2,
}

interface PointDragInfo {
  index: number
	start: Point,
  position: Point
	minPosition: Point
	maxPosition: Point
  prevPoint: AnchorPoint | null
  nextPoint: AnchorPoint | null
  type: PointDragType,
}

const emptyPointDragInfo: PointDragInfo = {
  index: -1,
	start: { x: 0, y: 0 },
  position: { x: 0, y: 0 },
	minPosition: { x: 0, y: 0 },
	maxPosition: { x: 0, y: 0} ,
  prevPoint: null,
  nextPoint: null,
  type: PointDragType.ANCHOR,
}

const clamp = (a: number, min: number, max: number) => (
  Math.max(min, Math.min(max, a))
)

// const lerp = (a: number, b: number, factor: number): number => (
//   a * (1 - factor) + (b * factor)
// )

// const lerpPoint = (a: Point, b: Point, factor: number): Point => ({
//   x: lerp(a.x, b.x, factor),
//   y: lerp(a.y, b.y, factor)
// })

const getPointBefore = (curve: AnchorPoint[] | null, position: number): AnchorPoint | null => {
	if (!curve || !curve.length) return null
  const allBefore: AnchorPoint[] = curve.filter(p => p.anchor.x < position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.anchor.x - b.anchor.x).pop()!
    : curve[0]
}

const getPointAfter = (curve: AnchorPoint[] | null, position: number): AnchorPoint | null => {
	if (!curve || !curve.length) return null
  const allBefore: AnchorPoint[] = curve.filter(p => p.anchor.x > position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.anchor.x - b.anchor.x).shift()!
    : curve[curve.length - 1]
}

export const calculateValue = (curve: AnchorPoint[] | null, position: number) => {
  const prev = getPointBefore(curve, position)
  const next = getPointAfter(curve, position)
	if (!prev || !next) return 0
  // const t = (position - prev.point.x) / (next.point.x - prev.point.x)
  const t = findTForX(prev.anchor.x, prev.control_2.x, next.control_1.x, next.anchor.x, position, 0.0001)
  return cubicBezier(prev.anchor, prev.control_2, next.control_1, next.anchor, t).y
}

const dummyAnchor = {
	anchor: { x: -1, y: -1 },
	control_1: { x: -1, y: -1 },
	control_2: { x: -1, y: -1 }
} as AnchorPoint

const CurveEditor = (props: TrackProps) => {

	const {
		width,
		height,
		scale,
		pxPerSecond,
		playPosition,
		track: { name, mode, curve },
		onSave,
	} = props

	const keyboard = useContext(KeyboardContext)

  const [ selectedPointIndex, setSelectedPointIndex ] = useState(-1)
	const [ showEditDialog, setShowEditDialog ] = useState(false)
	const [ selectedAnchorPointData, setSelectedAnchorPointData ] = useState<AnchorPoint>(dummyAnchor)
  const [ pointDragInfo, setPointDragInfo ] = useState<PointDragInfo>({ ...emptyPointDragInfo })

	const onTrackClick = (_position: Point) => {

	}

	const onTrackPress = (_position: Point) => {
		setSelectedPointIndex(-1)
	}

	const onTrackDoubleClick = (position: Point) => {
		const { x, y } = position
		const lastBefore = getPointBefore(curve, x)
    const firstAfter = getPointAfter(curve, x)

    const c1 = {
      x: Math.max(lastBefore ? lastBefore.anchor.x : 0, x - 0.02),
      y
    }
    const c2 = {
      x: Math.min(firstAfter ? firstAfter.anchor.x : 1, x + 0.02),
      y
    }

		const pt: AnchorPoint = { id: uuidv4(), anchor: position, control_1: c1, control_2: c2 }
    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: curve && curve.length ? [
        ...curve,
        pt
      ].sort((a, b) => a.anchor.x - b.anchor.x) : [ pt ]
    }))
		onSave()
	}

	const onTrackDrag = (_start: Point, position: Point) => {
		if (pointDragInfo.index > -1) {
			onDragPoint(position)
		}
	}

	const onTrackRelease = (_position: Point) => {
		if (pointDragInfo.index > -1) {
			onReleasePoint()
		}
	}

  const onGrabPoint = (event: React.MouseEvent<SVGCircleElement>, index: number, type: PointDragType) => {
		if (!curve || index >= curve.length) return
    setSelectedPointIndex(index)
    const { anchor } = curve[index]
		const position = getMouseEventPosition(event, width * scale, height)
    const prev = getPointBefore(curve, anchor.x)
    const next = getPointAfter(curve, anchor.x)
		const minX = type === PointDragType.ANCHOR || type === PointDragType.CONTROL_1
			? prev?.anchor.x || 0 : anchor.x
		const maxX = type === PointDragType.ANCHOR || type === PointDragType.CONTROL_2
			? next?.anchor.x || 1 : anchor.x
    setPointDragInfo({
      index,
			start: position,
      position,
      minPosition: { x: minX, y: 0 },
      maxPosition: { x: maxX, y: 1 },
      prevPoint: prev,
      nextPoint: next,
      type,
    })
  }

  const onDragPoint = (position: Point) => {
		const { index, minPosition, maxPosition, type } = pointDragInfo
		if (!curve || index >= curve.length) return
		const { anchor, control_1, control_2 } = curve[index]
		const allowHDrag = type !== PointDragType.ANCHOR || (index > 0 && index < curve.length - 1)
		const { x } = (type === PointDragType.ANCHOR ? anchor : (type === PointDragType.CONTROL_1 ? control_1 : control_2));
		setPointDragInfo({
			...pointDragInfo,
			position: {
				x: allowHDrag
					? clamp(position.x, minPosition.x, maxPosition.x)
					: x,
				y: clamp(position.y, minPosition.y, maxPosition.y)
			}
		})
  }

	const stopDrag = () => {
    const { index, start, position, type } = pointDragInfo;
		if (!curve || index >= curve.length) return
		const delta = { x: position.x - start.x, y: position.y - start.y }
    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: curve.map(({ id, anchor, control_1, control_2 }, i) => {
        if (i === index) {
					switch (type) {
						case PointDragType.ANCHOR:
							return {
								id,
								anchor: position,
								control_1: { x: control_1.x + delta.x, y: control_1.y + delta.y },
								control_2: { x: control_2.x + delta.x, y: control_2.y + delta.y },
							}
						case PointDragType.CONTROL_1:
							return {
								id,
								anchor,
								control_1: position,
								control_2: keyboard.isShiftKeyPressed
									? getMirroredControlPoint(anchor, position)
									: control_2,
							}
						case PointDragType.CONTROL_2:
							return {
								id,
								anchor,
								control_1: keyboard.isShiftKeyPressed
									? getMirroredControlPoint(anchor, position)
									: control_1,
								control_2: position,
							}
					}
        } else {
          return { id, anchor, control_1, control_2 }
        }
      })
    }))
    setPointDragInfo({ ...emptyPointDragInfo })
  }

	const onReleasePoint = () => {
		stopDrag();
		onSave();
	}

	const onDoubleClickAnchorPoint = (index: number) => {
		if (!curve || index >= curve.length) return
		setSelectedPointIndex(index)
		setSelectedAnchorPointData({
			id: curve[index].id,
			anchor: { ...curve[index].anchor },
			control_1: { ...curve[index].control_1 },
			control_2: { ...curve[index].control_2 },
		})
		setShowEditDialog(true)
	}

	const onUpdateAnchorTime = (time: number) => {
		if (selectedPointIndex == -1) return
		setSelectedAnchorPointData({
			...selectedAnchorPointData,
			anchor: {
				...selectedAnchorPointData.anchor,
				x: time * pxPerSecond / width
			},
		})
	}

	const onUpdateAnchorY = (y: number) => {
		if (selectedPointIndex == -1) return
		setSelectedAnchorPointData({
			...selectedAnchorPointData,
			anchor: {
				...selectedAnchorPointData.anchor,
				y
			},
		})
	}

	const onConfirmEditAnchorPoint = useCallback(() => {
		if (selectedPointIndex == -1) {
			deselectAnchorPoint()
			return
		}

		store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
			curve: curve?.map((c, i) => (
				i === selectedPointIndex ? {
					...selectedAnchorPointData
				} : c
			)).sort((a, b) => a.anchor.x - b.anchor.x) || []
    }))

		onSave()
		deselectAnchorPoint()
	}, [curve, name, onSave, selectedAnchorPointData, selectedPointIndex])

	const onDeleteAnchorPoint = useCallback(() => {
		if (selectedPointIndex == -1) {
			deselectAnchorPoint()
			return
		}

    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: curve?.filter((_p, i) => i !== selectedPointIndex) || [],
    }))

		onSave()
    deselectAnchorPoint()
	}, [curve, name, onSave, selectedPointIndex]);

	const deselectAnchorPoint = () => {
		setSelectedPointIndex(-1)
		setSelectedAnchorPointData(dummyAnchor)
		setShowEditDialog(false)
	}

	const onKeyDown = useCallback((key: string) => {
		switch (key.toLowerCase()) {
			case "delete":
			case "backspace":
				if (!showEditDialog && selectedPointIndex > -1) {
					onDeleteAnchorPoint()
				}
				break
			case "enter":
				if (showEditDialog) {
					onConfirmEditAnchorPoint()
				}
		}
	}, [showEditDialog, selectedPointIndex, onDeleteAnchorPoint, onConfirmEditAnchorPoint])

  /**
   * Create an SVG path from a list of normalized anchors and control points, and the size
   * of the area to draw it in.
   * @param points Array of AnchorPoint objects
   * @param width Destination area width
   * @param height Destination area height
   * @returns String representation of the corresponding SVG path
   */
  const createPath = (points: AnchorPoint[] | null, width: number, height: number): string => {

    // turn normalized positions into concrete coordinates
    const calcPos = (p: Point): Point => ({
      x: p.x * width,
      y: p.y * height,
    })

    // Work out the full path in sections between two points, via their respective control points
    return (points || []).reduce((path, { anchor, control_1 }, i, arr) => {
      const p = calcPos(anchor)
      const cc = calcPos(control_1)

      if (i === 0) {
        return `M${p.x},${p.y}`
      }

      const prev = arr[i - 1]
      const pc = calcPos(prev.control_2)

      return path + ` C${pc.x},${pc.y} ${cc.x},${cc.y} ${p.x},${p.y}`
    }, '')
  }

	const getMirroredControlPoint = (anchor: Point, control: Point): Point => ({
		x: anchor.x + (anchor.x - control.x),
		y: anchor.y + (anchor.y - control.y),
	})

  // Define the current curve by applying any offsets that are the result of dragging anchor or control points
  const currentCurve = pointDragInfo.index < 0
    ? curve
    : curve?.map((v, i) => {
			const { index, start, position } = pointDragInfo
			const delta = { x: position.x - start.x, y: position.y - start.y }
      if (i === index) {
        const { id, anchor, control_1, control_2 } = v
        if (pointDragInfo.type === PointDragType.ANCHOR) {
          return {
						id,
            anchor: pointDragInfo.position,
            control_1: { x: control_1.x + delta.x, y: control_1.y + delta.y },
            control_2: { x: control_2.x + delta.x, y: control_2.y + delta.y },
          }
        } else {
          return {
						id,
            anchor,
            control_1: pointDragInfo.type === PointDragType.CONTROL_1
              ? { x: control_1.x + delta.x, y: control_1.y + delta.y }
              : pointDragInfo.type === PointDragType.CONTROL_2 && keyboard.isShiftKeyPressed
								? getMirroredControlPoint(anchor, { x: control_2.x + delta.x, y: control_2.y + delta.y })
								: control_1,
            control_2: pointDragInfo.type === PointDragType.CONTROL_2
              ? { x: control_2.x + delta.x, y: control_2.y + delta.y }
              : pointDragInfo.type === PointDragType.CONTROL_1 && keyboard.isShiftKeyPressed
							? getMirroredControlPoint(anchor, { x: control_1.x + delta.x, y: control_1.y + delta.y })
							: control_2,
          }
        }
      } else {
        return v
      }
    }
  ) || []

  const playY = calculateValue(currentCurve, playPosition)

	if (mode !== TrackMode.Curve || !curve || !curve.length) {
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
			<svg
				width={width * scale}
				height={height}
				viewBox={`0, 0, ${width * scale}, ${height}`}
				pointerEvents="none"
			>
				<g>
					<line
						className={styles.valueLine}
						x1={0}
						y1={playY * height}
						x2={width * scale}
						y2={playY * height}
					/>
					<path
						className={styles.curvePath}
						d={createPath(currentCurve, width * scale, height)}
					/>
					{ currentCurve?.map(({ anchor, control_1, control_2 }, i, _arr) => {
						const isSelected = selectedPointIndex == i || pointDragInfo.index == i
						const p = {
							x: anchor.x * width * scale,
							y: anchor.y * height,
						}
						const c1 = {
							x: control_1.x * width * scale,
							y: control_1.y * height,
						}
						const c2 = {
							x: control_2.x * width * scale,
							y: control_2.y * height,
						}
						return (
							<React.Fragment key={i}>
								<line
									className={`${styles.controlPointLine} ${isSelected ? styles.selected: ''}`}
									x1={c1.x} y1={c1.y} x2={p.x} y2={p.y}
								/>
								<line
									className={`${styles.controlPointLine} ${isSelected ? styles.selected: ''}`}
									x1={p.x} y1={p.y} x2={c2.x} y2={c2.y}
								/>
								<circle
									className={`${styles.anchor} ${isSelected ? styles.selected: ''}`}
									cx={p.x} cy={p.y} r="5"
									onMouseDown={e => onGrabPoint(e, i, PointDragType.ANCHOR)}
									onDoubleClick={e => {
										e.stopPropagation();
										stopDrag();
										onDoubleClickAnchorPoint(i);
									}}
								/>
								<circle
									className={`${styles.control} ${isSelected ? styles.selected: ''}`}
									cx={c1.x} cy={c1.y} r="3"
									onMouseDown={e => onGrabPoint(e, i, PointDragType.CONTROL_1)}
									/>
								<circle
									className={`${styles.control} ${isSelected ? styles.selected: ''}`}
									cx={c2.x} cy={c2.y} r="3"
									onMouseDown={e => onGrabPoint(e, i, PointDragType.CONTROL_2)}
								/>
							</React.Fragment>
						)
					}) }
				</g>
			</svg>
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
							defaultValue={selectedAnchorPointData!.anchor.x * width / pxPerSecond}
							endAdornment={<InputAdornment position="end">seconds</InputAdornment>}
							label="Time"
							onChange={e => onUpdateAnchorTime(Number(e.target.value))}
						/>
					</FormControl>
					<FormControl>
						<InputLabel htmlFor="form-item-y">Y</InputLabel>
						<OutlinedInput
							id="form-item-y"
							type="number"
							defaultValue={selectedAnchorPointData!.anchor.y}
							label="Y"
							onChange={e => onUpdateAnchorY(Number(e.target.value))}
						/>
					</FormControl>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button startIcon={<CloseIcon />} onClick={() => setShowEditDialog(false)}>
					Cancel
				</Button>
				<Button startIcon={<CheckIcon />} sx={{ color: 'green' }} onClick={onConfirmEditAnchorPoint}>
					Save
				</Button>
				<IconButton sx={{ color: 'darkred' }} onClick={onDeleteAnchorPoint}>
					<DeleteIcon />
				</IconButton>
			</DialogActions>
		</Dialog>
		</>
  )
}

export default CurveEditor
