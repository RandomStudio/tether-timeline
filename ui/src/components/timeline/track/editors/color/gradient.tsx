import { ColorStop } from '@/redux/timeline/types';
import styles from 'styles/components/timeline/track.module.scss';

import { RGBFloatToCSSString } from './colorpicker';

interface Props {
	colors: ColorStop[]
}

const Gradient = ({ colors }: Props) => (
	<div className={styles.gradient}>
		<div style={{
			width: '100%',
			height: '100%',
			background: !colors.length
				? 'rgba(0, 0, 0, 0)' : colors.length === 1
					? RGBFloatToCSSString(colors[0].color)
					: `linear-gradient(90deg, ${
						colors
							.map(c => c)
							.sort((a, b) => a.position - b.position)
							.map(({ position, color }) => (
								`${RGBFloatToCSSString(color)} ${position * 100}%`
							)).join(', ')
						})`
			}}
		/>
	</div>
)

export default Gradient
