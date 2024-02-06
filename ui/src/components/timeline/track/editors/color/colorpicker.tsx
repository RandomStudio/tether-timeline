import { RGBFloat } from '@/redux/timeline/types';
import { Slider } from '@mui/material';
import convert from 'color-convert';
import React, { useRef, useState } from 'react';
import { MouseEvent, TouchEvent } from 'react';
import styles from 'styles/components/timeline/colorpicker.module.scss';

export const RGBFloatToNumber = (color: RGBFloat): number => {
	const { r, g, b } = color;
	return ((r * 255) << 16) | ((g * 255) << 8) | (b * 255);
}

export const RGBFloatToHexString = (color: RGBFloat): string => (
	numberToHexString(RGBFloatToNumber(color))
)

export const numberToRGBFloat = (color: number): RGBFloat => ({
	r: (color >> 16 & 0xFF) / 0xFF,
	g: (color >> 8 & 0xFF) / 0xFF,
	b: (color & 0xFF) / 0xFF,
})

export const numberToHexString = (color: number) => (
	`#${color.toString(16).padStart(6, '0')}`
)

enum PickEventType {
	PRESS,
	DRAG,
	RELEASE,
}

interface ColorPickerProps {
  color: number;
  onChange: (value: number) => void;
  onRelease?: () => void;
  enabled: boolean;
}

const ColorPicker = ({ color, onChange, onRelease, enabled }: ColorPickerProps) => {
  const satFieldRef = useRef<HTMLDivElement>(null);

  const [ isDraggingSaturation, setIsDraggingSaturation ] = useState<boolean>(false);

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
    const hsv = convert.hex.hsv(color.toString(16));
    const [v, s] = hsv.reverse();
    onChange(parseInt(convert.hsv.hex([hue, s, v]), 16));
  }

  const setSaturationBrightness = (saturation: number, brightness: number) => {
    const hsv = convert.hex.hsv(color.toString(16));
    const [h] = hsv;
    onChange(parseInt(convert.hsv.hex([h, saturation, brightness]), 16));
  }

  const [h, s, v] = convert.hex.hsv(color.toString(16));
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
        onChange={(_e, v) => setHue(v as number)}
      />
      <div className={styles.selection}>
        <div className={styles.swatch} style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }} />
        <div className={styles['rgb-labels']}>
          <span>
            R:
            {(color >> 16) & 0xFF}
          </span>
          <span>
            G:
            {(color >> 8) & 0xFF}
          </span>
          <span>
            B:
            {color & 0xFF}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ColorPicker;
