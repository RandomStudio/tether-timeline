use std::net::Ipv4Addr;

use iron::{mime::Mime, status::Status, Iron, IronResult, Request, Response};
use serde_json::json;

use crate::ARGS;

pub fn start_server(port: u16) {
    let mut mount = mount::Mount::new();
    mount
        .mount(
            "/",
            staticfile::Static::new(std::path::Path::new("public/")),
        )
        .mount(
            "/tether-config",
            move |_req: &mut Request| -> IronResult<Response> {
                let content_type = "application/json".parse::<Mime>().unwrap();
                Ok(Response::with((
                    content_type,
                    Status::Ok,
                    json!({
                        "agent_type": &String::from("tether-timeline"),
                        "agent_id": ARGS.tether_agent_id.as_ref().unwrap_or(&String::from("+")),
                        "host": ARGS.tether_host.as_ref().unwrap_or(&Ipv4Addr::new(127, 0, 0, 1)),
                        "username": ARGS.tether_user.as_ref().unwrap_or(&String::from("guest")),
                        "password": ARGS.tether_password.as_ref().unwrap_or(&String::from("guest")),
                    })
                    .to_string(),
                )))
            },
        );
    let mut http_server = Iron::new(mount);
    http_server.timeouts.keep_alive = None;
    http_server.http(format!("{}:{}", "0.0.0.0", port)).unwrap();
}
