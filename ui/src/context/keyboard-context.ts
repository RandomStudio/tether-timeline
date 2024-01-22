import { createContext } from 'react';

export interface ModifierKeys {
	isAltKeyPressed: boolean
	isCtrlKeyPressed: boolean
	isShiftKeyPressed: boolean
}

export const KeyboardContext = createContext<ModifierKeys>({
	isAltKeyPressed: false,
	isCtrlKeyPressed: false,
	isShiftKeyPressed: false
})
