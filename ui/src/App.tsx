import { encode } from '@msgpack/msgpack';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
} from '@mui/material';
import { Output } from '@randomstudio/tether';
import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import styles from 'styles/app.module.scss';

import TimelineComponent from './components/timeline/timeline';
import { KeyboardContext, ModifierKeys } from './context/keyboard-context';
import { RootState, store } from './redux/store';
import { addTimeline, removeTimeline, renameTimeline, selectTimeline } from './redux/timeline/slice';

export interface AppProps {
  outPlugState: Output,
  outPlugSelectTimeline: Output,
  outPlugPlay: Output,
  outPlugPause: Output,
  outPlugSeek: Output,
}

const App: React.FC<AppProps> = ({
	outPlugState,
	outPlugSelectTimeline,
	outPlugPlay,
	outPlugPause,
	outPlugSeek,
}) => {
  const { timelines, selectedTimeline } = useSelector((state: RootState) => state)
  const timeline = timelines.find(t => t.name === selectedTimeline)

	const [ modifierKeys, setModifierKeys ] = useState<ModifierKeys>({
		isAltKeyPressed: false,
		isCtrlKeyPressed: false,
		isShiftKeyPressed: false,
	})
  const [ isEditingName, setIsEditingName ] = useState(false)
  const [ editableName, setEditableName ] = useState(timeline?.name || "")
	const [ isAddingTimeline, setIsAddingTimeline ] = useState(false)
	const [ addTimelineName, setAddTimelineName ] = useState('')
	const [ addTimelineDuration, setAddTimelineDuration ] = useState(10)
	const [ addTimelineFps, setAddTimelineFps ] = useState(60)
	const [ addTimelineLoop, setAddTimelineLoop ] = useState(true)

	const nameRef = useRef(null)
  const timelineRef = useRef<TimelineComponent>(null!)

	useEffect(() => {
		window.addEventListener('keydown', onKey)
		window.addEventListener('keyup', onKey)

		return () => {
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('keyup', onKey)
		}
	}, [])

	const onKey = (e: KeyboardEvent) => {
		setModifierKeys({
			isAltKeyPressed: e.altKey,
			isCtrlKeyPressed: e.ctrlKey,
			isShiftKeyPressed: e.shiftKey,
		})
	}

  const deleteTimeline = () => {
		if (selectedTimeline !== null) {
    	store.dispatch(removeTimeline(selectedTimeline))
		}
  }

  const setSelectedTimeline = (name: string) => {
    store.dispatch(selectTimeline(name))
		outPlugSelectTimeline.publish(Buffer.from(encode(store.getState().selectedTimeline)))
  }

  const editName = () => {
    setEditableName(timeline?.name || "")
    setIsEditingName(true)
  }

  const confirmName = () => {
    if (timeline) {
			const { name } = timeline
      store.dispatch(renameTimeline({oldName: name, newName: editableName}))
      setIsEditingName(false)
			onChangeTimeline()
    }
  }

	const onAddTimeline = () => {
		let i = timelines.length + 1;
		while (timelines.find(t => t.name === `Timeline ${i}`)) {
			i += 1
		}
		setAddTimelineName(`Timeline ${i}`)
		setAddTimelineDuration(10.0)
		setAddTimelineFps(60)
		setAddTimelineLoop(true)
		setIsAddingTimeline(true)
	}

	const onConfirmAddTimeline = () => {
		store.dispatch(
			addTimeline({
				name: addTimelineName,
				duration: addTimelineDuration,
				fps: addTimelineFps,
				loopPlayback: addTimelineLoop
			})
		)
		onChangeTimeline()
		setIsAddingTimeline(false)
	}

	const onChangeTimeline = () => {
		console.debug("Sending:", store.getState());
		outPlugState.publish(Buffer.from(encode(store.getState())));
	}

	const onPlayTimeline = () => {
		if (store.getState().selectedTimeline !== null) {
			outPlugPlay.publish(Buffer.from(encode(store.getState().selectedTimeline)));
		}
	}

	const onPauseTimeline = () => {
		outPlugPause.publish();
	}

	const onSeekTimeline = (position: number) => {
		if (store.getState().selectedTimeline !== null) {
			outPlugSeek.publish(Buffer.from(encode({ timeline: store.getState().selectedTimeline, position })));
		}
	}

  return (
		<KeyboardContext.Provider value={modifierKeys}>
			<div className={ styles.app }>
				<div className={ styles['app-controls'] }>
					{ !isEditingName && (
						<>
							<Select
								size="small"
								value={selectedTimeline}
								label="Sequence"
								onChange={e => setSelectedTimeline(e.target.value as string)}
							>
								{ timelines.map(({ name }) => (
									<MenuItem key={name} value={name}>{ name }</MenuItem>
								))}
							</Select>
							<Button size="small" variant="outlined" onClick={editName}>
								<EditIcon />
							</Button>
							<Button size="small" variant="outlined" onClick={onAddTimeline}>
								<AddIcon />
							</Button>
							<Button size="small" variant="outlined" onClick={deleteTimeline} disabled={timelines.length < 2}>
								<DeleteOutlineIcon />
							</Button>
						</>
					)}
					{ isEditingName && (
						<>
							<FormControl variant="standard" size="small">
								<OutlinedInput
									type="text"
									ref={nameRef}
									size="small"
									style={{ margin: '0.5em' }}
									value={editableName}
									onChange={ e => setEditableName(e.target.value) }
								/>
							</FormControl>
							<Button size="small" variant="outlined" onClick={() => confirmName()}>
								<CheckIcon />
							</Button>
							<Button size="small" variant="outlined" onClick={() => setIsEditingName(false)}>
								<CloseIcon />
							</Button>
						</>
					)}
				</div>
				{ timeline && (
					<TimelineComponent
						ref={timelineRef}
						timeline={timeline}
						onChange={onChangeTimeline}
						onPlay={onPlayTimeline}
						onPause={onPauseTimeline}
						onSeek={onSeekTimeline}
					/>
				)}
				<Dialog open={isAddingTimeline}>
					<DialogTitle>Create a new timeline</DialogTitle>
					<DialogContent>
						<Stack direction="column" spacing={'1em'} sx={{ marginTop: '0.5em' }}>
						<FormControl>
							<InputLabel htmlFor="form-item-name">Name</InputLabel>
							<OutlinedInput
								id="form-item-name"
								defaultValue={addTimelineName}
								label="Name"
								onChange={e => setAddTimelineName(e.target.value)}
							/>
						</FormControl>
						<FormControl>
							<InputLabel htmlFor="form-item-duration">Duration</InputLabel>
							<OutlinedInput
								id="form-item-duration"
								type="number"
								defaultValue={addTimelineDuration}
								endAdornment={<InputAdornment position="end">seconds</InputAdornment>}
								label="Duration"
								onChange={e => setAddTimelineDuration(Number(e.target.value))}
							/>
						</FormControl>
						<FormControl>
							<InputLabel htmlFor="form-item-fps">Framerate</InputLabel>
							<OutlinedInput
								id="form-item-fps"
								type="number"
								defaultValue={addTimelineFps}
								endAdornment={<InputAdornment position="end">fps</InputAdornment>}
								label="Framerate"
								onChange={e => setAddTimelineFps(Math.floor(Number(e.target.value)))}
							/>
						</FormControl>
						<FormControlLabel
								control={<Checkbox onChange ={e => setAddTimelineLoop(e.target.checked)} />}
								label="Loop"
							/>
						</Stack>
					</DialogContent>
					<DialogActions>
						<Button startIcon={<CloseIcon />} onClick={() => setIsAddingTimeline(false)}>
							Cancel
						</Button>
						<Button startIcon={<CheckIcon />} onClick={onConfirmAddTimeline}>
							Save
						</Button>
					</DialogActions>
				</Dialog>
			</div>
		</KeyboardContext.Provider>
  )
}

export default App
