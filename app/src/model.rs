use log::info;
use serde::Serialize;

use crate::{
    bezier::Point2D,
    timeline::{InvalidDataError, Result, Timeline, TimelineSnapshot},
    ARGS,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub timelines: Vec<Timeline>,
    pub selected_timeline: Option<String>,
}

impl Model {
    pub fn new() -> Self {
        let name = String::from("Timeline 1");
        let mut t = Timeline::new(&name, 10.0, ARGS.fps, true);
        if let Ok(track) = t.add_track("Track 1") {
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
            track.add_event(0.0, String::from("Start"));
            (1..10).step_by(1).for_each(|i| {
                info!("Adding event at position {}", f64::from(i) / 10.0);
                track.add_event(f64::from(i) / 10.0, format!("Event {}", i));
            });
            track.add_event(1.0, String::from("End"));
        }

        Self {
            timelines: vec![t],
            selected_timeline: Some(name),
        }
    }

    pub fn add_timeline(
        &mut self,
        name: &str,
        duration: f64,
        loop_playback: bool,
    ) -> Result<&mut Timeline> {
        if let Some(_t) = self.timelines.iter().find(|t| t.name.eq(name)) {
            Err(InvalidDataError)
        } else {
            self.timelines
                .push(Timeline::new(name, duration, ARGS.fps, loop_playback));
            self.selected_timeline = Some(String::from(name));
            Ok(self.timelines.last_mut().unwrap())
        }
    }

    pub fn get_timeline(&self, name: &str) -> Option<&Timeline> {
        self.timelines.iter().find(|t| t.name.eq(name))
    }

    pub fn get_timeline_mut(&mut self, name: &str) -> Option<&mut Timeline> {
        self.timelines.iter_mut().find(|t| t.name.eq(name))
    }

    pub fn get_active_timeline_mut(&mut self) -> Option<&mut Timeline> {
        if let Some(selected) = &self.selected_timeline {
            self.timelines
                .iter_mut()
                .find(|t| t.name.eq(selected.as_str()))
        } else {
            None
        }
    }

    /// Update the selected timeline. This stops playback on the previously
    /// selected one.
    pub fn set_active_timeline(&mut self, name: &str) {
        // do nothing is the timeline is already active
        if let Some(selected) = &self.selected_timeline {
            if selected.eq(name) {
                return;
            }
        }
        if self.get_timeline(name).is_some() {
            // stop playback on the current timeline
            if let Some(current) = self.get_active_timeline_mut() {
                current.stop();
            }
            self.selected_timeline = Some(String::from(name));
        }
    }

    /// Update the currently active timeline
    pub fn update(&mut self) -> Option<TimelineSnapshot> {
        if let Some(timeline) = self.get_active_timeline_mut() {
            timeline.update()
        } else {
            None
        }
    }

    /// store new timelines, ensuring that any current play state gets applied to the same incoming timeline
    pub fn update_timeline_data(&mut self, data: Vec<Timeline>) {
        self.timelines = data.iter().fold(Vec::new(), |mut list, t| {
            // clone the incoming timeline in a way that retains the current position and play state
            let timeline = Timeline::from(t);
            list.push(timeline);
            list
        });
    }

    pub fn clean_up(&mut self) {
        self.timelines.iter_mut().for_each(|t| {
            t.stop();
        });
        self.selected_timeline = None;
    }
}
