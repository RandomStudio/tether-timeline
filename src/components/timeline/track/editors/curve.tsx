import React, { useLayoutEffect, useRef, useState } from "react"
import { store } from "@/redux/store"
import { updateCurve } from "@/redux/timeline/slice"
import { CurveTrack, Point } from "@/redux/timeline/types"
import { IconButton, Tooltip } from "@mui/material"
import DeleteIcon from '@mui/icons-material/Delete';
import { TrackProps } from ".."

import styles from "styles/components/timeline/track.module.scss"

interface DragInfo {
  index: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  minOffsetX: number
  maxOffsetX: number
  prevPoint: Point | null
  nextPoint: Point | null
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
  nextPoint: null
}

const lerp = (a: number, b: number, factor: number): number => (
  a * (1 - factor) + (b * factor)
)

const lerpPoint = (a: Point, b: Point, factor: number): Point => ({
  x: lerp(a.x, b.x, factor),
  y: lerp(a.y, b.y, factor)
})

const getPointBefore = (curve: Point[], position: number): Point => {
  const allBefore: Point[] = curve.filter(p => p.x < position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.x - b.x).pop()!
    : curve[0]
}

const getPointAfter = (curve: Point[], position: number): Point => {
  const allBefore: Point[] = curve.filter(p => p.x > position)
  return allBefore.length
    ? allBefore.sort((a, b) => a.x - b.x).shift()!
    : curve[curve.length - 1]
}

export const calculateValue = (curve: Point[], position: number) => {
  const prev = getPointBefore(curve, position)
  const next = getPointAfter(curve, position)
  return lerpPoint(prev, next, (position - prev.x) / (next.x - prev.x)).y
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

  const setPointY = (y: number) => {
    if (selectedPointIndex == -1) return
    if (isNaN(y)) return
    store.dispatch(updateCurve({
      trackId: id,
      curve: curve.map((p, i) => ({
        x: p.x,
        y: i === selectedPointIndex
          ? Math.max(0, Math.min(1, y))
          : p.y
      }))
    }))
  }

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
      xy = lerpPoint(lastBefore, firstAfter, (position - lastBefore.x) / (firstAfter.x - lastBefore.x))
    } else if (!lastBefore && firstAfter) {
      xy.y = firstAfter.y
    } else if (lastBefore && !firstAfter) {
      xy.y = lastBefore.y
    }

    store.dispatch(updateCurve({
      trackId: id,
      curve: [ ...curve, xy ].sort((a, b) => a.x - b.x)
    }))
  }

  const onGrabPoint = (event: React.MouseEvent<SVGCircleElement>, index: number) => {
    setSelectedPointIndex(index)
    const { x } = curve[index]
    const prev = getPointBefore(curve, curve[index].x)
    const next = getPointAfter(curve, curve[index].x)
    setDragInfo({
      index,
      startX: event.pageX,
      startY: event.pageY,
      offsetX: 0,
      offsetY: 0,
      minOffsetX: (prev.x - x) * width * scale,
      maxOffsetX: (next.x - x) * width * scale,
      prevPoint: prev,
      nextPoint: next
    })
  }

  const onDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragInfo.index > -1) {
      const { index, minOffsetX, maxOffsetX, startX, startY } = dragInfo
      const allowHDrag = index > 0 && index < curve.length - 1
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
    const { prevPoint, nextPoint } = dragInfo;
    store.dispatch(updateCurve({
      trackId: id,
      curve: curve.map((c, i) => (
        i === dragInfo.index
          ? {
              x: Math.max(prevPoint?.x || 0,
                Math.min(nextPoint?.x || 1,
                  c.x + dragInfo.offsetX / (width * scale)
                )
              ),
              y: c.y - (dragInfo.offsetY / height)
            }
          : c
      ))
    }))
    setDragInfo({ ...emptyDragInfo })
  }

  const createPath = (points: Point[], width: number, height: number): string => (
    // points.map(({x, y}, i, arr) => {
    //   const offset = dragInfo.index == i
    //     ? { x: dragInfo.offsetX, y: dragInfo.offsetY }
    //     : { x: 0, y: 0}
    //   return (i == 0 ? 'M' : 'L') + `${x * width + offset.x},${(1.0 - y) * height + offset.y}`
    // }).join(' ')
    points.reduce((path, {x, y}, i, arr) => {
      const offset = dragInfo.index == i
        ? { x: dragInfo.offsetX, y: dragInfo.offsetY }
        : { x: 0, y: 0}

      const p = {
        x: x * width + offset.x,
        y: (1.0 - y) * height + offset.y
      } as Point

      if (i === 0) {
        return `M${p.x},${p.y}`
      }

      const prev = {
        x: arr[i - 1].x * width,
        y: (1.0 - arr[i - 1].y) * height
      } as Point

      // if (i === 1) {
      //   return path + ` Q${lerp(prev.x, p.x, 0.75)},${lerp(prev.y, p.y, 0.75)} ${p.x},${p.y}`
      // }

      // if (i === arr.length - 1) {
      //   return path + ` Q${lerp(prev.x, p.x, 0.75)},${lerp(prev.y, p.y, 0.75)} ${p.x},${p.y}`
      // }

      return path + ` C${lerp(prev.x, p.x, 0.5)},${prev.y} ${lerp(prev.x, p.x, 0.5)},${p.y} ${p.x},${p.y}`
    }, '')
  )

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
            { curve.map(({x, y}, i) => {
              const isDragging = dragInfo.index == i;
              return (
                <circle
                  key={i}
                  fill={selectedPointIndex == i || dragInfo.index == i ? "#1976D2" : "#ffffff"}
                  stroke="#1976D2"
                  strokeWidth="1"
                  cx={x * width * scale + (isDragging ? dragInfo.offsetX : 0)}
                  cy={(1.0 - y) * height + (isDragging ? dragInfo.offsetY : 0)}
                  r="5"
                  cursor="pointer"
                  pointerEvents="all"
                  onMouseDown={e => onGrabPoint(e, i)}
                />
              )
            }) }
          </g>
        </svg>
        { selectedPointIndex > -1 && dragInfo.index === -1 && (
          <div
            className={ styles.pointTooltip }
            style={{
              left: `${bounds.x + curve[selectedPointIndex].x * width * scale - 18}px`,
              top: `${bounds.y + (1.0 - curve[selectedPointIndex].y) * height - 40}px`
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
