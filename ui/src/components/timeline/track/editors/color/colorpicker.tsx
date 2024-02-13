import { RGBFloat } from '@/redux/timeline/types';
import { Slider } from '@mui/material';
import convert from 'color-convert';
import React, { useRef, useState } from 'react';
import { MouseEvent, TouchEvent } from 'react';
import styles from 'styles/components/timeline/colorpicker.module.scss';

export const RGBFloatToCSSString = (color: RGBFloat): string => (
	`rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`
)

enum PickEventType {
	PRESS,
	DRAG,
	RELEASE,
}

interface ColorPickerProps {
  color: RGBFloat;
  onChange: (color: RGBFloat) => void;
  onRelease?: () => void;
  enabled: boolean;
}

const clamp = (value: number, min: number, max: number): number => (
	Math.max(min, Math.min(max, value))
);

const ColorPicker = ({ color, onChange, onRelease, enabled }: ColorPickerProps) => {
  const satFieldRef = useRef<HTMLDivElement>(null);

  const [ isDraggingSaturation, setIsDraggingSaturation ] = useState<boolean>(false);
	const [ alpha, setAlpha ] = useState<number>(color.a);

  const onMouseSaturation = (e: MouseEvent | TouchEvent) => {
    switch (e.type) {
      case 'mousedown':
        pickSaturation(
          PickEventType.PRESS,
          (e as React.MouseEvent).clientX,
          (e as React.MouseEvent).clientY
        );
        break;
      case 'mousemove':
        pickSaturation(
          PickEventType.DRAG,
          (e as React.MouseEvent).clientX,
          (e as React.MouseEvent).clientY
        );
        break;
      case 'mouseup':
      case 'mouseleave':
        pickSaturation(PickEventType.RELEASE);
        break;
      case 'touchstart':
        pickSaturation(
          PickEventType.PRESS,
          (e as TouchEvent).touches[0].clientX,
          (e as TouchEvent).touches[0].clientY
        );
        break;
      case 'touchmove':
        pickSaturation(
          PickEventType.DRAG,
          (e as TouchEvent).touches[0].clientX,
          (e as TouchEvent).touches[0].clientY
        );
        break;
      case 'touchend':
        pickSaturation(PickEventType.RELEASE);
        break;
      default:
        //
    }
  }

  const pickSaturation = (type: PickEventType, aX = 0, aY = 0) => {
    if (satFieldRef.current) {
      switch (type) {
        case PickEventType.PRESS:
          setIsDraggingSaturation(true);
          pickSaturation(PickEventType.DRAG, aX, aY);
          break;
        case PickEventType.DRAG:
          {
            if (isDraggingSaturation) {
              const {
                left, top, width, height
              } = satFieldRef.current.getBoundingClientRect();
              const x = Math.max(0.0, Math.min(1.0, (aX - left) / width));
              const y = Math.max(0.0, Math.min(1.0, (aY - top) / height));
              setSaturationBrightness(Math.round(x * 100), Math.round((1 - y) * 100));
            }
          }
          break;
        case PickEventType.RELEASE:
        default:
        {
          if (isDraggingSaturation) {
            setIsDraggingSaturation(false);
            if (onRelease) onRelease();
          }
        }
      }
    }
  }

  const setHue = (hue: number) => {
    const hsv = convert.rgb.hsv([ Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255) ]);
    const [v, s] = hsv.reverse();
		const [ r, g, b ] = convert.hsv.rgb([hue, s, v]);
    onChange({ r: r / 255, g: g / 255, b: b / 255, a: alpha });
  }

  const setSaturationBrightness = (saturation: number, brightness: number) => {
    const hsv = convert.rgb.hsv([ Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255) ]);
    const [h] = hsv;
		const [ r, g, b ] = convert.hsv.rgb([h, saturation, brightness]);
    onChange({ r: r / 255, g: g / 255, b: b / 255, a: alpha });
  }

	const selectAlpha = (alpha: number) => {
		setAlpha(clamp(alpha, 0, 1));
		onChange({ ...color, a: clamp(alpha, 0, 1) });
	}

	const onUpdateChannel = (r: number, g: number, b: number) => {
		console.log(r, g, b)
		if (!Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b)) {
			console.warn(`Ignoring invalid color values:`, r, g, b);
			return;
		}
		onChange({
			r: clamp(r, 0, 255) / 255,
			g: clamp(g, 0, 255) / 255,
			b: clamp(b, 0, 255) / 255,
			a: alpha
		});
	}

  const [h, s, v] = convert.rgb.hsv([ Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255) ]);
  const [r, g, b] = convert.hsv.rgb([h, 100, 100]);

  return (
    <div className={`${styles.colorPicker}${enabled ? '' : ' disabled'}`}>
      <div
        className={styles.field}
        ref={satFieldRef}
        style={{
          backgroundColor: `rgb(${r},${g},${b})`
        }}
        onMouseDown={onMouseSaturation}
        onMouseMove={onMouseSaturation}
        onMouseUp={onMouseSaturation}
        onMouseLeave={onMouseSaturation}
        onTouchStart={onMouseSaturation}
        onTouchMove={onMouseSaturation}
        onTouchEnd={onMouseSaturation}
      >
        <div className={`${styles.bg} ${styles.hor}`} />
        <div className={`${styles.bg} ${styles.ver}`} />
        <div
          className={styles.handle}
          style={{
            left: `${s}%`,
            top: `${100 - v}%`
          }}
        />
      </div>
      <Slider
        className="hueSlider"
        min={0}
        max={360}
        step={0.001}
				value={h}
        onChange={(_e, v) => setHue(v as number)}
      />
			<Slider
				className={styles.alphaSlider}
				min={0}
				max={1}
				step={0.001}
				value={alpha}
				onChange={(_e, v) => selectAlpha(v as number)}
			/>
      <div className={styles.selection}>
        <div className={styles.swatch}>
					<div style={{ width: '100%', height: '100%', backgroundColor: RGBFloatToCSSString(color) }} />
				</div>
        <div className={styles['rgb-labels']}>
          <span>
            R:
						<input
							type="number"
							min={0}
							max={255}
							value={Math.round(color.r * 255)}
							width={5}
							onChange={e => onUpdateChannel(
								Number.parseInt(e.target.value),
								Math.round(color.g * 255),
								Math.round(color.b * 255)
							)}
						/>
          </span>
          <span>
            G:
						<input
							type="number"
							min={0}
							max={255}
							value={Math.round(color.g * 255)}
							width={5}
							onChange={e => onUpdateChannel(
								Math.round(color.r * 255),
								Number.parseInt(e.target.value),
								Math.round(color.b * 255)
							)}
						/>
          </span>
          <span>
            B:
						<input
							type="number"
							min={0}
							max={255}
							value={Math.round(color.b * 255)}
							width={5}
							onChange={e => onUpdateChannel(
								Math.round(color.r * 255),
								Math.round(color.g * 255),
								Number.parseInt(e.target.value)
							)}
						/>
          </span>
          <span>
						A:
						<input
							type="number"
							min={0}
							max={1}
							step={0.001}
							value={alpha.toPrecision(3)}
							width={5}
							onChange={e => selectAlpha(
								Number.parseFloat(e.target.value)
							)}
						/>
          </span>
        </div>
      </div>
    </div>
  );
}

export default ColorPicker;
