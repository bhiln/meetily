import { invoke } from '@tauri-apps/api/core';

export interface Speaker {
  id: string;
  name: string;
  user_context: string | null;
  voice_profile: number[] | null;
  created_at: string;
  updated_at: string;
}

export const speakerService = {
  async createSpeaker(name: string, userContext?: string): Promise<string> {
    return invoke<string>('api_create_speaker', { name, userContext: userContext || null });
  },

  async getAllSpeakers(): Promise<Speaker[]> {
    return invoke<Speaker[]>('api_get_all_speakers');
  },

  async getSpeakerById(id: string): Promise<Speaker | null> {
    return invoke<Speaker | null>('api_get_speaker_by_id', { id });
  },

  async updateSpeaker(id: string, name: string, userContext?: string): Promise<void> {
    return invoke<void>('api_update_speaker', { id, name, userContext: userContext || null });
  },

  async deleteSpeaker(id: string): Promise<void> {
    return invoke<void>('api_delete_speaker', { id });
  },

  async searchSpeakers(query: string): Promise<Speaker[]> {
    return invoke<Speaker[]>('api_search_speakers', { query });
  }
};
