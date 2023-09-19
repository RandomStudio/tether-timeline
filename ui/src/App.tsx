import { encode } from '@msgpack/msgpack';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Button, FormControl, MenuItem, OutlinedInput, Select } from '@mui/material';
import { Output } from '@randomstudio/tether';
import React, { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import styles from 'styles/app.module.scss';

import TimelineComponent from './components/timeline';
import { RootState, store } from './redux/store';
import { addTimeline, removeTimeline, selectTimeline, updateTimeline } from './redux/timeline/slice';

export interface AppProps {
  outPlugState: Output,
  outPlugPlay: Output,
  outPlugPause: Output,
  outPlugSeek: Output,
}

const App: React.FC<AppProps> = ({
	outPlugState,
	outPlugPlay,
	outPlugPause,
	outPlugSeek,
}) => {
  const { timelines, selectedTimeline } = useSelector((state: RootState) => state)
  const timeline = timelines.find(t => t.name === selectedTimeline)

  const nameRef = useRef(null)
  const [ isEditingName, setIsEditingName ] = useState(false)
  const [ editableName, setEditableName ] = useState(timeline?.name || "")

  const timelineRef = useRef<typeof TimelineComponent>(null!)

  const createTimeline = () => {
    store.dispatch(addTimeline())
  }

  const deleteTimeline = () => {
		if (selectedTimeline !== null) {
    	store.dispatch(removeTimeline(selectedTimeline))
		}
  }

  const setSelectedTimeline = (name: string) => {
    store.dispatch(selectTimeline(name))
  }

  const editName = () => {
    setEditableName(timeline?.name || "")
    setIsEditingName(true)
  }

  const confirmName = () => {
    if (timeline) {
      store.dispatch(updateTimeline({
        duration: timeline.duration,
				fps: timeline.fps,
        loopPlayback: timeline.loopPlayback,
        name: editableName,
      }))
      setIsEditingName(false)
    }
  }

	const onChangeTimeline = () => {
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
            <Button size="small" variant="outlined" onClick={createTimeline}>
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
          // @ts-ignore
          ref={timelineRef}
          style={{ flexGrow: 10 }}
          timeline={timeline}
					onChange={onChangeTimeline}
					onPlay={onPlayTimeline}
					onPause={onPauseTimeline}
					onSeek={onSeekTimeline}
        />
      )}
    </div>
  )
}

export default App
