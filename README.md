# Tether Timeline
Tether agent embedded in an Electron app, which allows the creation and playback of timelines. You can create an arbitrary number of timelines, name them, set their duration, and specify whether or not they should loop.  
  
A timeline can contain one or more tracks, which can currently be of the `curve` or `video` type.  
Curve tracks define a single cubic bezier curve, and emit a single value on update.  
Video tracks sample colors from a video file, and emit the sampled colors on update. As each sample location can consist of one or more pixels, the values that are output from a video track are formatted in a 2-dimensional array: it emits a list of sample locations with a list of color values for each sample location.  
  
To trigger timeline playback, the agent listens to start and stop messages on topics that can be defined via configuration.

## Configuration
JSDoc annotations for the main Config object can be found in [Config type def](./electron/main/types.ts)

## Plugs
See [AsyncAPI YAML](./tether.yml)

## Setup
Install dependencies with:
```
npm i
```
Run the agent in developer mode with:
```
npm run dev
```
Build the agent to an executable application:
```
npm run build
```

## Command line arguments
Override any of the default configuration values as you would normally.  
Most notably, you can provide the following configuration options via command line:
- `tether.agentID` to specify a custom ID for this agent instance
- `tether.startPlaybackTopic` to specify the topic on which to listen for timeline playback start messages, defaults to `+/+/start-playback`
- `tether.stopPlaybackTopic` to specify the topic on which to listen for timeline playback stop messages, defaults to `+/+/stop-playback`
  
For example, the following arguments provide the agent ID `my-timelines` and make it listen for playback start and stop messages from `my-brain-agent`:
```
--tether.agentID=my-timelines --tether.startPlaybackTopic=my-brain-agent/+/start-playback --tether.stopPlaybackTopic=my-brain-agent/+/stop-playback
```
