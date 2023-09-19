import { configureStore } from '@reduxjs/toolkit';

import timelineReducer from './timeline/slice';

export const store = configureStore({
  reducer: timelineReducer,
  devTools: process.env.NODE_ENV !== 'production',
  // middleware: [ thunk ]
})

export type RootState = ReturnType<typeof store.getState>
