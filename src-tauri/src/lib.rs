use serde::Serialize;
use std::env;
use std::fs;
#[cfg(target_os = "linux")]
use std::io::Read;
use std::path::Path;
#[cfg(target_os = "linux")]
use std::process::{ChildStdout, Command, Stdio};
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
#[cfg(target_os = "linux")]
use std::thread;
use std::thread::JoinHandle;
#[cfg(target_os = "linux")]
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

#[cfg(target_os = "linux")]
const VU_METER_SYSTEM_EVENT: &str = "clocklm://vu-meter-system";
const VU_METER_SYSTEM_STATUS_EVENT: &str = "clocklm://vu-meter-system-status";

#[derive(Default)]
struct SystemVuMeterRuntime {
  capture: Mutex<Option<SystemVuMeterCapture>>,
}

struct SystemVuMeterCapture {
  stop: Arc<AtomicBool>,
  child: Arc<Mutex<Option<Child>>>,
  worker: Option<JoinHandle<()>>,
}

#[cfg(target_os = "linux")]
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeVuMeterPayload {
  left: f32,
  right: f32,
  timestamp: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemVuMeterStatusPayload {
  active: bool,
  available: bool,
  reason: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeDirectoryTrack {
  name: String,
  path: String,
  relative_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeDirectorySelectionPayload {
  directory_name: String,
  tracks: Vec<NativeDirectoryTrack>,
}

fn is_supported_audio_path(path: &Path) -> bool {
  matches!(
    path
      .extension()
      .and_then(|extension| extension.to_str())
      .map(|extension| extension.to_ascii_lowercase())
      .as_deref(),
    Some("aac")
      | Some("aif")
      | Some("aiff")
      | Some("alac")
      | Some("flac")
      | Some("m4a")
      | Some("mp3")
      | Some("ogg")
      | Some("oga")
      | Some("opus")
      | Some("wav")
      | Some("webm")
      | Some("wma")
  )
}

fn is_ignored_audio_path(path: &Path) -> bool {
  let file_name = path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or_default();

  if matches!(file_name, ".DS_Store" | "Thumbs.db") || file_name.starts_with("._") {
    return true;
  }

  path.components().any(|component| {
    component
      .as_os_str()
      .to_str()
      .map(|value| value == "__MACOSX")
      .unwrap_or(false)
  })
}

fn browse_audio_directory() -> Result<Option<NativeDirectorySelectionPayload>, String> {
  let Some(directory_path) = rfd::FileDialog::new().pick_folder() else {
    return Ok(None);
  };

  let directory_name = directory_path
    .file_name()
    .and_then(|name| name.to_str())
    .map(str::to_string)
    .unwrap_or_else(|| "Musique disque dur".to_string());

  let mut tracks = walkdir::WalkDir::new(&directory_path)
    .into_iter()
    .filter_map(Result::ok)
    .filter(|entry| {
      entry.file_type().is_file()
        && !is_ignored_audio_path(entry.path())
        && is_supported_audio_path(entry.path())
    })
    .filter_map(|entry| {
      let absolute_path = entry.path().to_path_buf();
      let relative_path = absolute_path
        .strip_prefix(&directory_path)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
      let name = absolute_path.file_name()?.to_string_lossy().to_string();

      Some(NativeDirectoryTrack {
        name,
        path: absolute_path.to_string_lossy().to_string(),
        relative_path,
      })
    })
    .collect::<Vec<_>>();

  tracks.sort_by(|left, right| {
    left
      .relative_path
      .to_ascii_lowercase()
      .cmp(&right.relative_path.to_ascii_lowercase())
  });

  Ok(Some(NativeDirectorySelectionPayload {
    directory_name,
    tracks,
  }))
}

#[cfg(target_os = "linux")]
fn now_millis() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or(Duration::from_millis(0))
    .as_millis() as u64
}

fn emit_system_vu_status(
  app: &AppHandle,
  active: bool,
  available: bool,
  reason: impl Into<String>,
) -> tauri::Result<()> {
  app.emit(
    VU_METER_SYSTEM_STATUS_EVENT,
    SystemVuMeterStatusPayload {
      active,
      available,
      reason: reason.into(),
    },
  )
}

#[cfg(target_os = "linux")]
fn emit_system_vu_levels(app: &AppHandle, left: f32, right: f32) -> tauri::Result<()> {
  app.emit(
    VU_METER_SYSTEM_EVENT,
    NativeVuMeterPayload {
      left,
      right,
      timestamp: now_millis(),
    },
  )
}

#[cfg(target_os = "linux")]
fn resolve_pipewire_monitor_target() -> Result<String, String> {
  let output = Command::new("pw-link")
    .arg("-o")
    .output()
    .map_err(|error| format!("pw-link unavailable: {error}"))?;

  if !output.status.success() {
    return Err("pw-link failed to list PipeWire outputs".to_string());
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let mut monitor_targets = stdout
    .lines()
    .filter_map(|line| line.trim().strip_suffix(":monitor_FL"))
    .filter(|target| !target.starts_with("pw-record"))
    .collect::<Vec<_>>();

  monitor_targets.sort_by_key(|target| {
    if target.starts_with("alsa_output.") {
      0
    } else {
      1
    }
  });

  let target = monitor_targets.first().map(|target| (*target).to_string());

  target.ok_or_else(|| "PipeWire monitor output not found".to_string())
}

#[cfg(target_os = "linux")]
fn build_pipewire_child(target: &str) -> Result<(Child, ChildStdout), String> {
  let mut child = Command::new("pw-record")
    .arg("--target")
    .arg(target)
    .arg("--rate")
    .arg("48000")
    .arg("--channels")
    .arg("2")
    .arg("--format")
    .arg("s16")
    .arg("-")
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|error| format!("Unable to start pw-record: {error}"))?;

  let stdout = child
    .stdout
    .take()
    .ok_or_else(|| "pw-record stdout unavailable".to_string())?;

  Ok((child, stdout))
}

#[cfg(target_os = "linux")]
fn compute_stereo_rms(frame_bytes: &[u8]) -> Option<(f32, f32)> {
  if frame_bytes.len() < 4 {
    return None;
  }

  let mut left_sum = 0.0_f64;
  let mut right_sum = 0.0_f64;
  let mut frame_count = 0_usize;

  for chunk in frame_bytes.chunks_exact(4) {
    let left = i16::from_le_bytes([chunk[0], chunk[1]]) as f64 / i16::MAX as f64;
    let right = i16::from_le_bytes([chunk[2], chunk[3]]) as f64 / i16::MAX as f64;
    left_sum += left * left;
    right_sum += right * right;
    frame_count += 1;
  }

  if frame_count == 0 {
    return None;
  }

  let left_rms = (left_sum / frame_count as f64).sqrt() as f32;
  let right_rms = (right_sum / frame_count as f64).sqrt() as f32;

  Some((left_rms.clamp(0.0, 1.0), right_rms.clamp(0.0, 1.0)))
}

#[cfg(target_os = "linux")]
fn spawn_linux_system_vu_meter(app: AppHandle) -> Result<SystemVuMeterCapture, String> {
  let target = resolve_pipewire_monitor_target()?;
  let (child, mut stdout) = build_pipewire_child(&target)?;
  let stop = Arc::new(AtomicBool::new(false));
  let child_ref = Arc::new(Mutex::new(Some(child)));
  let stop_ref = Arc::clone(&stop);
  let child_ref_for_thread = Arc::clone(&child_ref);

  let worker = thread::spawn(move || {
    let _ = emit_system_vu_status(
      &app,
      true,
      true,
      format!("Capture PipeWire active sur {target}."),
    );

    let mut read_buffer = vec![0_u8; 8192];

    while !stop_ref.load(Ordering::SeqCst) {
      match stdout.read(&mut read_buffer) {
        Ok(0) => break,
        Ok(bytes_read) => {
          if let Some((left, right)) = compute_stereo_rms(&read_buffer[..bytes_read]) {
            let _ = emit_system_vu_levels(&app, left, right);
          }
        }
        Err(_) => break,
      }
    }

    if let Ok(mut child_guard) = child_ref_for_thread.lock() {
      if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
      }
    }

    let _ = emit_system_vu_status(
      &app,
      false,
      true,
      "Capture audio systeme Linux arretee.",
    );
  });

  Ok(SystemVuMeterCapture {
    stop,
    child: child_ref,
    worker: Some(worker),
  })
}

fn stop_capture_locked(capture: &mut Option<SystemVuMeterCapture>) {
  if let Some(mut running_capture) = capture.take() {
    running_capture.stop.store(true, Ordering::SeqCst);
    if let Ok(mut child_guard) = running_capture.child.lock() {
      if let Some(child) = child_guard.as_mut() {
        let _ = child.kill();
      }
    }
    if let Some(worker) = running_capture.worker.take() {
      let _ = worker.join();
    }
  }
}

#[cfg(target_os = "linux")]
fn configure_linux_media_runtime() {
  // Favor the most conservative Linux runtime path for packaged builds.
  // This helps avoid VAAPI / dmabuf related stalls seen on older Intel stacks.
  unsafe {
    env::set_var("GST_VAAPI_ALL_DRIVERS", "0");
    env::set_var("GST_PLUGIN_FEATURE_RANK", "vaapidecodebin:0");
    env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  }
}

#[tauri::command]
fn pick_audio_directory() -> Result<Option<NativeDirectorySelectionPayload>, String> {
  browse_audio_directory()
}

#[tauri::command]
fn read_audio_file_bytes(path: String) -> Result<Vec<u8>, String> {
  fs::read(&path).map_err(|error| format!("Unable to read audio file: {error}"))
}

#[tauri::command]
fn start_system_vu_meter(
  app: AppHandle,
  runtime: State<'_, SystemVuMeterRuntime>,
) -> Result<(), String> {
  #[allow(unused_mut)]
  let mut capture_guard = runtime
    .capture
    .lock()
    .map_err(|_| "System VU-meter runtime lock poisoned".to_string())?;

  if capture_guard.is_some() {
    return Ok(());
  }

  #[cfg(target_os = "linux")]
  {
    let capture = spawn_linux_system_vu_meter(app.clone())?;
    *capture_guard = Some(capture);
    return Ok(());
  }

  #[allow(unreachable_code)]
  {
    emit_system_vu_status(
      &app,
      false,
      false,
      "Capture audio systeme native non implementee pour cette plateforme.",
    )
    .map_err(|error| error.to_string())?;
    Err("System VU-meter capture is unavailable on this platform".to_string())
  }
}

#[tauri::command]
fn stop_system_vu_meter(
  app: AppHandle,
  runtime: State<'_, SystemVuMeterRuntime>,
) -> Result<(), String> {
  let mut capture_guard = runtime
    .capture
    .lock()
    .map_err(|_| "System VU-meter runtime lock poisoned".to_string())?;

  stop_capture_locked(&mut capture_guard);
  emit_system_vu_status(&app, false, true, "Capture audio systeme arretee.")
    .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_os = "linux")]
  configure_linux_media_runtime();

  tauri::Builder::default()
    .manage(SystemVuMeterRuntime::default())
    .invoke_handler(tauri::generate_handler![
      pick_audio_directory,
      read_audio_file_bytes,
      start_system_vu_meter,
      stop_system_vu_meter
    ])
    .setup(|app| {
      let reason = if cfg!(target_os = "linux") {
        "Capture audio systeme Linux prete."
      } else {
        "Capture audio systeme native non implementee pour cette plateforme."
      };
      emit_system_vu_status(&app.handle(), false, cfg!(target_os = "linux"), reason)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Clocklm");
}
