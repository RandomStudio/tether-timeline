import { combineReducers, configureStore } from "@reduxjs/toolkit"
import timelineReducer from "./timeline/slice"
import storage from "redux-persist/lib/storage"
import { persistReducer, persistStore } from "redux-persist"
import thunk from "redux-thunk"

const rootReducer = combineReducers({
  timeline: persistReducer({
    key: 'timeline',
    storage,
    // blacklist: []
  }, timelineReducer),
})

const persistedReducer = persistReducer({
  key: 'root',
  storage,
}, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== 'production',
  middleware: [ thunk ]
})

export type RootState = ReturnType<typeof store.getState>
export const persistor = persistStore(store)
