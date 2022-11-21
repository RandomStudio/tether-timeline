import React, { useRef, useState } from 'react';
import { useSelector } from 'react-redux'
import { store, RootState } from './redux/store'
import { addTimeline, overwriteTimelineData, removeTimeline, selectTimeline, selectTimelineByName, updateTimeline } from './redux/timeline/slice';
import { Button, FormControl, MenuItem, OutlinedInput, Select } from '@mui/material'
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RestorePageIcon from '@mui/icons-material/RestorePage';
import SaveIcon from '@mui/icons-material/Save';
import SyncIcon from '@mui/icons-material/Sync';

import TimelineComponent, { TrackValue, TrackValueList } from './components/timeline'

import styles from 'styles/app.module.scss'

const App: React.FC = () => {
  const [ busy, setBusy ] = useState(false)

  const {
    timeline: { timelines, selectedTimelineId },
  } = useSelector((state: RootState) => state)
  const timeline = timelines.find(t => t.id === selectedTimelineId)

  const nameRef = useRef(null)
  const [ isEditingName, setIsEditingName ] = useState(false)
  const [ editableName, setEditableName ] = useState(timeline?.name || "")

  const timelineRef = useRef<typeof TimelineComponent>(null!)

  window.electronAPI.onStartPlayback((name: string) => {
    store.dispatch(selectTimelineByName(name))
    // @ts-ignore
    timelineRef.current?.play(0)
  })

  window.electronAPI.onStopPlayback(() => {
    // @ts-ignore
    timelineRef.current?.pause()
  })

  const importData = async () => {
    setBusy(true)
    try {
      const json = await window.electronAPI.importJSON()
      const data = JSON.parse(json)
      if (!Object.keys(data).includes('timeline')) {
        throw Error(`Property "timeline" is missing from imported data. Loaded data:`, data)
      }
      store.dispatch(overwriteTimelineData(data.timeline))
    } catch (err) {
      alert(`Could not load timeline data. Error:\n${err}`)
    }
    setBusy(false)
  }

  const exportData = async () => {
    setBusy(true)
    try {
      const { timeline } = store.getState()
      await window.electronAPI.exportJSON(
        JSON.stringify({
          timeline,
        }, null, '\t'))
    } catch (err) {
      alert(`Could not export timeline data. Error:\n${err}`)
    }
    setBusy(false)
  }

  const createTimeline = () => {
    store.dispatch(addTimeline())
  }

  const deleteTimeline = () => {
    store.dispatch(removeTimeline(selectedTimelineId))
  }

  const setSelectedTimeline = (id: string) => {
    store.dispatch(selectTimeline(id))
  }

  const editName = () => {
    setEditableName(timeline?.name || "")
    setIsEditingName(true)
  }

  const confirmName = () => {
    if (timeline) {
      store.dispatch(updateTimeline({
        id: timeline.id,
        duration: timeline.duration,
        loop: timeline.loop,
        name: editableName,
      }))
      setIsEditingName(false)
    }
  }

  const mix = (a: number, b: number, factor: number): number => (
    (a * (1 - factor)) + (b * factor)
  )

  const mixList = (a: number[], b: number[], factor: number) => {
    if (!a || !b || !Array.isArray(a) || !Array.isArray(b)) {
      console.warn('Cannot interpolate invalid lists')
      return b
    }
    if (a.length !== b.length) {
      console.warn(`Cannot interpolate arrays of different lengths`)
      return b
    }
    return a.map((v, i) => mix(v, b[i], factor))
  }

  const onTimelineUpdate = (name: string, time: number, trackValues: (TrackValue | TrackValueList)[]): void => {
    // publish timeline progress and track values
    window.electronAPI.sendTimelineUpdate(name, time, trackValues.map(tv => (
      tv.type === "single"
        ? { track: tv.trackName, value: (tv as TrackValue).value }
        : { track: tv.trackName, colors: (tv as TrackValueList).values }
    )))
  }

  return (
    <div className={ styles.app }>
      <div className={ styles['app-controls'] }>
        { !isEditingName && (
          <>
            <Select
              size="small"
              value={selectedTimelineId}
              label="Sequence"
              onChange={e => setSelectedTimeline(e.target.value)}
            >
              { timelines.map(({ id, name }) => (
                <MenuItem key={id} value={id}>{ name }</MenuItem>
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
            <div className={ styles.spacer } />
            <Button size="small" variant="contained" onClick={importData}>
              <RestorePageIcon />
            </Button>
            <Button size="small" variant="contained" onClick={exportData}>
              <SaveIcon />
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
          onUpdate={onTimelineUpdate}
        />
      )}
      { busy && (
        <div className={styles.loader}>
          <SyncIcon fontSize="large" style={{ color: 'rgb(25, 118, 210)' }} />
        </div>
      )}
    </div>
  )
}

export default App
