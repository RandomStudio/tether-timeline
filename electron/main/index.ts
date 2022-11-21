// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST_ELECTRON, '../public')
process.env.ASSET_DIR = app.isPackaged ? process.env.PWD : join(process.env.DIST_ELECTRON, '../public')

import { app, BrowserWindow, shell, ipcMain, IpcMainEvent, dialog } from 'electron'
import { release } from 'os'
import path, { join } from 'path'
import http from 'http'
import express from 'express'
import cors from 'cors'
import parse from "parse-strings-in-object"
import rc from "rc"
import { decode, encode } from '@msgpack/msgpack'
import { TetherAgent, logger } from '@randomstudio/tether'

import { ConfigOptions, TrackValues } from "./types"
import { copyFile, readFile, writeFile } from 'fs/promises'
import { nanoid } from '@reduxjs/toolkit'

const config: ConfigOptions = parse(rc(
  "tether-timeline",
  {
    loglevel: "info",
    ioFilePath: "animation-data.json",
    tether: {
      host: "localhost",
      port: 1883,
      username: "tether",
      password: "sp_ceB0ss!",
      subscription: "mugler-bodyspace-engine/+/state",
      agentID: nanoid(),
    },
  }
))

// setup http server to serve up video files
const expressApp = express()
const router = express.Router()
expressApp.use(cors())
router.get('/file/:name', function (req, res) {
  let filename = req.params.name
  res.sendFile(join(process.env.ASSET_DIR, filename))
})
expressApp.use('/', router)
http.createServer(expressApp).listen(8000)

let tetherAgent: TetherAgent
let interval: NodeJS.Timer

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Light animation sequencer',
    icon: join(process.env.PUBLIC, 'favicon.svg'),
    width: 1024,
    height: 512,
    resizable: true,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: true,
    },
  })

  if (app.isPackaged) {
    win.loadFile(indexHtml)
  } else {
    win.loadURL(url)
    // win.webContents.openDevTools()
  }

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

const decodeMessagePayload = (payload: Buffer): any => {
  try {
    return decode(payload)
  } catch(e) {
    try {
      return decode(payload.buffer)
    } catch (e2) {
      return payload.toString()
    }
  }
}

const createTetherAgent = async (): Promise<TetherAgent> => {
  const { host, port, username, password, subscription, agentID } = config.tether
  const agent = await TetherAgent.create(
    "tether-timeline",
    { host, port, username, password },
    config.loglevel,
    agentID
  )
  // listen for messages on a "play" input
  agent.createInput('play', subscription, { qos: 2 }).onMessage(payload => {
    const stateName = decodeMessagePayload(payload)
    logger.debug(`Received Tether message on topic ${subscription} with payload ${stateName}`)
    // notify frontend to start playback on this timeline
    win?.webContents.send('play-timeline', stateName)
  })
  // create output plug for completion events
  agent.createOutput('update')
  agent.createOutput('completed')
  return agent
}

const selectVideoFile = async (): Promise<string> => {
  const file = await dialog.showOpenDialogSync({
    properties: ['openFile'],
    filters: [
      { name: "Videos", extensions: ["mp4", "mpv", "webm"] }
    ]
  })[0]
  await copyFile(file, join(process.env.ASSET_DIR, path.basename(file)))
  return 'http://localhost:8000/file/' + path.basename(file)
}

const onTimelineUpdate = (event: IpcMainEvent, name: string, time: number, tracks: TrackValues[]) => {
  logger.debug(`Sending update message for timeline "${name}" at time ${time}. Track values:`, tracks)
  tetherAgent?.getOutput('update')?.publish(Buffer.from(encode({ name, time, tracks })))
}

const onTimelineCompleted = (event: IpcMainEvent, name: string) => {
  logger.info(`Sending completed message for timeline "${name}"`)
  tetherAgent?.getOutput('completed')?.publish(Buffer.from(encode(name)))
}

const exportJSON = async (
  event: IpcMainEvent,
  json: string
): Promise<void> => new Promise(async (resolve, reject) => {
  try {
    await writeFile(join(process.env.ASSET_DIR, config.ioFilePath), json)
    resolve()
  } catch(err) {
    reject(err)
  }
})

const importJSON = async (
  event: IpcMainEvent,
): Promise<string> => new Promise(async (resolve, reject) => {
  try {
    const contents = await readFile(join(process.env.ASSET_DIR, config.ioFilePath))
    if (contents) resolve(contents.toString())
    else reject(`Could not read contents from file ${join(process.env.ASSET_DIR, config.ioFilePath)}`)
  } catch (err) {
    reject(err)
  }
})

app.whenReady().then(async () => {
  tetherAgent = await createTetherAgent()
  ipcMain.handle('select-video-file', selectVideoFile)
  ipcMain.on('timeline-update', onTimelineUpdate)
  ipcMain.on('timeline-completed', onTimelineCompleted)
  ipcMain.handle('export-json', exportJSON)
  ipcMain.handle('import-json', importJSON)
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  // if (process.platform !== 'darwin') {
    if (interval) {
      clearInterval(interval)
    }
    app.quit()
  // }
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

app.on("before-quit", () => {
  //
})

// new window example arg: new windows url
ipcMain.handle('open-win', (event, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
    },
  })

  if (app.isPackaged) {
    childWindow.loadFile(indexHtml, { hash: arg })
  } else {
    childWindow.loadURL(`${url}/#${arg}`)
    // childWindow.webContents.openDevTools({ mode: "undocked", activate: true })
  }
})
