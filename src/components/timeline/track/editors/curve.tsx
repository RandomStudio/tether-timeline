import React, { useLayoutEffect, useRef, useState } from "react"
import { store } from "@/redux/store"
import { updateCurve } from "@/redux/timeline/slice"
import { AnchorPoint, CurveTrack, Point } from "@/redux/timeline/types"
import { IconButton, Tooltip } from "@mui/material"
import DeleteIcon from '@mui/icons-material/Delete';
import { TrackProps } from ".."

import styles from "styles/components/timeline/track.module.scss"
import { PointOfSale } from "@mui/icons-material"

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
  const allBefore: AnchorPoint[] = curve.filter(p => p.point.x < position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.point.x - b.point.x).pop()!
    : curve[0]
}

const getPointAfter = (curve: AnchorPoint[], position: number): AnchorPoint => {
  const allBefore: AnchorPoint[] = curve.filter(p => p.point.x > position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.point.x - b.point.x).shift()!
    : curve[curve.length - 1]
}

const curve = (a: number, b: number, c: number, d: number, t: number) => (
  Math.pow(1 - t, 3) * a +
    3 * Math.pow(1 - t, 2) * t * b +
    3 * (1 - t) * Math.pow(t, 2) * c +
    Math.pow(t, 3) * d
)

const bezier = (p1: Point, c1: Point, c2: Point, p2: Point, t: number) => ({
  x: curve(p1.x, c1.x, c2.x, p2.x, t),
  y: curve(p1.y, c1.y, c2.y, p2.y, t),
})

const findTForX = (p1: Point, c1: Point, c2: Point, p2: Point, targetX: number, precision: number = 0.0001): number => {
  const b = (t: number) => bezier(p1, c1, c2, p2, t).x
  let lower = 0, upper = 1
  let mid = lower + 0.5 * (upper - lower)
  let x = b(mid)
  let i = 0;
  while (Math.abs(targetX - x) > precision) {
    if (targetX > x) {
      lower = mid
    } else {
      upper = mid
    }
    mid = lower + 0.5 * (upper - lower)
    x = b(mid)
  }
  return mid
}

export const calculateValue = (curve: AnchorPoint[], position: number) => {
  const prev = getPointBefore(curve, position)
  const next = getPointAfter(curve, position)
  // const t = (position - prev.point.x) / (next.point.x - prev.point.x)
  const t = findTForX(prev.point, prev.control_2, next.control_1, next.point, position, 0.0001)
  return bezier(prev.point, prev.control_2, next.control_1, next.point, t).y
}

interface CurveEditorProps extends TrackProps {
  track: CurveTrack
}

