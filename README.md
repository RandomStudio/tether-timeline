# Tether Timeline

This is a Rust application that allows the creation and playback of timelines through a web UI.  
You can create an arbitrary number of timelines, name them, set their duration, and specify whether or not they should loop.

A timeline can contain one or more tracks, which can currently be of the `curve` or `event` type.  
Curve tracks define a single cubic bezier curve, and emit a single value on update.  
Event tracks contain one or more triggers at distinct times, each containing an optional piece of data (currently limited to strings). Events are emitted

To trigger timeline playback, the agent listens to start and stop messages on topics that can be defined via configuration.

## Agent

The main agent application is written in Rust. To build it, run the following from the `app/` directory:

```
cargo build
```

and/or run it with

```
cargo run
```

The full timeline functionality is headless, i.e. it does not require the web UI in order to run.

### Command line arguments

Provide any of the following arguments to configure the agent application:

- `--tether.agent_id` Optional Tether agent id
- `--tether.host` Optional Tether broker hostname or IP address. Defaults to `127.0.0.1`.
- `--tether.user` Optional Tether user
- `--tether.password` Optional Tether password
- `--http.port` Network port to expose the server on. Defaults to `8888`.
- `--fps` Frame rate to use for output. Defaults to `60`.
- Set verbosity level with `-v`: warn, `-vv`: info, `-vvv`: debug, , `-vvvv` or more: trace

## Web UI

The web UI is built to and served up by the Rust application. To build it, run the following from the `ui/` directory:

```
npm run build
```

This compiles the assets and places them in `app/public/`.
