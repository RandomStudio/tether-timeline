use std::sync::mpsc::{Receiver, SyncSender};

use log::{debug, error, warn};
use rmp_serde::to_vec_named;
use tether_agent::{PlugDefinition, PlugOptionsBuilder, TetherAgent, TetherAgentOptionsBuilder};

use crate::ARGS;

use crate::timeline::{EventSnapshot, TimelineSnapshot};

pub enum ControlMessage {
    Play(String),
    Stop,
}

pub enum StatusMessage {
    /// Update message containing the current timecode in ms, the normalized playback position,
    /// the current timeline name, and a list of tracks with their name and current value (if any)
    Update(TimelineSnapshot),
    /// Triggered event with timeline name, name of the track that contains the event,
    /// and the event name
    Event(EventSnapshot),
}

pub struct Tether {
    tx: SyncSender<ControlMessage>,
    rx: Receiver<StatusMessage>,
    agent: TetherAgent,
    input_play: PlugDefinition,
    input_stop: PlugDefinition,
    output_update: PlugDefinition,
    output_event: PlugDefinition,
}

impl Tether {
    pub fn new(tx: SyncSender<ControlMessage>, rx: Receiver<StatusMessage>) -> Self {
        let mut builder = TetherAgentOptionsBuilder::new("tether-timeline");
        if let Some(agent_id) = &ARGS.tether_agent_id {
            builder = builder.id(agent_id.as_str());
        }
        if let Some(host) = &ARGS.tether_host {
            builder = builder.host(host.to_string().as_str());
        }
        if let Some(user) = &ARGS.tether_user {
            builder = builder.username(user.as_str());
        }
        if let Some(password) = &ARGS.tether_password {
            builder = builder.password(password.as_str());
        }
        let agent = builder.build().expect("Failed to initialize Tether agent");

        let input_play = PlugOptionsBuilder::create_input("play")
            .qos(2)
            .build(&agent)
            .expect("Could not create input plug 'play'");

        let input_stop = PlugOptionsBuilder::create_input("stop")
            .qos(2)
            .build(&agent)
            .expect("Could not create input plug 'stop'");

        let output_update = PlugOptionsBuilder::create_output("update")
            .qos(2)
            .retain(true)
            .build(&agent)
            .expect("Could not create output plug 'update'");

        let output_event = PlugOptionsBuilder::create_output("event")
            .qos(2)
            .retain(true)
            .build(&agent)
            .expect("Could not create output plug 'event'");

        Self {
            tx,
            rx,
            agent,
            input_play,
            input_stop,
            output_update,
            output_event,
        }
    }

    pub fn update(&self) {
        // let tx = self.tx.clone();

        // thread::spawn(move || {
        // loop {
        if let Some((plug_name, message)) = self.agent.check_messages() {
            debug!("Message received on plug '{}'", &plug_name);
            if plug_name.as_str().eq(self.input_play.name()) {
                match rmp_serde::from_slice(message.payload()) {
                    Ok(timeline) => {
                        self.tx.send(ControlMessage::Play(timeline)).ok();
                    }
                    Err(err) => {
                        warn!("Could not decode payload from 'play' message. {}", err);
                    }
                }
            } else if plug_name.as_str().eq(self.input_stop.name()) {
                self.tx.send(ControlMessage::Stop).ok();
            }
        }

        match self.rx.try_recv() {
            Ok(StatusMessage::Update(payload)) => {
                // publish update message
                match to_vec_named(&payload) {
                    Ok(payload) => match self.agent.publish(&self.output_update, Some(&payload)) {
                        Ok(()) => {
                            debug!("Published timeline data to Tether: {:?}", &payload);
                        }
                        Err(err) => {
                            error!("Error publishing to Tether: {}", err)
                        }
                    },
                    Err(err) => {
                        warn!("Could not encode payload. {}", err);
                    }
                }
            }
            Ok(StatusMessage::Event(payload)) => {
                // publish event
                match to_vec_named(&payload) {
                    Ok(payload) => match self.agent.publish(&self.output_update, Some(&payload)) {
                        Ok(()) => {
                            debug!("Published event data to Tether: {:?}", &payload)
                        }
                        Err(err) => {
                            error!("Error publishing to Tether: {}", err)
                        }
                    },
                    Err(err) => {
                        warn!("Could not encode payload. {}", err);
                    }
                }
            }
            Err(_) => (),
        }
        // }
        // })
    }
}
