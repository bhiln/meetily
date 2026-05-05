use anyhow::{anyhow, Result};
use log::info;
use sherpa_onnx::{SpeakerEmbeddingExtractor, SpeakerEmbeddingExtractorConfig};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use crate::database::models::SpeakerModel;
use tauri::{AppHandle, Manager, Emitter, Runtime};

pub struct SpeakerDiarizationService {
    extractor: Arc<Mutex<SpeakerEmbeddingExtractor>>,
    known_speakers: Arc<Mutex<Vec<SpeakerModel>>>,
    session_speakers: Arc<Mutex<Vec<(String, Vec<f32>)>>>,
}

impl SpeakerDiarizationService {
    pub fn new(model_path: PathBuf) -> Result<Self> {
        info!("Initializing SpeakerDiarizationService with model: {}", model_path.display());
        
        if !model_path.exists() {
            return Err(anyhow!("Speaker embedding model not found at {}", model_path.display()));
        }

        let config = SpeakerEmbeddingExtractorConfig {
            model: Some(model_path.to_string_lossy().to_string()),
            num_threads: 1,
            debug: false,
            provider: Some("cpu".to_string()), 
        };

        let extractor = SpeakerEmbeddingExtractor::create(&config)
            .ok_or_else(|| anyhow!("Failed to create SpeakerEmbeddingExtractor"))?;

        Ok(Self {
            extractor: Arc::new(Mutex::new(extractor)),
            known_speakers: Arc::new(Mutex::new(Vec::new())),
            session_speakers: Arc::new(Mutex::new(Vec::new())),
        })
    }

    /// Refresh the local cache of known speakers from the database
    pub async fn refresh_speakers(&self, pool: &sqlx::SqlitePool) -> Result<()> {
        let speakers = crate::database::repositories::speaker::SpeakersRepository::get_all_speakers(pool).await?;
        let mut guard = self.known_speakers.lock().unwrap();
        *guard = speakers;
        info!("Refreshed speaker registry: {} known speakers", guard.len());
        Ok(())
    }

    /// Reset the temporary session speakers (call at start of new recording)
    pub fn reset_session(&self) {
        let mut guard = self.session_speakers.lock().unwrap();
        guard.clear();
        info!("Reset speaker diarization session clusters.");
    }

    /// Extract speaker embedding (512-dim vector) from audio samples (16kHz mono)
    pub fn compute_embedding(&self, samples: &[f32]) -> Result<Vec<f32>> {
        let guard = self.extractor.lock().unwrap();
        let stream = guard.create_stream()
            .ok_or_else(|| anyhow!("Failed to create stream for embedding extraction"))?;
        stream.accept_waveform(16000, samples);
        let embedding = guard.compute(&stream);
        Ok(embedding.ok_or_else(|| anyhow!("Failed to compute embedding"))?)
    }

    /// Identify speaker by comparing embedding against known speakers
    pub fn identify_speaker(&self, embedding: &[f32]) -> Option<String> {
        // 1. Check against registered speakers first
        {
            let known = self.known_speakers.lock().unwrap();
            let mut best_match: Option<(&SpeakerModel, f32)> = None;

            for speaker in known.iter() {
                if let Some(profile) = &speaker.voice_profile {
                    let known_embedding: Vec<f32> = profile.chunks_exact(4)
                        .map(|chunk| f32::from_le_bytes(chunk.try_into().unwrap()))
                        .collect();

                    let similarity = Self::calculate_similarity(embedding, &known_embedding);
                    if similarity > 0.30 { // Matching threshold
                        if best_match.as_ref().map_or(true, |(_, best_sim)| similarity > *best_sim) {
                            best_match = Some((speaker, similarity));
                        }
                    }
                }
            }

            if let Some((speaker, sim)) = best_match {
                info!("👤 Diarization: Identified registered speaker '{}' (similarity {:.4})", speaker.name, sim);
                return Some(speaker.name.clone());
            }
        }

        // 2. No registered match, check against session-specific unknown speakers
        let mut session_guard = self.session_speakers.lock().unwrap();
        let mut best_session_match: Option<(usize, f32)> = None;

        for (i, (_name, session_embedding)) in session_guard.iter().enumerate() {
            let similarity = Self::calculate_similarity(embedding, session_embedding);
            if similarity > 0.30 {
                if best_session_match.as_ref().map_or(true, |(_, best_sim)| similarity > *best_sim) {
                    best_session_match = Some((i, similarity));
                }
            }
        }

        if let Some((index, sim)) = best_session_match {
            let name = session_guard[index].0.clone();
            info!("👤 Diarization: Identified session speaker '{}' (similarity {:.4})", name, sim);
            return Some(name);
        }

        // 3. Brand new voice - create a new session cluster
        let next_id = session_guard.len() + 1;
        let new_name = format!("Speaker {}", next_id);
        info!("👤 Diarization: New voice detected, assigning cluster '{}'", new_name);
        session_guard.push((new_name.clone(), embedding.to_vec()));
        Some(new_name)
    }

