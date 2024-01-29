use std::{
    fmt,
    time::{Duration, SystemTime},
};

use serde::{Deserialize, Serialize};

use crate::bezier::{AnchorPoint, BezierCurve, Curve, Point2D};

pub type Result<T> = std::result::Result<T, InvalidDataError>;

#[derive(Debug, Clone)]
pub struct InvalidDataError;

impl fmt::Display for InvalidDataError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Invalid data provided")
    }
}

#[derive(Debug, Default, PartialEq, Serialize)]
pub enum PlayState {
    /// Playing since time X, started from position Y
    Playing(SystemTime, f64),
    #[default]
    Stopped,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventTrigger {
    pub id: String,
    pub position: f64,
    pub data: String,
}

#[derive(Debug, Serialize)]
pub struct EventSnapshot {
    /// timeline name
    pub timeline: String,
    /// track name
    pub track: String,
    /// position of the event on the track, normalized to the timeline duration
    pub position: f64,
    /// time at which the event occurred
    pub time: f64,
    /// event data
    pub data: String,
}

impl EventTrigger {
    fn occurred_between(&self, prev: f64, cur: f64) -> bool {
        cur == self.position
            || (cur > prev && (prev..cur).contains(&self.position))
            || (cur < prev && (self.position > prev || self.position < cur))
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub enum TrackMode {
    #[default]
    Curve,
    Event,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Track {
    /// track name
    pub name: String,
    /// track type
    pub mode: TrackMode,
    /// bezier curve
    pub curve: Option<BezierCurve>,
    /// list of events to trigger at specific times
    pub events: Option<Vec<EventTrigger>>,
}

#[derive(Debug, Serialize)]
pub struct TrackSnapshot {
    /// track name
    pub name: String,
    /// curve value at snapshot position, if any
    pub value: Option<f64>,
    /// events at snapshot position, if any
    pub events: Option<Vec<EventTrigger>>,
}

impl Track {
    pub fn new(name: &str, mode: TrackMode) -> Self {
        if mode == TrackMode::Curve {
            Self {
                name: String::from(name),
                mode: TrackMode::Curve,
                curve: Some(vec![
                    AnchorPoint {
                        anchor: Point2D { x: 0.0, y: 0.5 },
                        control_1: Point2D { x: 0.0, y: 0.5 },
                        control_2: Point2D { x: 0.2, y: 0.5 },
                    },
                    AnchorPoint {
                        anchor: Point2D { x: 1.0, y: 0.5 },
                        control_1: Point2D { x: 0.8, y: 0.5 },
                        control_2: Point2D { x: 1.0, y: 0.5 },
                    },
                ]),
                events: None,
            }
        } else {
            Self {
                name: String::from(name),
                mode: TrackMode::Event,
                curve: None,
                events: Some(Vec::new()),
            }
        }
    }

    pub fn set_name(&mut self, name: &str) {
        self.name = String::from(name);
    }

    // pub fn add_event(&mut self, position: f64, data: String) -> Result<()> {
    //     if let Some(ref mut events) = self.events {
    //         events.push(EventTrigger { position, data });
    //         Ok(())
    //     } else {
    //         Err(InvalidDataError)
    //     }
    // }

    pub fn snapshot(&self, prev_position: f64, cur_position: f64) -> TrackSnapshot {
        TrackSnapshot {
            name: self.name.clone(),
            value: if let Some(ref curve) = self.curve {
                curve.get_value_at_position(cur_position)
            } else {
                None
            },
            events: self.events.as_ref().map(|events| {
                events.iter().fold(Vec::new(), |mut list, event| {
                    if event.occurred_between(prev_position, cur_position) {
                        list.push(event.clone());
                    }
                    list
                })
            }),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    #[serde(skip)]
    position: f64,
    /// list of tracks contained within this timeline
    tracks: Vec<Track>,
    /// current play state
    #[serde(skip)]
    state: PlayState,
    /// duration of a single frame, based on the fps value
    #[serde(skip)]
    frame_duration: Duration,
    /// time of last update
    #[serde(skip, default = "SystemTime::now")]
    last_updated: SystemTime,
    /// indication of whether anything changed and an update should be performed
    #[serde(skip)]
    update_required: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineSnapshot {
    /// timeline name
    pub name: String,
    /// timeline duration in seconds
    pub duration: f64,
    /// time at snapshot
    pub time: f64,
    /// normalized playhead position at snapshot
    pub position: f64,
    /// whether or not the timeline is currently playing
    pub is_playing: bool,
    /// track snapshots at snapshot time
    pub tracks: Vec<TrackSnapshot>,
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
            update_required: true,
        }
    }

    pub fn from(src: &Timeline) -> Self {
        let mut s = Timeline::new(src.name.as_str(), src.duration, src.fps, src.loop_playback);
        src.get_tracks().iter_mut().for_each(|t| {
            // if let Some(track) = s.get_track_mut(&t.name) {
            if let Ok(track) = s.add_track(t.name.as_str(), t.mode) {
                track.curve = t.curve.clone();
                track.events = t.events.clone();
            }
        });
        s.seek(src.get_position());
        if src.is_playing() {
            s.play();
        }
        s.update();
        s
    }

    pub fn set_name(&mut self, name: &str) {
        self.name = String::from(name);
        self.update_required = true;
    }

    pub fn get_position(&self) -> f64 {
        self.position
    }

    pub fn get_tracks(&self) -> Vec<&Track> {
        self.tracks.iter().collect()
    }

    pub fn add_track(&mut self, name: &str, mode: TrackMode) -> Result<&mut Track> {
        if let Some(_t) = self.tracks.iter().find(|t| t.name.eq(name)) {
            Err(InvalidDataError)
        } else {
            self.tracks.push(Track::new(name, mode));
            self.update_required = true;
            Ok(self.tracks.last_mut().unwrap())
        }
    }

    pub fn remove_track(&mut self, name: &str) {
        if let Some(index) = self.tracks.iter().position(|track| track.name.eq(name)) {
            self.tracks.swap_remove(index);
            self.update_required = true;
        }
    }

    pub fn get_track(&self, name: &str) -> Option<&Track> {
        self.tracks.iter().find(|track| track.name.eq(name))
    }

    pub fn get_track_mut(&mut self, name: &str) -> Option<&mut Track> {
        self.tracks.iter_mut().find(|track| track.name.eq(name))
    }

    pub fn play(&mut self) {
        if !self.is_playing() {
            // Store information on the time and position from which playback was started
            self.state = PlayState::Playing(SystemTime::now(), self.position);
            self.update_required = true;
        }
    }

    pub fn stop(&mut self) {
        self.state = PlayState::Stopped;
        self.update_required = true;
    }

    pub fn seek(&mut self, position: f64) {
        self.position = position.clamp(0.0, 1.0);
        if self.is_playing() {
            self.state = PlayState::Playing(SystemTime::now(), self.position);
        }
        self.update_required = true;
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
                PlayState::Stopped => {
                    self.last_updated = SystemTime::now();
                    if self.update_required {
                        self.update_required = false;
                        Some(self.get_snapshot(self.position))
                    } else {
                        None
                    }
                }
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
                    self.update_required = false;
                    Some(self.get_snapshot(prev_position))
                }
            }
        }
    }

    fn get_snapshot(&self, prev_position: f64) -> TimelineSnapshot {
        TimelineSnapshot {
            name: self.name.clone(),
            duration: self.duration,
            time: self.position * self.duration,
            position: self.position,
            is_playing: self.is_playing(),
            tracks: self
                .tracks
                .iter()
                .map(|track| track.snapshot(prev_position, self.position))
                .collect(),
        }
    }
}
