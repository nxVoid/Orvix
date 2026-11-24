// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::paths::{DEV_LOG_DIR, DEV_STATE_DIR, ROOT};
use crate::proc::wait_tcp;
use anyhow::{Context, Result, ensure};
use std::process::Command;
use std::time::Duration;

pub async fn ensure_local_cache() -> Result<()> {
    let Some(binary) = std::env::var_os("ORVIX_DEV_LOCAL_CACHE_BINARY") else {
        return Ok(());
    };
    let endpoint = url::Url::parse(&std::env::var("ORVIX_KV_URL")?)?;
    ensure!(
        endpoint.scheme() == "redis" && endpoint.host_str() == Some("127.0.0.1"),
        "the managed development cache requires redis://127.0.0.1"
    );
    let port = endpoint.port().unwrap_or(6379);
    let address = format!("127.0.0.1:{port}").parse()?;
    if std::net::TcpStream::connect_timeout(&address, Duration::from_secs(1)).is_ok() {
        return Ok(());
    }
    let state = DEV_STATE_DIR.join("cache");
    std::fs::create_dir_all(&state)?;
    std::fs::create_dir_all(DEV_LOG_DIR.as_path())?;
    let status = Command::new(ROOT.join(binary))
        .args([
            "--bind",
            "127.0.0.1",
            "--port",
            &port.to_string(),
            "--save",
            "",
            "--appendonly",
            "no",
            "--daemonize",
            "yes",
        ])
        .arg("--dir")
        .arg(&state)
        .arg("--pidfile")
        .arg(state.join("valkey.pid"))
        .arg("--logfile")
        .arg(DEV_LOG_DIR.join("valkey-local.log"))
        .status()
        .context("failed to start the workspace Valkey binary")?;
    ensure!(status.success(), "workspace Valkey could not start");
    wait_tcp("Workspace Valkey", "127.0.0.1", port, 10).await?;
    println!("Orvix workspace cache listening on 127.0.0.1:{port}");
    Ok(())
}
