use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct RGBFloat {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

impl RGBFloat {
    pub fn get_lerped(&self, destination: RGBFloat, factor: f64) -> RGBFloat {
        RGBFloat {
            r: self.r + factor * (destination.r - self.r),
            g: self.g + factor * (destination.g - self.g),
            b: self.b + factor * (destination.b - self.b),
            a: self.a + factor * (destination.a - self.a),
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct ColorStop {
    pub position: f64,
    pub color: RGBFloat,
}

pub type ColorGradient = Vec<ColorStop>;

pub trait Gradient {
    fn add_color_stop(&mut self, position: f64, color: RGBFloat);
    fn get_color_at_position(&self, position: f64) -> Option<RGBFloat>;
    fn get_color_stop_before(&self, position: f64) -> Option<&ColorStop>;
    fn get_color_stop_after(&self, position: f64) -> Option<&ColorStop>;
}

impl Gradient for ColorGradient {
    fn add_color_stop(&mut self, position: f64, color: RGBFloat) {
        self.push(ColorStop { position, color });
        self.sort_by(|a, b| a.position.total_cmp(&b.position));
    }

    fn get_color_at_position(&self, position: f64) -> Option<RGBFloat> {
        if self.is_empty() {
            None
        } else if let Some(prev) = self.get_color_stop_before(position) {
            self.get_color_stop_after(position).map(|next| {
                prev.color.get_lerped(
                    next.color,
                    (position - prev.position) / (next.position - prev.position),
                )
            })
        } else {
            None
        }
    }

    fn get_color_stop_before(&self, position: f64) -> Option<&ColorStop> {
        if self.is_empty() {
            None
        } else {
            self.iter().reduce(|acc, cs| {
                if cs.position > acc.position && cs.position <= position {
                    cs
                } else {
                    acc
                }
            })
        }
    }

    fn get_color_stop_after(&self, position: f64) -> Option<&ColorStop> {
        if self.is_empty() {
            None
        } else {
            self.iter().rev().reduce(|acc, cs| {
                if cs.position < acc.position && cs.position >= position {
                    cs
                } else {
                    acc
                }
            })
        }
    }
}
