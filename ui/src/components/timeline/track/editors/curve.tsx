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
import React, { useEffect, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import Editor, { getMouseEventPosition } from '.';
import { TrackProps } from '..';
import { cubicBezier, findTForX } from '../../../../utils/bezier-helper';

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

const getPointBefore = (curve: AnchorPoint[], position: number): AnchorPoint => {
  const allBefore: AnchorPoint[] = curve.filter(p => p.anchor.x < position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.anchor.x - b.anchor.x).pop()!
    : curve[0]
}

const getPointAfter = (curve: AnchorPoint[], position: number): AnchorPoint => {
  const allBefore: AnchorPoint[] = curve.filter(p => p.anchor.x > position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.anchor.x - b.anchor.x).shift()!
    : curve[curve.length - 1]
}

export const calculateValue = (curve: AnchorPoint[], position: number) => {
  const prev = getPointBefore(curve, position)
  const next = getPointAfter(curve, position)
  // const t = (position - prev.point.x) / (next.point.x - prev.point.x)
  const t = findTForX(prev.anchor.x, prev.control_2.x, next.control_1.x, next.anchor.x, position, 0.0001)
  return cubicBezier(prev.anchor, prev.control_2, next.control_1, next.anchor, t).y
}

const dummyAnchor = {
	anchor: { x: -1, y: -1 },
	control_1: { x: -1, y: -1 },
	control_2: { x: -1, y: -1 }
} as AnchorPoint

const CurveEditor: React.FC<TrackProps> = (props) => {

	const {
		width,
		height,
		scale,
		pxPerSecond,
		playPosition,
		track: { name, mode, curve },
		onSave,
	} = props

	if (mode !== TrackMode.Curve || !curve || !curve.length) {
		return <></>
	}

  const [ selectedPointIndex, setSelectedPointIndex ] = useState(-1)
	const [ showEditDialog, setShowEditDialog ] = useState(false)
	const [ selectedAnchorPointData, setSelectedAnchorPointData ] = useState<AnchorPoint>(dummyAnchor)
  const [ pointDragInfo, setPointDragInfo ] = useState<PointDragInfo>({ ...emptyPointDragInfo })
	const [ isShiftPressed, setIsShiftPressed ] = useState(false)

	useEffect(() => {
		window.addEventListener('keydown', onKey)
		window.addEventListener('keyup', onKey)

		return () => {
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('keyup', onKey)
		}
	}, []);

	const onKey = (e: KeyboardEvent) => {
		setIsShiftPressed(e.shiftKey)
	}

	const onTrackClick = (_position: Point) => {
		setSelectedPointIndex(-1)
	}

	const onTrackDoubleClick = (position: Point) => {
		const { x, y } = position
		const lastBefore = getPointBefore(curve, x)
    const firstAfter = getPointAfter(curve, x)

    let xy = { x, y }

    // if (lastBefore && firstAfter) {
    //   xy = lerpPoint(lastBefore.anchor, firstAfter.anchor, (x - lastBefore.anchor.x) / (firstAfter.anchor.x - lastBefore.anchor.x))
    // } else if (!lastBefore && firstAfter) {
    //   xy.y = firstAfter.anchor.y
    // } else if (lastBefore && !firstAfter) {
    //   xy.y = lastBefore.anchor.y
    // }

    let c1 = {
      x: Math.max(lastBefore ? lastBefore.anchor.x : 0, x - 0.125),
      y: xy.y
    }
    let c2 = {
      x: Math.min(firstAfter ? firstAfter.anchor.x : 1, x + 0.125),
      y: xy.y
    }

    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: [
        ...curve,
        { anchor: xy, control_1: c1, control_2: c2 }
      ].sort((a, b) => a.anchor.x - b.anchor.x)
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
    const {index, start, position, type } = pointDragInfo;
		const delta = { x: position.x - start.x, y: position.y - start.y }
    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: curve.map(({ anchor, control_1, control_2 }, i) => {
        if (i === index) {
					switch (type) {
						case PointDragType.ANCHOR:
							return {
								anchor: position,
								control_1: { x: control_1.x + delta.x, y: control_1.y + delta.y },
								control_2: { x: control_2.x + delta.x, y: control_2.y + delta.y },
							}
						case PointDragType.CONTROL_1:
							return {
								anchor,
								control_1: position,
								control_2: isShiftPressed
									? getMirroredControlPoint(anchor, position)
									: control_2,
							}
						case PointDragType.CONTROL_2:
							return {
								anchor,
								control_1: isShiftPressed
									? getMirroredControlPoint(anchor, position)
									: control_1,
								control_2: position,
							}
					}
          // const p = type === DragPointType.ANCHOR
          //   ? {
          //     x: clamp(
          //       position.x,
          //       prevPoint?.anchor.x || 0,
          //       nextPoint?.anchor.x || 1
          //     ),
          //     y: position.y
          //   }
          //   : anchor
          // const c1 = type === DragPointType.CONTROL_1
          //   ? position
          //   : type === DragPointType.CONTROL_2 && isShiftPressed
					// 		?	getMirroredControlPoint(anchor, position)
					// 		: {
					// 			x: p.x + (control_1.x - anchor.x),
					// 			y: p.y + (control_1.y - anchor.y),
					// 		}
          // const c2 = type === DragPointType.CONTROL_2
          //   ? {
          //     x: control_2.x + (offsetX / (width * scale)),
          //     y: control_2.y - (offsetY / height)
          //   }
          //   : type === DragPointType.CONTROL_1 && isShiftPressed
					// 	?	getMirroredControlPoint(
					// 			anchor,
					// 			{ x: control_1.x + (offsetX / (width * scale)), y: control_1.y - (offsetY / height) }
					// 		)
					// 	: {
					// 			x: p.x + (control_2.x - anchor.x),
					// 			y: p.y + (control_2.y - anchor.y),
					// 		}
          // return {
          //   anchor: p,
          //   control_1: c1,
          //   control_2: c2
          // }
        } else {
          return { anchor, control_1, control_2 }
        }
      })
    }))
    setPointDragInfo({ ...emptyPointDragInfo })
		// onSave()
  }

	const onReleasePoint = () => {
		stopDrag();
		onSave();
	}

	const onDoubleClickAnchorPoint = (index: number) => {
		setSelectedPointIndex(index)
		setSelectedAnchorPointData({
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

	const onConfirmEditAnchorPoint = () => {
		if (selectedPointIndex == -1) {
			deselectAnchorPoint()
			return
		}

		store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
			curve: curve.map((c, i) => (
				i === selectedPointIndex ? {
					...selectedAnchorPointData
				} : c
			)).sort((a, b) => a.anchor.x - b.anchor.x)
    }))

		onSave()
		deselectAnchorPoint()
	}

	const onDeleteAnchorPoint = () => {
		if (selectedPointIndex == -1) {
			deselectAnchorPoint()
			return
		}

    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: curve.filter((_p, i) => i !== selectedPointIndex),
    }))

		onSave()
    deselectAnchorPoint()
	}

	const deselectAnchorPoint = () => {
		setSelectedPointIndex(-1)
		setSelectedAnchorPointData(dummyAnchor)
		setShowEditDialog(false)
	}

  /**
   * Create an SVG path from a list of normalized anchors and control points, and the size
   * of the area to draw it in.
   * @param points Array of AnchorPoint objects
   * @param width Destination area width
   * @param height Destination area height
   * @returns String representation of the corresponding SVG path
   */
  const createPath = (points: AnchorPoint[], width: number, height: number): string => {

    // turn normalized positions into concrete coordinates
    const calcPos = (p: Point): Point => ({
      x: p.x * width,
      y: p.y * height,
    })

    // Work out the full path in sections between two points, via their respective control points
    return points.reduce((path, { anchor, control_1 }, i, arr) => {
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
    : curve.map((v, i) => {
			const { index, start, position } = pointDragInfo
			const delta = { x: position.x - start.x, y: position.y - start.y }
      if (i === index) {
        const { anchor, control_1, control_2 } = v
        if (pointDragInfo.type === PointDragType.ANCHOR) {
          return {
            anchor: pointDragInfo.position,
            control_1: { x: control_1.x + delta.x, y: control_1.y + delta.y },
            control_2: { x: control_2.x + delta.x, y: control_2.y + delta.y },
          }
        } else {
          return {
            anchor,
            control_1: pointDragInfo.type === PointDragType.CONTROL_1
              ? { x: control_1.x + delta.x, y: control_1.y + delta.y }
              : pointDragInfo.type === PointDragType.CONTROL_2 && isShiftPressed
								? getMirroredControlPoint(anchor, { x: control_2.x + delta.x, y: control_2.y + delta.y })
								: control_1,
            control_2: pointDragInfo.type === PointDragType.CONTROL_2
              ? { x: control_2.x + delta.x, y: control_2.y + delta.y }
              : pointDragInfo.type === PointDragType.CONTROL_1 && isShiftPressed
							? getMirroredControlPoint(anchor, { x: control_1.x + delta.x, y: control_1.y + delta.y })
							: control_2,
          }
        }
      } else {
        return v
      }
    }
  )

  const playY = calculateValue(currentCurve, playPosition)

  return (
		<Editor
			onTrackClick={onTrackClick}
			onTrackDoubleClick={onTrackDoubleClick}
			onTrackDrag={onTrackDrag}
			onTrackRelease={onTrackRelease}
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
					{ currentCurve.map(({ anchor, control_1, control_2 }, i, _arr) => {
						let isSelected = selectedPointIndex == i || pointDragInfo.index == i
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
			<Dialog open={showEditDialog}>
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
		</Editor>
  )
}

export default CurveEditor
