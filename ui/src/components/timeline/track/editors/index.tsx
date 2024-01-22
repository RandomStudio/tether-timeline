import { Point } from '@/redux/timeline/types';
import { FC, MouseEvent, PropsWithChildren, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import { TrackProps } from '..';

export const getMouseEventPosition = (event: MouseEvent<HTMLDivElement | SVGElement>, trackWidth: number, trackHeight: number): Point => {
	const { pageX, pageY } = event
	const container = (event.currentTarget as HTMLDivElement).closest('.scroll_container')
	const containerRect = container?.getBoundingClientRect()
	const editor = (event.currentTarget as HTMLDivElement).closest('.editor')
	const editorRect = editor?.getBoundingClientRect()
	const scrollLeft = container?.scrollLeft || 0
	return {
		x: (pageX + scrollLeft - (containerRect?.left || 0)) / trackWidth,
		y: (pageY - (editorRect?.top || 0)) / trackHeight,
	}
}

interface EditorProps extends PropsWithChildren {
	trackProps: TrackProps,
	onTrackClick: (position: Point) => void,
	onTrackDoubleClick: (position: Point) => void,
	onTrackDrag: (start: Point, position: Point) => void,
	onTrackRelease: (position: Point) => void,
}

const Editor: FC<EditorProps> = ({
	trackProps,
	onTrackClick,
	onTrackDoubleClick,
	onTrackDrag,
	onTrackRelease,
	children,
}) => {

	const {
		width,
		height,
		scale,
		pxPerSecond,
		playPosition
	} = trackProps

	const [ isDragging, setIsDragging ] = useState(false)
	const [ dragStart, setDragStart ] = useState<Point>({ x: 0, y: 0 })
	const [ dragPosition, setDragPosition ] = useState<Point>({ x: 0, y: 0 })

	const handleSingleClick = (event: MouseEvent<HTMLDivElement>) => {
		onTrackClick(getMouseEventPosition(event, width * scale, height))
  }

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
		onTrackDoubleClick(getMouseEventPosition(event, width * scale, height))
	}

	const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
		const position = getMouseEventPosition(event, width * scale, height)
		setDragStart(position)
		setDragPosition(position)
		setIsDragging(true)
	}

	const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
		if (isDragging) {
			setDragPosition(getMouseEventPosition(event, width * scale, height))
			onTrackDrag(dragStart, dragPosition)
		}
	}

	const onMouseUp = (event: MouseEvent<HTMLDivElement>) => {
		if (isDragging) {
			onTrackRelease(getMouseEventPosition(event, width * scale, height))
			setIsDragging(false)
		}
	}

	const onMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
		if (isDragging) {
			onTrackRelease(getMouseEventPosition(event, width * scale, height))
			setIsDragging(false)
		}
	}

	return (
		<div
			className={ `${styles.body} editor` }
			onDoubleClick={handleDoubleClick}
			onMouseDown={onMouseDown}
			onMouseMove={onMouseMove}
			onMouseUp={onMouseUp}
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
				onClick={handleSingleClick}
			/>
			<div className={ styles.playhead } style={{ left: `${playPosition * width * scale}px` }} />
			{ children }
		</div>
	)
}

export default Editor
