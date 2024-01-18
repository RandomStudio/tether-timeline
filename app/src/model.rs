use std::{
    fs::{File, OpenOptions},
    io::{Read, Write},
    path::Path,
};

use log::{debug, info};
use serde::{Deserialize, Serialize};

use crate::{
    timeline::{InvalidDataError, Result, Timeline, TimelineSnapshot},
    ARGS,
};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub timelines: Vec<Timeline>,
    pub selected_timeline: Option<String>,
}

impl Model {
    pub fn new() -> Self {
        Self {
            timelines: Vec::new(),
            selected_timeline: None,
        }
    }

    pub fn load_from_path(&mut self, path: &str) -> std::io::Result<()> {
        let p = Path::new(path);
        if !p.exists() {
            debug!("File at path {} does not exist. Creating new.", path);
            if let Ok(_file) = File::create(path) {
                debug!("Successfully created file at path {}", path);
            }
        }

        let mut file = OpenOptions::new().read(true).open(path)?;

        let mut contents = String::new();
        file.read_to_string(&mut contents)?;
        if let Ok(data) = serde_json::from_str::<Model>(&contents) {
            self.update_timeline_data(data.timelines);
            if let Some(selected_timeline) = data.selected_timeline {
                self.set_active_timeline(selected_timeline.as_str());
            }
            Ok(())
        } else {
            debug!("Invalid data in file, overwriting with current model state");
            self.save_to_path(path)
            // Err(std::io::Error::from(std::io::ErrorKind::InvalidData))
        }
    }

    pub fn save_to_path(&self, path: &str) -> std::io::Result<()> {
        if let Ok(json) = serde_json::to_string(self) {
            let mut file = File::create(path)?;
            file.write_all(json.as_bytes())?;
            Ok(())
        } else {
            Err(std::io::Error::from(std::io::ErrorKind::InvalidData))
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
    pub fn update_timeline_data(&mut self, mut data: Vec<Timeline>) {
        self.timelines = data.iter_mut().fold(Vec::new(), |mut list, t| {
            // clone the incoming timeline in a way that retains the current position and play state
            if let Some(original) = self.get_timeline(t.name.as_str()) {
                t.seek(original.get_position());
                if original.is_playing() {
                    t.play()
                }
            }
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
