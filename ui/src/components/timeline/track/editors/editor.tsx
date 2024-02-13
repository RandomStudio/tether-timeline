import { Point } from '@/redux/timeline/types';
import { MouseEvent, PropsWithChildren, useEffect, useState } from 'react';
import styles from 'styles/components/timeline/track.module.scss';

import { TrackProps } from '../track';

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
	showDragRect: boolean,
	onTrackClick: (position: Point) => void,
	onTrackDoubleClick: (position: Point) => void,
	onTrackPress: (position: Point) => void,
	onTrackDrag: (start: Point, position: Point) => void,
	onTrackRelease: (position: Point) => void,
	onKeyDown?: (event: KeyboardEvent) => void,
}

const Editor = ({
	trackProps,
	showDragRect,
	onTrackClick,
	onTrackDoubleClick,
	onTrackPress,
	onTrackDrag,
	onTrackRelease,
	onKeyDown,
	children,
}: EditorProps) => {

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

	useEffect(() => {
		if (onKeyDown) {
			console.log('Registering key down listener')
			window.addEventListener('keydown', onKeyDown)
			return () => {
				window.removeEventListener('keydown', onKeyDown)
			}
		}
	}, [onKeyDown])

	const handleSingleClick = (event: MouseEvent<HTMLDivElement>) => {
		onTrackClick(getMouseEventPosition(event, width * scale, height))
  }

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
		onTrackDoubleClick(getMouseEventPosition(event, width * scale, height))
	}

	const onMouseDownBg = (event: MouseEvent<HTMLDivElement>) => {
		const position = getMouseEventPosition(event, width * scale, height)
		onTrackPress(position)
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

	const frameWidth = pxPerSecond * scale / 60;

	return (
		<div
			className={ `${styles.body} editor` }
			onDoubleClick={handleDoubleClick}
			onMouseDown={onMouseDown}
			onMouseMove={onMouseMove}
			onMouseUp={onMouseUp}
			onMouseLeave={onMouseLeave}
			style={{
				height: `${height}px`,
				background: `repeating-linear-gradient(
					to right,
					#eee 0px,
					#eee ${frameWidth}px,
					transparent ${frameWidth + 1}px,
					transparent ${2 * frameWidth}px
				)`
			}}
		>
			<div
				className={ styles.bg }
				style={{
					background: `repeating-linear-gradient(
						to right,
						#bbb 0px,
						#bbb 1px,
						transparent 1px,
						transparent ${pxPerSecond * scale}px
					)`
				}}
				onMouseDown={onMouseDownBg}
				onClick={handleSingleClick}
			>
				{ showDragRect && (
					<div
						className={ styles.dragRect }
						style={{
							left: `${Math.min(dragStart.x, dragPosition.x) * width * scale}px`,
							top: `${Math.min(dragStart.y, dragPosition.y) * height}px`,
							width: `${Math.abs(dragPosition.x - dragStart.x) * width * scale}px`,
							height: `${Math.abs(dragPosition.y - dragStart.y) * height}px`,
						}}
					/>
				)}
			</div>
			<div className={ styles.playhead } style={{ left: `${playPosition * width * scale}px` }} />
			{ children }
		</div>
	)
}

export default Editor
