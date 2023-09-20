import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'styles/index.css';

import { decode } from '@msgpack/msgpack';
import { TetherAgent } from '@randomstudio/tether';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import App from './App';
import { store } from './redux/store';
import { overwriteTimelineData, setTimelineState } from './redux/timeline/slice';
import { TimelineSnapshot, TimelineState } from './redux/timeline/types';

type TetherConfig = {
  host: string;
  username: string;
  password: string;
  agent_type: string;
  agent_id: string;
};

const urlParams = new URLSearchParams(window.location.search);

fetch('/tether-config')
  .then(res => {
		console.log(res);
    if (res.ok) return res.json();
    else throw new Error("Could not retrieve Tether configuration. Error: " + res.statusText);
  })
  .then(({ host, username, password, agent_type, agent_id }: TetherConfig) => {
    TetherAgent.create(
      'tether-timeline-ui',
      {
        host,
        port: 15675,
        path: '/ws',
        protocol: 'ws',
        username,
        password,
      },
      urlParams.has('debug') ? 'debug' : 'info',
    ).then(agent => {
      // subscribe to state changes
      const stateInput = agent.createInput('state', `${agent_type}/${agent_id}/state`, { qos: 1 });
      // re-hydrate the store whenever a new state comes in
      stateInput.onMessage(payload => {
        const data: any = decode(payload);
        console.debug('Received state:', data);
        store.dispatch(overwriteTimelineData(data as TimelineState));
      });
			const updateInput = agent.createInput('update', `${agent_type}/${agent_id}/update`, { qos: 0 });
			updateInput.onMessage(payload => {
				const data = decode(payload) as TimelineSnapshot;
				console.info('Received timeline snapshot:', data);
				store.dispatch(setTimelineState(data));
			});
      // create an output to publish requested state changes on
      const outputState = agent.createOutput('state');
      const outputSelectTimeline = agent.createOutput('select');
      const outputPlay = agent.createOutput('play');
      const outputPause = agent.createOutput('pause');
      const outputSeek = agent.createOutput('seek');
      ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
        <React.StrictMode>
          <Provider store={store}>
              <App
								outPlugState={ outputState }
								outputSelectTimeline={ outputSelectTimeline }
								outPlugPlay={ outputPlay }
								outPlugPause={ outputPause }
								outPlugSeek={ outputSeek }
							/>
          </Provider>
        </React.StrictMode>,
      )
    }).catch(e => {
      throw e;
    });
  })
	.catch(err => {
		console.error('Could not connect to the server. Error:', err);
		ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <>
          <p>Unable to connect to the server, please restart the server or get in touch with your support contact.</p>
          <p>Error: {err.toString()}</p>
        </>
      </React.StrictMode>,
    )
	});
