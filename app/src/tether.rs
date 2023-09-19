use std::sync::mpsc::{Receiver, SyncSender};
use std::sync::Arc;

use log::{debug, error, info};
use rmp_serde::to_vec_named;
use serde::Deserialize;
use tether_agent::{PlugDefinition, PlugOptionsBuilder, TetherAgent, TetherAgentOptionsBuilder};

use crate::{MutexWrapper, ARGS};

use crate::model::Model;
use crate::timeline::{EventSnapshot, Timeline, TimelineSnapshot};

#[derive(Deserialize)]
struct MessagePayloadState {
    timelines: Vec<Timeline>,
}

#[derive(Deserialize)]
struct MessagePayloadSeek {
    timeline: String,
    position: f64,
}

pub enum ControlMessage {
    Play(String),
    Stop,
    Seek(String, f64),
    Update(Vec<Timeline>),
}

pub enum StatusMessage {
    /// Message containing the current state, i.e. the model
    State(Arc<MutexWrapper<Model>>),
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
    input_state: PlugDefinition,
    input_play: PlugDefinition,
    input_pause: PlugDefinition,
    input_seek: PlugDefinition,
    output_state: PlugDefinition,
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

        let input_state = PlugOptionsBuilder::create_input("state")
            .topic("tether-timeline-ui/+/state")
            .qos(2)
            .build(&agent)
            .expect("Could not create input plug 'state'");

        let input_play = PlugOptionsBuilder::create_input("play")
            // TODO generic subscription, but with specific enough plug name somehow
            .topic("tether-timeline-ui/+/play")
            .qos(2)
            .build(&agent)
            .expect("Could not create input plug 'play'");

        let input_pause = PlugOptionsBuilder::create_input("pause")
            // TODO generic subscription, but with specific enough plug name somehow
            .topic("tether-timeline-ui/+/pause")
            .qos(2)
            .build(&agent)
            .expect("Could not create input plug 'pause'");

        let input_seek = PlugOptionsBuilder::create_input("seek")
            // TODO generic subscription, but with specific enough plug name somehow
            .topic("tether-timeline-ui/+/seek")
            .qos(2)
            .build(&agent)
            .expect("Could not create input plug 'seek'");

        let output_state = PlugOptionsBuilder::create_output("state")
            .qos(2)
            .retain(true)
            .build(&agent)
            .expect("Could not create output plug 'state'");

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
            input_state,
            input_play,
            input_pause,
            input_seek,
            output_state,
            output_update,
            output_event,
        }
    }

    pub fn start(&self) {
        let tx = self.tx.clone();

        loop {
            if let Some((plug_name, message)) = self.agent.check_messages() {
                debug!("Message received on plug '{}'", &plug_name);
                // State changes received, i.e. new timeline config data came in
                if plug_name.as_str().eq(self.input_state.name()) {
                    match rmp_serde::from_slice::<MessagePayloadState>(message.payload()) {
                        Ok(state) => {
                            tx.send(ControlMessage::Update(state.timelines)).ok();
                        }
                        Err(err) => {
                            error!("Could not decode payload from 'state' message. {}", err);
                        }
                    }
                }
                // play request received for timeline
                else if plug_name.as_str().eq(self.input_play.name()) {
                    match rmp_serde::from_slice::<String>(message.payload()) {
                        Ok(timeline) => {
                            tx.send(ControlMessage::Play(timeline)).ok();
                        }
                        Err(err) => {
                            error!("Could not decode payload from 'play' message. {}", err);
                        }
                    }
                }
                // stop request received
                else if plug_name.as_str().eq(self.input_pause.name()) {
                    tx.send(ControlMessage::Stop).ok();
                }
                // seek request received for timeline
                else if plug_name.as_str().eq(self.input_seek.name()) {
                    match rmp_serde::from_slice::<MessagePayloadSeek>(message.payload()) {
                        Ok(payload) => {
                            tx.send(ControlMessage::Seek(payload.timeline, payload.position))
                                .ok();
                        }
                        Err(err) => {
                            error!("Could not decode payload from 'seek' message. {}", err);
                        }
                    }
                }
            }

            match self.rx.try_recv() {
                // received request to publish current overall state
                Ok(StatusMessage::State(model)) => match to_vec_named(&model) {
                    Ok(payload) => match self.agent.publish(&self.output_state, Some(&payload)) {
                        Ok(()) => {
                            debug!("Successfully published updated state");
                        }
                        Err(err) => {
                            error!("Error publishing state to Tether. {}", err);
                        }
                    },
                    Err(err) => {
                        error!("Could not encode state payload. {}", err);
                    }
                },
                // received request to publish current timeline state
                Ok(StatusMessage::Update(payload)) => {
                    self.publish_timeline_snapshot(&payload);
                }
                // received request to publish single event
                Ok(StatusMessage::Event(payload)) => self.publish_event(&payload),
                Err(_) => (),
            }
        }
    }

    fn publish_timeline_snapshot(&self, data: &TimelineSnapshot) {
        // publish timeline update message
        match to_vec_named(data) {
            Ok(payload) => match self.agent.publish(&self.output_update, Some(&payload)) {
                Ok(()) => {
                    debug!("Published timeline data to Tether: {:?}", &payload);
                }
                Err(err) => {
                    error!("Error publishing timeline data to Tether: {}", err)
                }
            },
            Err(err) => {
                error!("Could not encode timeline data payload. {}", err);
            }
        }
        if data.is_playing {
            // for each event that has occurred in each track in this update, publish a separate message as well
            data.tracks.iter().for_each(|track| {
                track.events.iter().for_each(|event| {
                    self.publish_event(&EventSnapshot {
                        timeline: data.name.clone(),
                        track: track.name.clone(),
                        data: event.clone(),
                    });
                });
            });
        }
    }

    fn publish_event(&self, data: &EventSnapshot) {
        info!("Publishing event: {}", data.data);
        match to_vec_named(&data) {
            Ok(payload) => match self.agent.publish(&self.output_event, Some(&payload)) {
                Ok(()) => {
                    debug!("Published event data to Tether: {:?}", &payload)
                }
                Err(err) => {
                    error!("Error publishing event data to Tether: {}", err)
                }
            },
            Err(err) => {
                error!("Could not encode event data payload. {}", err);
            }
        }
    }
}
