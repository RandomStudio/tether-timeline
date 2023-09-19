import { store } from '@/redux/store';
import { updateCurve } from '@/redux/timeline/slice';
import { AnchorPoint, Point, Track } from '@/redux/timeline/types';
import DeleteIcon from '@mui/icons-material/Delete';
import { IconButton } from '@mui/material';
import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import { TrackProps } from '..';
import { cubicBezier, findTForX } from '../../../../utils/bezier-helper';

enum DragPointType {
  ANCHOR,
  CONTROL_1,
  CONTROL_2,
}

interface DragInfo {
  index: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  minOffsetX: number
  maxOffsetX: number
  prevPoint: AnchorPoint | null
  nextPoint: AnchorPoint | null
  type: DragPointType
}

const emptyDragInfo: DragInfo = {
  index: -1,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
  minOffsetX: 0,
  maxOffsetX: 0,
  prevPoint: null,
  nextPoint: null,
  type: DragPointType.ANCHOR
}

const clamp = (a: number, min: number, max: number) => (
  Math.max(min, Math.min(max, a))
)

const lerp = (a: number, b: number, factor: number): number => (
  a * (1 - factor) + (b * factor)
)

const lerpPoint = (a: Point, b: Point, factor: number): Point => ({
  x: lerp(a.x, b.x, factor),
  y: lerp(a.y, b.y, factor)
})

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

interface CurveEditorProps extends TrackProps {
  track: Track,
}