    /// Calculate cosine similarity between two embeddings
    pub fn calculate_similarity(v1: &[f32], v2: &[f32]) -> f32 {
        if v1.len() != v2.len() || v1.is_empty() {
            return 0.0;
        }

        let mut dot_product = 0.0;
        let mut norm_v1 = 0.0;
        let mut norm_v2 = 0.0;

        for i in 0..v1.len() {
            dot_product += v1[i] * v2[i];
            norm_v1 += v1[i] * v1[i];
            norm_v2 += v2[i] * v2[i];
        }

        if norm_v1 == 0.0 || norm_v2 == 0.0 {
            return 0.0;
        }

        dot_product / (norm_v1.sqrt() * norm_v2.sqrt())
    }
}

/// Global diarization service instance
pub static DIARIZATION_SERVICE: Mutex<Option<Arc<SpeakerDiarizationService>>> = Mutex::new(None);

pub fn get_diarization_service() -> Option<Arc<SpeakerDiarizationService>> {
    DIARIZATION_SERVICE.lock().unwrap().clone()
}

pub fn init_diarization_service(model_path: PathBuf) -> Result<()> {
    let service = SpeakerDiarizationService::new(model_path)?;
    let mut guard = DIARIZATION_SERVICE.lock().unwrap();
    *guard = Some(Arc::new(service));
    Ok(())
}

#[tauri::command]
pub async fn api_init_diarization<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().expect("Failed to get app data dir");
    let model_path = app_data_dir.join("models").join("wespeaker_en_voxceleb_resnet34.onnx");

    if !model_path.exists() {
        return Err("Speaker diarization model not found. Please download it first.".to_string());
    }

    init_diarization_service(model_path).map_err(|e| e.to_string())?;
    
    // Refresh speakers from DB immediately after init
    if let Some(service) = get_diarization_service() {
        let state = app_handle.state::<crate::state::AppState>();
        let pool = state.db_manager.pool();
        service.refresh_speakers(&pool).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn api_download_diarization_model<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().expect("Failed to get app data dir");
    let models_dir = app_data_dir.join("models");
    let model_path = models_dir.join("wespeaker_en_voxceleb_resnet34.onnx");

    if model_path.exists() {
        return Ok(());
    }

    if !models_dir.exists() {
        std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    }

    // Cleanup old broken model if it exists
    let old_model_path = models_dir.join("wespeakert-resnet34-LM.onnx");
    if old_model_path.exists() {
        let _ = std::fs::remove_file(old_model_path);
    }

    info!("Downloading speaker diarization model...");
    
    // Emit download progress
    let _ = app_handle.emit("diarization-model-download-started", ());

    let url = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/wespeaker_en_voxceleb_resnet34.onnx";
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to download model: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    std::fs::write(&model_path, bytes).map_err(|e| e.to_string())?;

    info!("✅ Speaker diarization model downloaded successfully");
    let _ = app_handle.emit("diarization-model-download-completed", ());

    // Initialize service after download
    let _ = api_init_diarization(app_handle).await;

    Ok(())
}

#[tauri::command]
pub async fn api_associate_voice_with_speaker(
    state: tauri::State<'_, crate::state::AppState>,
    speaker_id: String,
    audio_samples: Vec<f32>,
) -> Result<(), String> {
    let service = get_diarization_service()
        .ok_or_else(|| "Diarization service not initialized".to_string())?;

    let embedding = service.compute_embedding(&audio_samples)
        .map_err(|e| format!("Failed to extract embedding: {}", e))?;

    // Convert Vec<f32> to Vec<u8> for storage
    let profile: Vec<u8> = embedding.iter()
        .flat_map(|&f| f.to_le_bytes().to_vec())
        .collect();

    crate::database::repositories::speaker::SpeakersRepository::save_voice_profile(
        &state.db_manager.pool(),
        &speaker_id,
        profile
    ).await.map_err(|e| e.to_string())?;

    // Refresh memory cache
    service.refresh_speakers(&state.db_manager.pool()).await.map_err(|e| e.to_string())?;

    Ok(())
}
