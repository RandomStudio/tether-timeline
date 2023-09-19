use clap::Parser;
use lazy_static::lazy_static;
use log::*;
use serde::{Serialize, Serializer};
use server::start_server;
use std::{
    env::{set_var, var},
    error::Error,
    panic::catch_unwind,
    sync::{
        mpsc::{self, SyncSender, TryRecvError},
        Arc, Mutex,
    },
    thread,
};
use tether::StatusMessage;

use crate::model::Model;
use crate::signal_handler::handle_exit_signals;
use crate::tether::{ControlMessage, Tether};

mod bezier;
mod model;
mod server;
mod signal_handler;
mod tether;
mod timeline;

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// Optional Tether agent id
    #[arg(long = "tether.agent_id", required = false)]
    tether_agent_id: Option<String>,
    /// Optional Tether broker hostname or IP address
    #[arg(long = "tether.host", required = false)]
    tether_host: Option<std::net::Ipv4Addr>,
    /// Optional Tether user
    #[arg(long = "tether.user", required = false)]
    tether_user: Option<String>,
    /// Optional Tether password
    #[arg(long = "tether.password", required = false)]
    tether_password: Option<String>,
    /// Network port to expose the server on
    #[arg(long = "http.port", default_value_t = 8888)]
    http_port: u16,
    /// Frame rate to use for output
    #[arg(long = "fps", default_value_t = 60)]
    fps: u32,
    /// Verbose mode (-v: warn, -vv: info, -vvv: debug, , -vvvv or more: trace)
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbosity: u8,
}

lazy_static! {
    static ref ARGS: Args = Args::parse();
}

/// Wrapper just for the sake of allowing a Mutex to be serialized
pub struct MutexWrapper<T: ?Sized>(pub Mutex<T>);

impl<T: ?Sized + Serialize> Serialize for MutexWrapper<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0
            .lock()
            .expect("mutex is poisoned")
            .serialize(serializer)
    }
}

fn init_logging(level: u8) {
    // if RUST_BACKTRACE is set, ignore the arg given and set `trace` no matter what
    let mut overridden = false;
    let verbosity = if std::env::var("RUST_BACKTRACE").unwrap_or_else(|_| "0".into()) == "1" {
        overridden = true;
        "trace"
    } else {
        match level {
            0 => "error",
            1 => "warn",
            2 => "info",
            3 => "debug",
            _ => "trace",
        }
    };
    set_var("RUST_LOG", verbosity);

    pretty_env_logger::init();

    if overridden {
        warn!("RUST_BACKTRACE is set, overriding user verbosity level");
    } else if verbosity == "trace" {
        set_var("RUST_BACKTRACE", "1");
        trace!("RUST_BACKTRACE has been set");
    };
    info!(
        "Set verbosity to {}",
        var("RUST_LOG").expect("Should set RUST_LOG environment variable")
    );
}

fn publish_state(tx: &SyncSender<StatusMessage>, model: &Arc<MutexWrapper<Model>>) {
    match tx.send(tether::StatusMessage::State(model.clone())) {
        Ok(()) => (),
        Err(err) => {
            error!(
                "Could not send updated model state to internal tether agent. {}",
                err
            );
        }
    }
}

fn run(model: &Arc<MutexWrapper<Model>>) {
    thread::spawn(move || start_server(ARGS.http_port));
    info!("Started server on port {}", ARGS.http_port);

    // Handle exit signals with a message channels to hear about them occurring
    let (tx_sig, rx_sig) = mpsc::sync_channel(1);
    handle_exit_signals(tx_sig).expect("Cannot handle exit signals");

    let (tx_control, rx_control) = mpsc::sync_channel(1);
    let (tx_status, rx_status) = mpsc::sync_channel(1);
    let tether = Tether::new(tx_control, rx_status);
    publish_state(&tx_status, model);

    thread::spawn(move || tether.start());

    loop {
        // Listen for exit signals
        if rx_sig.try_recv().unwrap_or(false) {
            // Upon receiving an exit signal, panic to trigger the catch_unwind and subsequent cleanup
            panic!("Received exit signal");
        }

        let mut m = model.0.lock().unwrap();

        // keep track of any model changes, to determine if updated state data needs to be published
        let mut anything_changed = false;

        // check for incoming data from tether, such as play/stop/seek requests
        match rx_control.try_recv() {
            Ok(ControlMessage::Update(timelines)) => {
                m.update_timeline_data(timelines);
                anything_changed = true;
            }
            Ok(ControlMessage::Play(name)) => {
                // select the specified timeline and start playback on it
                m.set_active_timeline(name.as_str());
                if let Some(timeline) = m.get_active_timeline_mut() {
                    if timeline.name.eq(name.as_str()) {
                        timeline.play();
                        anything_changed = true;
                    }
                }
            }
            Ok(ControlMessage::Stop) => {
                // stop playback on current timeline
                if let Some(timeline) = m.get_active_timeline_mut() {
                    timeline.stop();
                    // anything_changed = true;
                }
            }
            Ok(ControlMessage::Seek(name, position)) => {
                if let Some(timeline) = m.get_timeline_mut(name.as_str()) {
                    timeline.seek(position);
                    // anything_changed = true;
                }
            }
            Err(TryRecvError::Empty) => (),
            Err(TryRecvError::Disconnected) => {
                error!("Error communicating with Tether agent: channel disconnected");
            }
        }

        // update playing timeline, if any, and send out status messages over tether
        if let Some(snapshot) = m.update() {
            debug!("Timeline state: {:?}", snapshot);
            match tx_status.send(tether::StatusMessage::Update(snapshot)) {
                Ok(()) => (),
                Err(err) => {
                    error!(
                        "Could not send status message to internal tether agent. {}",
                        err
                    )
                }
            }
        }

        // publish the current model state
        if anything_changed {
            publish_state(&tx_status, model);
        }
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    init_logging(ARGS.verbosity);

    let model: Arc<MutexWrapper<Model>> = Arc::new(MutexWrapper(Mutex::new(Model::new())));

    match catch_unwind(|| run(&model)) {
        Ok(_) => println!("Exited successfully"),
        Err(_) => {
            println!("Application panicked");
            let mut model = match model.0.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            model.clean_up();
        }
    }

    Ok(())
}