const CurveEditor: React.FC<CurveEditorProps> = ({
  width,
  height,
  scale,
  pxPerSecond,
  playPosition,
  track: { name, curve },
	onSave,
}) => {
  const ref = useRef(null)

  const [ bounds, setBounds ] = useState({ x: 0, y: 0 })
  const [ selectedPointIndex, setSelectedPointIndex ] = useState(-1)
  const [ dragInfo, setDragInfo ] = useState<DragInfo>({ ...emptyDragInfo })

  useLayoutEffect(() => {
    if (ref.current) {
      //@ts-ignore
      const { left, top } = ref.current.getBoundingClientRect() || { left: 0 }
      setBounds({
        x: left,
        y: top
      });
    }
  }, []);

  const deletePoint = () => {
    if (selectedPointIndex == -1) return
    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: curve.filter((_p, i) => i !== selectedPointIndex)
    }))
    setSelectedPointIndex(-1)
		onSave()
  }

  const onSingleClick = (_event: React.MouseEvent<HTMLDivElement>) => {
    setSelectedPointIndex(-1)
  }

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX } = event
    const scrollLeft = (event.currentTarget as HTMLDivElement).parentElement?.parentElement?.parentElement?.scrollLeft || 0
    const position = (clientX + scrollLeft - bounds.x) / (width * scale)
    const lastBefore = getPointBefore(curve, position)
    const firstAfter = getPointAfter(curve, position)

    let xy = { x: position, y: 0.5 }

    if (lastBefore && firstAfter) {
      xy = lerpPoint(lastBefore.anchor, firstAfter.anchor, (position - lastBefore.anchor.x) / (firstAfter.anchor.x - lastBefore.anchor.x))
    } else if (!lastBefore && firstAfter) {
      xy.y = firstAfter.anchor.y
    } else if (lastBefore && !firstAfter) {
      xy.y = lastBefore.anchor.y
    }

    let c1 = {
      x: Math.max(lastBefore ? lastBefore.anchor.x : 0, position - 0.125),
      y: xy.y
    }
    let c2 = {
      x: Math.min(firstAfter ? firstAfter.anchor.x : 1, position + 0.125),
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

  const onGrabPoint = (event: React.MouseEvent<SVGCircleElement>, index: number, type: DragPointType) => {
    setSelectedPointIndex(index)
    const { anchor, control_1, control_2 } = curve[index]
    const prev = getPointBefore(curve, anchor.x)
    const next = getPointAfter(curve, anchor.x)
    const minOffsetX = type === DragPointType.ANCHOR
      ? (prev.anchor.x - anchor.x) * width * scale
      : type === DragPointType.CONTROL_1
        ? (prev.anchor.x - control_1.x) * width * scale
        : (anchor.x - control_2.x) * width * scale
    const maxOffsetX = type === DragPointType.ANCHOR
      ? (next.anchor.x - anchor.x) * width * scale
      : type === DragPointType.CONTROL_1
        ? (anchor.x - control_1.x) * width * scale
        : (next.anchor.x - control_2.x) * width * scale
    setDragInfo({
      index,
      startX: event.pageX,
      startY: event.pageY,
      offsetX: 0,
      offsetY: 0,
      minOffsetX,
      maxOffsetX,
      prevPoint: prev,
      nextPoint: next,
      type
    })
  }

  const onDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragInfo.index > -1) {
      const { index, minOffsetX, maxOffsetX, startX, startY, type } = dragInfo
      const allowHDrag = type !== DragPointType.ANCHOR || (index > 0 && index < curve.length - 1)
      setDragInfo({
        ...dragInfo,
        offsetX: allowHDrag
          ? Math.max(minOffsetX,
              Math.min(maxOffsetX,
                event.pageX - startX
              )
            )
          : 0,
        offsetY: event.pageY - startY
      })
    }
  }

	const stopDrag = () => {
    const {index, prevPoint, nextPoint, offsetX, offsetY, type } = dragInfo;
    store.dispatch(updateCurve({
			timeline: store.getState().selectedTimeline || '',
      track: name,
      curve: curve.map(({ anchor, control_1, control_2 }, i) => {
        if (i === index) {
          const p = type === DragPointType.ANCHOR
            ? {
              x: clamp(
                anchor.x + (offsetX / (width * scale)),
                prevPoint?.anchor.x || 0,
                nextPoint?.anchor.x || 1
              ),
              y: anchor.y - (offsetY / height)
            }
            : anchor
          const c1 = type === DragPointType.CONTROL_1
            ? {
              x: control_1.x + (offsetX / (width * scale)),
              y: control_1.y - (offsetY / height)
            }
            : {
              x: p.x + (control_1.x - anchor.x),
              y: p.y + (control_1.y - anchor.y),
            }
          const c2 = type === DragPointType.CONTROL_2
            ? {
              x: control_2.x + (offsetX / (width * scale)),
              y: control_2.y - (offsetY / height)
            }
            : {
              x: p.x + (control_2.x - anchor.x),
              y: p.y + (control_2.y - anchor.y),
            }
          return {
            anchor: p,
            control_1: c1,
            control_2: c2
          }
        } else {
          return { anchor, control_1, control_2 }
        }
      })
    }))
    setDragInfo({ ...emptyDragInfo })
		onSave()
  }

	const onRelease = (_event: React.MouseEvent<HTMLDivElement>) => {
		stopDrag();
	}

	const onMouseLeave = (_event: React.MouseEvent<HTMLDivElement>) => {
		const doSave = dragInfo.index > -1;
		stopDrag();
		if (doSave) {
			onSave();
		}
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
      y: (1.0 - p.y) * height,
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

  // Define the current curve by applying any offsets that are the result of dragging anchor or control points
  const currentCurve = dragInfo.index < 0
    ? curve
    : curve.map((v, i) => {
      if (i === dragInfo.index) {
        const { anchor, control_1, control_2 } = v
        const offset = {
          x: dragInfo.offsetX / width,
          y: dragInfo.offsetY / height
        }
        if (dragInfo.type === DragPointType.ANCHOR) {
          return {
            anchor: { x: anchor.x + offset.x, y: anchor.y - offset.y },
            control_1: { x: control_1.x + offset.x, y: control_1.y - offset.y },
            control_2: { x: control_2.x + offset.x, y: control_2.y - offset.y },
          }
        } else {
          return {
            anchor,
            control_1: dragInfo.type === DragPointType.CONTROL_1
              ? { x: control_1.x + offset.x, y: control_1.y - offset.y }
              : control_1,
            control_2: dragInfo.type === DragPointType.CONTROL_2
              ? { x: control_2.x + offset.x, y: control_2.y - offset.y }
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
    <div
        className={ styles.body }
        onDoubleClick={onDoubleClick}
        onMouseMove={onDrag}
        onMouseUp={onRelease}
        onMouseLeave={onMouseLeave}
        style={{ height: `${height}px`, }}
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
        <svg
          width={width * scale}
          height={height}
          viewBox={`0, 0, ${width * scale}, ${height}`}
          pointerEvents="none"
        >
          <g>
            <line
              fill="none"
              stroke="#000000"
              strokeOpacity={0.3}
              x1={0}
              y1={(1.0 - playY) * height}
              x2={width * scale}
              y2={(1.0 - playY) * height}
            />
            <path
              fill="none"
              stroke="#1976D2"
              strokeWidth="1"
              d={createPath(currentCurve, width * scale, height)}
            />
            { currentCurve.map(({ anchor, control_1, control_2 }, i, _arr) => {
              const p = {
                x: anchor.x * width * scale,
                y: (1.0 - anchor.y) * height,
              }
              const c1 = {
                x: control_1.x * width * scale,
                y: (1.0 - control_1.y) * height,
              }
              const c2 = {
                x: control_2.x * width * scale,
                y: (1.0 - control_2.y) * height,
              }
              return (
                <React.Fragment key={i}>
                  <line
                    stroke="rgba(25, 118, 210, 0.5)" strokeWidth="1"
                    x1={c1.x} y1={c1.y} x2={p.x} y2={p.y}
                  />
                  <line
                    stroke="rgba(25, 118, 210, 0.5)" strokeWidth="1"
                    x1={p.x} y1={p.y} x2={c2.x} y2={c2.y}
                  />
                  <circle
                    fill={selectedPointIndex == i || dragInfo.index == i ? "#1976D2" : "#ffffff"}
                    stroke="#1976D2" strokeWidth="1"
                    cx={p.x} cy={p.y} r="5"
                    cursor="pointer" pointerEvents="all" onMouseDown={e => onGrabPoint(e, i, DragPointType.ANCHOR)}
                  />
                  <circle
                    fill="rgba(25, 118, 210, 0.5)"
                    stroke="rgba(25, 118, 210, 0.5)" strokeWidth="1"
                    cx={c1.x} cy={c1.y} r="3"
                    cursor="pointer" pointerEvents="all" onMouseDown={e => onGrabPoint(e, i, DragPointType.CONTROL_1)}
                  />
                  <circle
                    fill="rgba(25, 118, 210, 0.5)"
                    stroke="rgba(25, 118, 210, 0.5)" strokeWidth="1"
                    cx={c2.x} cy={c2.y} r="3"
                    cursor="pointer" pointerEvents="all" onMouseDown={e => onGrabPoint(e, i, DragPointType.CONTROL_2)}
                  />
                </React.Fragment>
              )
            }) }
          </g>
        </svg>
        { selectedPointIndex > -1 && dragInfo.index === -1 && (
          <div
            className={ styles.pointTooltip }
            style={{
              left: `${bounds.x + currentCurve[selectedPointIndex].anchor.x * width * scale - 18}px`,
              top: `${bounds.y + (1.0 - currentCurve[selectedPointIndex].anchor.y) * height - 40}px`
            }}
          >
            <IconButton size="small" onClick={deletePoint}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
        )}
      </div>
  )
}

export default CurveEditor
