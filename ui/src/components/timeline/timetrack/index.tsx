import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from 'styles/components/timeline/timetrack.module.scss';

export interface TimeTrackProps {
  width: number
  scale: number
  duration: number
  pxPerSecond: number
  position: number
  onSelectPosition: Function
}

const TimeTrack: React.FC<TimeTrackProps> = ({
  scale,
  duration,
  pxPerSecond,
  position,
  onSelectPosition
}) => {
  const ref = useRef<HTMLDivElement>(null)

  const width = duration * pxPerSecond

  useLayoutEffect(() => {
    if (ref.current) {
      //@ts-ignore
      const { left } = ref.current.getBoundingClientRect() || { left: 0 }
      setX(left)
    }
  }, []);

  const [x, setX] = useState(0)

  const press = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX } = event
    const scrollLeft = ref.current?.parentElement?.parentElement?.scrollLeft || 0
    select((clientX + scrollLeft - x) / (width * scale))
    window.onmousemove = e => move(e)
    window.onmouseup = window.onmouseleave = e => release(e)
  }

  const move = (event: MouseEvent) => {
    const { clientX } = event
    const scrollLeft = ref.current?.parentElement?.parentElement?.scrollLeft || 0
    select((clientX + scrollLeft - x) / (width * scale))
  }

  const release = (_event: MouseEvent) => {
    window.onmousemove = null
    window.onmouseup = window.onmouseleave = null
  }

  const select = (pos: number) => {
    onSelectPosition(Math.max(0, Math.min(1, pos)))
  }

  const generateTimecodeLabels = () => {
    if (scale > 0.6) {
      return new Array(duration).fill(0).map((_v, i) => (
        createTimecodeElement(i + 1)
      ))
    } else if (scale > 0.35) {
      return new Array(Math.ceil(duration / 2)).fill(0).map((_v, i) => (
        createTimecodeElement(i * 2 + 1)
      ))
    } else if(scale > 0.15) {
      return new Array(duration / 5).fill(0).map((_v, i) => (
        createTimecodeElement(i * 5 + 5)
      ))
    } else if (scale > 0.06) {
      return new Array(duration / 10).fill(0).map((_v, i) => (
        createTimecodeElement(i * 10 + 10)
      ))
    } else if (scale > 0.01) {
      return new Array(duration / 30).fill(0).map((_v, i) => (
        createTimecodeElement(i * 30 + 30)
      ))
    } else {
			return new Array(duration / 60).fill(0).map((_v, i) => (
        createTimecodeElement(i * 60 + 60)
      ))
		}
  }

  const createTimecodeElement = (seconds: number) => (
    <div key={`${seconds}-sec`} className={ styles.timecode } style={{
      left: `${seconds * pxPerSecond * scale}px`,
    }}>
      <span>{ formatTimecode(seconds) }</span>
    </div>
  )

  const formatTimecode = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = seconds - 60 * min;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div
      ref={ref}
      className={ styles.timetrack }
      onMouseDown={press}
      style={{ width: `${width * scale}px` }}
    >
      <div
        className={ `${styles.ticks} ${styles.large}` }
        style={{
          background: `repeating-linear-gradient(
            to right,
            black 0px,
            black 1px,
            transparent 1px,
            transparent ${pxPerSecond * scale}px
          )`
        }}
      />
			{ scale > 0.15 && (
				<div
					className={ `${styles.ticks} ${styles.small}` }
					style={{
						left: `${0.5 * pxPerSecond * scale}px`,
						background: `repeating-linear-gradient(
							to right,
							black 0px,
							black 1px,
							transparent 1px,
							transparent ${pxPerSecond * scale}px
						)`
					}}
				/>
			)}
      <div className={ styles.playhead } style={{ left: `${position * width * scale}px` }} />
      <div className={ `${styles.timecodes} ${styles.shadow}` }>
        { generateTimecodeLabels() }
      </div>
      <div className={ styles.timecodes }>
        { generateTimecodeLabels() }
      </div>
    </div>
  )
}

export default TimeTrack
