use bezier::Point2D;
use clap::Parser;
use lazy_static::lazy_static;
use log::*;
use server::start_server;
use std::{
    env::{set_var, var},
    error::Error,
    panic::catch_unwind,
    sync::mpsc::{self, TryRecvError},
    thread,
    time::SystemTime,
};

use crate::signal_handler::handle_exit_signals;
use crate::tether::{ControlMessage, Tether};
use crate::timeline::Timeline;

mod bezier;
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

fn run() {
    thread::spawn(move || start_server(ARGS.http_port));
    info!("Started server on port {}", ARGS.http_port);

    // Handle exit signals with a message channels to hear about them occurring
    let (tx_sig, rx_sig) = mpsc::sync_channel(1);
    handle_exit_signals(tx_sig).expect("Cannot handle exit signals");

    let mut timelines = vec![Timeline::new("Timeline 1", 10.0, ARGS.fps, true)];
    if let Some(t) = timelines.first_mut() {
        t.add_track("Track 1");
        if let Some(track) = t.get_track_mut("Track 1") {
            track.curve.add_anchor_point(
                Point2D { x: 0.0, y: 0.0 },
                Point2D { x: 0.0, y: 0.0 },
                Point2D { x: 1.0, y: 0.0 },
            );
            track.curve.add_anchor_point(
                Point2D { x: 1.0, y: 1.0 },
                Point2D { x: 0.0, y: 1.0 },
                Point2D { x: 1.0, y: 1.0 },
            );
        }
        t.play()
    }

    let (tx_control, rx_control) = mpsc::sync_channel(1);
    let (tx_status, rx_status) = mpsc::sync_channel(1);
    let tether = Tether::new(tx_control, rx_status);

    loop {
        // Listen for exit signals
        if rx_sig.try_recv().unwrap_or(false) {
            // Upon receiving an exit signal, panic to trigger the catch_unwind and subsequent cleanup
            panic!("Received exit signal");
        }

        tether.update();

        // check for incoming data from tether
        match rx_control.try_recv() {
            Ok(ControlMessage::Play(name)) => {
                // start playback on timeline with specified name
                if let Some(timeline) = timelines.iter_mut().find(|t| t.name.eq(&name)) {
                    timeline.play();
                }
            }
            Ok(ControlMessage::Stop) => {
                // stop playback on all timelines
                timelines.iter_mut().for_each(|t| t.stop());
            }
            Err(TryRecvError::Empty) => (),
            Err(TryRecvError::Disconnected) => {
                error!("Error communicating with Tether agent: channel disconnected");
            }
        }

        // update playing timeline, if any, and send out status messages over tether
        if let Some(timeline) = timelines.iter_mut().find(|t| t.is_playing()) {
            if let Some(snapshot) = timeline.update() {
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
        }
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    init_logging(ARGS.verbosity);

    match catch_unwind(|| run()) {
        Ok(_) => println!("Exited successfully"),
        Err(_) => {
            println!("Application panicked");
            // let mut model = match model.0.lock() {
            // 		Ok(guard) => guard,
            // 		Err(poisoned) => poisoned.into_inner(),
            // };
            // model.clean_up();
        }
    }

    Ok(())
}
