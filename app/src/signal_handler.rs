use signal_hook::{
    consts::{SIGINT, SIGTERM},
    iterator::Signals,
};
use std::{error::Error, sync::mpsc::SyncSender, thread};

/// Simple exit signal handler that listens for SIGINT and SIGTERM
/// in a separate thread, and notifies of having received
/// any of these signals via a synchronised message channel.
/// Example usage:
///     let (tx_sig, rx_sig) = mpsc::sync_channel(1);
///     handle_exit_signals(tx_sig).expect("Cannot handle exit signals");
///     loop {
///         if rx_sig.try_recv().unwrap_or(false) {
///             println!("Received exit signal");
///         }
///     }
pub fn handle_exit_signals(tx: SyncSender<bool>) -> Result<(), Box<dyn Error>> {
    let mut signals = Signals::new([SIGINT, SIGTERM])?;
    thread::spawn(move || {
        for sig in signals.forever() {
            println!("Received signal {:?}", sig);
            tx.send(true).expect("Could not send data over channel");
        }
    });

    Ok(())
}
