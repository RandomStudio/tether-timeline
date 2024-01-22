import { EventTrigger } from '@/redux/timeline/types';
import LabelIcon from '@mui/icons-material/Label';
import React from 'react';
import styles from 'styles/components/timeline/track.module.scss';

interface EventHandleProps extends EventTrigger {
	selected: boolean,
	onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void,
	onClick: () => void,
	onDoubleClick: () => void,
}

const EventHandle: React.FC<EventHandleProps> = ({
	position,
	selected,
	onMouseDown,
	onClick,
	onDoubleClick,
}) => (
	<div
		className={styles.event}
		style={{ left: `${position * 100}%` }}
		onMouseDown={onMouseDown}
		onClick={onClick}
		onDoubleClick={e => {
			e.stopPropagation();
			onDoubleClick();
		}}
	>
		<LabelIcon className={`${styles.label} ${selected ? styles.selected : ''}`} />
	</div>
)

export default EventHandle;
