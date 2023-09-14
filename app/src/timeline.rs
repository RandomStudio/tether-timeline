use std::time::{Duration, SystemTime};

use serde::Serialize;

use crate::bezier::BezierCurve;

#[derive(Debug, PartialEq)]
pub enum PlayState {
    /// Playing since time X, started from position Y
    Playing(SystemTime, f64),
    Stopped,
}

#[derive(Debug)]
pub struct EventTrigger {
    pub position: f64,
    pub data: String,
}

#[derive(Debug, Serialize)]
pub struct TrackSnapshot {
    /// track name
    name: String,
    /// curve value at snapshot position, if any
    value: Option<f64>,
    /// events at snapshot position, if any
    events: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TimelineSnapshot {
    /// timeline name
    name: String,
    /// time at snapshot
    time: f64,
    /// normalized playhead position at snapshot
    position: f64,
    /// track snapshots at snapshot time
    tracks: Vec<TrackSnapshot>,
}

#[derive(Debug, Serialize)]
pub struct EventSnapshot {
    /// timeline name
    timeline: String,
    /// track name
    track: String,
    /// event data
    event: String,
}

#[derive(Debug)]
pub struct Track {
    /// track name
    pub name: String,
    /// bezier curve
    pub curve: BezierCurve,
    /// list of events to trigger at specific times
    pub events: Vec<EventTrigger>,
}

impl Track {
    pub fn new(name: &str) -> Self {
        Self {
            name: String::from(name),
            curve: BezierCurve::new(),
            events: Vec::new(),
        }
    }

    pub fn set_name(&mut self, name: &str) {
        // TODO validate name as being unique
        self.name = String::from(name);
    }

    pub fn snapshot(&self, prev_position: f64, cur_position: f64) -> TrackSnapshot {
        TrackSnapshot {
            name: self.name.clone(),
            value: self.curve.get_value_at_position(cur_position),
            events: self.events.iter().fold(Vec::new(), |mut list, event| {
                if prev_position < event.position && cur_position >= event.position {
                    list.push(event.data.clone());
                }
                list
            }),
        }
    }
}

#[derive(Debug)]
pub struct Timeline {
    /// timeline  name
    pub name: String,
    /// timeline duration in seconds
    pub duration: f64,
    /// frame rate for playback
    pub fps: u32,
    /// whether or not to loop playback
    pub loop_playback: bool,
    /// current playback position
    position: f64,
    /// list of tracks contained within this timeline
    tracks: Vec<Track>,
    /// current play state
    state: PlayState,
    /// time of last update
    last_updated: SystemTime,
    /// duration of a single frame, based on the fps value
    frame_duration: Duration,
}

impl Timeline {
    pub fn new(name: &str, duration: f64, fps: u32, loop_playback: bool) -> Self {
        Self {
            name: String::from(name),
            duration,
            fps,
            loop_playback,
            position: 0.0,
            tracks: Vec::new(),
            state: PlayState::Stopped,
            last_updated: SystemTime::now(),
            frame_duration: Duration::from_secs_f64(1.0 / f64::from(fps)),
        }
    }

    pub fn set_name(&mut self, name: &str) {
        self.name = String::from(name);
    }

    pub fn add_track(&mut self, name: &str) {
        // TODO validate name as being unique
        self.tracks.push(Track::new(name));
    }

    pub fn remove_track(&mut self, name: &str) {
        if let Some(index) = self.tracks.iter().position(|track| track.name.eq(name)) {
            self.tracks.swap_remove(index);
        }
    }

    pub fn get_track(&self, name: &str) -> Option<&Track> {
        self.tracks.iter().find(|track| track.name.eq(name))
    }

    pub fn get_track_mut(&mut self, name: &str) -> Option<&mut Track> {
        self.tracks.iter_mut().find(|track| track.name.eq(name))
    }

    pub fn play(&mut self) {
        if self.state == PlayState::Stopped {
            // Store information on the time and position from which playback was started
            self.state = PlayState::Playing(SystemTime::now(), self.position);
        }
    }

    pub fn stop(&mut self) {
        self.state = PlayState::Stopped;
    }

    pub fn is_playing(&self) -> bool {
        self.state != PlayState::Stopped
    }

    /// Update the current position, returning the time code and the current values of any tracks
    /// contained within this timeline.
    /// Note that this returns Some value only at the specified frame rate for this timeline. Between
    /// "frames", it will return None.
    pub fn update(&mut self) -> Option<TimelineSnapshot> {
        if self.last_updated.elapsed().unwrap() < self.frame_duration {
            None
        } else {
            match &self.state {
                PlayState::Playing(started_at, from_position) => {
                    let prev_position = self.position;
                    let since_playback_start =
                        started_at.elapsed().unwrap_or(Duration::ZERO).as_secs_f64();
                    let new_position = from_position + since_playback_start / self.duration;
                    if self.loop_playback {
                        self.position = new_position % 1.0;
                    } else {
                        self.position = new_position.clamp(0.0, 1.0);
                        if self.position == 1.0 {
                            self.stop();
                        }
                    }
                    self.last_updated = SystemTime::now();
                    Some(TimelineSnapshot {
                        name: self.name.clone(),
                        time: self.position * self.duration,
                        position: self.position,
                        tracks: self
                            .tracks
                            .iter()
                            .map(|track| track.snapshot(prev_position, self.position))
                            .collect(),
                    })
                }
                PlayState::Stopped => None,
            }
        }
    }
}
