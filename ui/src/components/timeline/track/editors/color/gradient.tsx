import { ColorStop } from '@/redux/timeline/types';
import styles from 'styles/components/timeline/track.module.scss';

import { RGBFloatToHexString } from './colorpicker';

interface Props {
	colors: ColorStop[]
}

const Gradient = ({ colors }: Props) => (
	<div
		className={styles.gradient}
		style={{
			background: !colors.length
				? 'black' : colors.length === 1
					? RGBFloatToHexString(colors[0].color)
					: `linear-gradient(90deg, ${
						colors
							.map(c => c)
							.sort((a, b) => a.position - b.position)
							.map(({ position, color }) => (
								`${RGBFloatToHexString(color)} ${position * 100}%`
							)).join(', ')
						})`
		}}
	/>
)

export default Gradient
