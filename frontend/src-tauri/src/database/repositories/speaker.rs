use crate::database::models::SpeakerModel;
use sqlx::{Error as SqlxError, SqlitePool};
use uuid::Uuid;
use chrono::Utc;

pub struct SpeakersRepository;

impl SpeakersRepository {
    pub async fn create_speaker(
        pool: &SqlitePool,
        name: &str,
        user_context: Option<String>,
    ) -> Result<String, SqlxError> {
        let id = format!("speaker-{}", Uuid::new_v4());
        let now = Utc::now();

        sqlx::query(
            "INSERT INTO speakers (id, name, user_context, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(name)
        .bind(user_context)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(id)
    }

    pub async fn get_all_speakers(pool: &SqlitePool) -> Result<Vec<SpeakerModel>, SqlxError> {
        sqlx::query_as::<_, SpeakerModel>("SELECT * FROM speakers ORDER BY name ASC")
            .fetch_all(pool)
            .await
    }

    pub async fn get_speaker_by_id(
        pool: &SqlitePool,
        id: &str,
    ) -> Result<Option<SpeakerModel>, SqlxError> {
        sqlx::query_as::<_, SpeakerModel>("SELECT * FROM speakers WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn update_speaker(
        pool: &SqlitePool,
        id: &str,
        name: &str,
        user_context: Option<String>,
    ) -> Result<(), SqlxError> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE speakers SET name = ?, user_context = ?, updated_at = ? WHERE id = ?",
        )
        .bind(name)
        .bind(user_context)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn delete_speaker(pool: &SqlitePool, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM speakers WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }

    pub async fn search_speakers(
        pool: &SqlitePool,
        query: &str,
    ) -> Result<Vec<SpeakerModel>, SqlxError> {
        let search_query = format!("%{}%", query.to_lowercase());
        sqlx::query_as::<_, SpeakerModel>(
            "SELECT * FROM speakers WHERE LOWER(name) LIKE ? ORDER BY name ASC",
        )
        .bind(search_query)
        .fetch_all(pool)
        .await
    }

    pub async fn save_voice_profile(
        pool: &SqlitePool,
        id: &str,
        profile: Vec<u8>,
    ) -> Result<(), SqlxError> {
        let now = Utc::now();
        sqlx::query("UPDATE speakers SET voice_profile = ?, updated_at = ? WHERE id = ?")
            .bind(profile)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