const CurveEditor: React.FC<CurveEditorProps> = ({
  width,
  height,
  scale,
  duration,
  pxPerSecond,
  playPosition,
  track: { id, name, curve },
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

  // const setPointY = (y: number) => {
  //   if (selectedPointIndex == -1) return
  //   if (isNaN(y)) return
  //   store.dispatch(updateCurve({
  //     trackId: id,
  //     curve: curve.map((p, i) => ({
  //       x: p.point.x,
  //       y: i === selectedPointIndex
  //         ? Math.max(0, Math.min(1, y))
  //         : p.point.y
  //     }))
  //   }))
  // }

  const deletePoint = () => {
    if (selectedPointIndex == -1) return
    store.dispatch(updateCurve({
      trackId: id,
      curve: curve.filter((p, i) => i !== selectedPointIndex)
    }))
    setSelectedPointIndex(-1)
  }

  const onSingleClick = (event: React.MouseEvent<HTMLDivElement>) => {
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
      xy = lerpPoint(lastBefore.point, firstAfter.point, (position - lastBefore.point.x) / (firstAfter.point.x - lastBefore.point.x))
    } else if (!lastBefore && firstAfter) {
      xy.y = firstAfter.point.y
    } else if (lastBefore && !firstAfter) {
      xy.y = lastBefore.point.y
    }

    let c1 = {
      x: Math.max(lastBefore ? lastBefore.point.x : 0, position - 0.125),
      y: xy.y
    }
    let c2 = {
      x: Math.min(firstAfter ? firstAfter.point.x : 1, position + 0.125),
      y: xy.y
    }

    store.dispatch(updateCurve({
      trackId: id,
      curve: [
        ...curve,
        { point: xy, control_1: c1, control_2: c2 }
      ].sort((a, b) => a.point.x - b.point.x)
    }))
  }

  const onGrabPoint = (event: React.MouseEvent<SVGCircleElement>, index: number, type: DragPointType) => {
    setSelectedPointIndex(index)
    const { point, control_1, control_2 } = curve[index]
    const prev = getPointBefore(curve, point.x)
    const next = getPointAfter(curve, point.x)
    const minOffsetX = type === DragPointType.ANCHOR
      ? (prev.point.x - point.x) * width * scale
      : type === DragPointType.CONTROL_1
        ? (prev.point.x - control_1.x) * width * scale
        : (point.x - control_2.x) * width * scale
    const maxOffsetX = type === DragPointType.ANCHOR
      ? (next.point.x - point.x) * width * scale
      : type === DragPointType.CONTROL_1
        ? (point.x - control_1.x) * width * scale
        : (next.point.x - control_2.x) * width * scale
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

  const onRelease = (event: React.MouseEvent<HTMLDivElement>) => {
    const {index, prevPoint, nextPoint, offsetX, offsetY, type } = dragInfo;
    store.dispatch(updateCurve({
      trackId: id,
      curve: curve.map(({ point, control_1, control_2 }, i) => {
        if (i === index) {
          const p = type === DragPointType.ANCHOR
            ? {
              x: clamp(
                point.x + (offsetX / (width * scale)),
                prevPoint?.point.x || 0,
                nextPoint?.point.x || 1
              ),
              y: point.y - (offsetY / height)
            }
            : point
          const c1 = type === DragPointType.CONTROL_1
            ? {
              x: control_1.x + (offsetX / (width * scale)),
              y: control_1.y - (offsetY / height)
            }
            : {
              x: p.x + (control_1.x - point.x),
              y: p.y + (control_1.y - point.y),
            }
          const c2 = type === DragPointType.CONTROL_2
            ? {
              x: control_2.x + (offsetX / (width * scale)),
              y: control_2.y - (offsetY / height)
            }
            : {
              x: p.x + (control_2.x - point.x),
              y: p.y + (control_2.y - point.y),
            }
          return {
            point: p,
            control_1: c1,
            control_2: c2
          }
        } else {
          return { point, control_1, control_2 }
        }
      })
    }))
    setDragInfo({ ...emptyDragInfo })
  }

  const createPath = (points: AnchorPoint[], width: number, height: number): string => {

    const calcPos = (p: Point, isDragTarget: boolean = false): Point => ({
      x: p.x * width + (isDragTarget ? dragInfo.offsetX : 0),
      y: (1.0 - p.y) * height + (isDragTarget ? dragInfo.offsetY : 0),
    })

   return points.reduce((path, {point, control_1, control_2}, i, arr) => {
      const p = calcPos(point, dragInfo.index == i && dragInfo.type === DragPointType.ANCHOR)
      const cc = calcPos(control_1, dragInfo.index === i && dragInfo.type === DragPointType.CONTROL_1)

      if (i === 0) {
        return `M${p.x},${p.y}`
      }

      const prev = arr[i - 1]
      const pc = calcPos(prev.control_2, dragInfo.index === i - 1 && dragInfo.type === DragPointType.CONTROL_2)

      return path + ` C${pc.x},${pc.y} ${cc.x},${cc.y} ${p.x},${p.y}`
    }, '')
  }

  const playY = calculateValue(curve, playPosition)

  return (
    <div
        className={ styles.body }
        onDoubleClick={onDoubleClick}
        onMouseMove={onDrag}
        onMouseUp={onRelease}
        onMouseLeave={onRelease}
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
              d={createPath(curve, width * scale, height)}
            />
            { curve.map(({ point, control_1, control_2 }, i, arr) => {
              const isDragging = dragInfo.index == i;
              const p = {
                x: point.x * width * scale + (isDragging && dragInfo.type === DragPointType.ANCHOR ? dragInfo.offsetX : 0),
                y: (1.0 - point.y) * height + (isDragging && dragInfo.type === DragPointType.ANCHOR ? dragInfo.offsetY : 0)
              }
              const c1 = {
                x: control_1.x * width * scale + (isDragging && dragInfo.type === DragPointType.CONTROL_1 ? dragInfo.offsetX : 0),
                y: (1.0 - control_1.y) * height + (isDragging && dragInfo.type === DragPointType.CONTROL_1? dragInfo.offsetY : 0)
              }
              const c2 = {
                x: control_2.x * width * scale + (isDragging && dragInfo.type === DragPointType.CONTROL_2 ? dragInfo.offsetX : 0),
                y: (1.0 - control_2.y) * height + (isDragging && dragInfo.type === DragPointType.CONTROL_2 ? dragInfo.offsetY : 0)
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
              left: `${bounds.x + curve[selectedPointIndex].point.x * width * scale - 18}px`,
              top: `${bounds.y + (1.0 - curve[selectedPointIndex].point.y) * height - 40}px`
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
