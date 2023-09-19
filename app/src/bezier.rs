use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Debug, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Copy, Clone, Debug, Serialize, Deserialize)]
pub struct AnchorPoint {
    pub anchor: Point2D,
    pub control_1: Point2D,
    pub control_2: Point2D,
}

pub type BezierCurve = Vec<AnchorPoint>;

pub trait Curve {
    fn add_anchor_point(&mut self, anchor: Point2D, control_1: Point2D, control_2: Point2D);
    fn get_value_at_position(&self, position: f64) -> Option<f64>;
    fn get_point_before(&self, position: f64) -> Option<&AnchorPoint>;
    fn get_point_after(&self, position: f64) -> Option<&AnchorPoint>;
}

impl Curve for BezierCurve {
    fn add_anchor_point(&mut self, anchor: Point2D, control_1: Point2D, control_2: Point2D) {
        self.push(AnchorPoint {
            anchor,
            control_1,
            control_2,
        });
        self.sort_by(|a, b| a.anchor.x.total_cmp(&b.anchor.x));
    }

    fn get_value_at_position(&self, position: f64) -> Option<f64> {
        if self.is_empty() {
            None
        } else if let Some(prev) = self.get_point_before(position) {
            if let Some(next) = self.get_point_after(position) {
                let t = find_t_for_x(
                    prev.anchor.x,
                    prev.control_2.x,
                    next.control_1.x,
                    next.anchor.x,
                    position,
                    0.0001,
                );
                Some(
                    get_point_on_curve(prev.anchor, prev.control_2, next.control_1, next.anchor, t)
                        .y,
                )
            } else {
                None
            }
        } else {
            None
        }
    }

    fn get_point_before(&self, position: f64) -> Option<&AnchorPoint> {
        if self.is_empty() {
            None
        } else {
            self.iter().reduce(|acc, p| {
                if p.anchor.x > acc.anchor.x && p.anchor.x <= position {
                    p
                } else {
                    acc
                }
            })
        }
    }

    fn get_point_after(&self, position: f64) -> Option<&AnchorPoint> {
        if self.is_empty() {
            None
        } else {
            self.iter().rev().reduce(|acc, p| {
                if p.anchor.x < acc.anchor.x && p.anchor.x >= position {
                    p
                } else {
                    acc
                }
            })
        }
    }
}

pub fn curve(a: f64, b: f64, c: f64, d: f64, t: f64) -> f64 {
    (1.0 - t).powf(3.0) * a
        + 3.0 * (1.0 - t).powf(2.0) * t * b
        + 3.0 * (1.0 - t) * t.powf(2.0) * c
        + t.powf(3.0) * d
}

pub fn get_point_on_curve(p1: Point2D, c1: Point2D, c2: Point2D, p2: Point2D, t: f64) -> Point2D {
    Point2D {
        x: curve(p1.x, c1.x, c2.x, p2.x, t),
        y: curve(p1.y, c1.y, c2.y, p2.y, t),
    }
}

pub fn find_t_for_x(p1: f64, c1: f64, c2: f64, p2: f64, target_x: f64, precision: f64) -> f64 {
    let b = |t: f64| -> f64 { curve(p1, c1, c2, p2, t) };
    let mut lower = 0.0;
    let mut upper = 1.0;
    let mut mid = lower + 0.5 * (upper - lower);
    let mut x = b(mid);
    while (target_x - x).abs() > precision {
        if target_x > x {
            lower = mid;
        } else {
            upper = mid;
        }
        mid = lower + 0.5 * (upper - lower);
        x = b(mid);
    }
    mid
}
