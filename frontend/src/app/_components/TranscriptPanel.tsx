import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { PermissionWarning } from '@/components/PermissionWarning';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { SpeakerMentionInput } from '@/components/SpeakerMentionInput';
import { Copy, GlobeIcon, Send } from 'lucide-react';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { ModalType } from '@/hooks/useModalState';
import { useIsLinux } from '@/hooks/usePlatform';
import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * TranscriptPanel Component
 *
 * Displays transcript content with controls for copying and language settings.
 * Uses TranscriptContext, ConfigContext, and RecordingStateContext internally.
 */

interface TranscriptPanelProps {
  // indicates stop-processing state for transcripts; derived from backend statuses.
  isProcessingStop: boolean;
  isStopping: boolean;
  showModal: (name: ModalType, message?: string) => void;
}

export function TranscriptPanel({
  isProcessingStop,
  isStopping,
  showModal
}: TranscriptPanelProps) {
  // Contexts
  const { transcripts, transcriptContainerRef, copyTranscript } = useTranscripts();
  const { transcriptModelConfig } = useConfig();
  const { isRecording, isPaused } = useRecordingState();
  const { checkPermissions, isChecking, hasSystemAudio, hasMicrophone } = usePermissionCheck();
  const isLinux = useIsLinux();

  // Local state for user notes
  const [userNote, setUserNote] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);

  // Convert transcripts to segments for virtualized view
  const segments = useMemo(() =>
    transcripts.map(t => ({
      id: t.id,
      timestamp: t.audio_start_time ?? 0,
      endTime: t.audio_end_time,
      text: t.text,
      confidence: t.confidence,
    })),
    [transcripts]
  );

  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userNote.trim() || isSendingNote) return;

    try {
      setIsSendingNote(true);
      await invoke('add_user_note', { note: userNote.trim() });
      setUserNote('');
    } catch (error) {
      console.error('Failed to add user note:', error);
    } finally {
      setIsSendingNote(false);
    }
  };

  return (
    <div ref={transcriptContainerRef} className="w-full border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
      {/* Title area - Sticky header */}
      <div className="sticky top-0 z-10 bg-white p-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ButtonGroup>
                {transcripts?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyTranscript}
                    title="Copy Transcript"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    <span className='hidden md:inline'>
                      Copy
                    </span>
                  </Button>
                )}
                {transcriptModelConfig.provider === "localWhisper" &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showModal('languageSettings')}
                    title="Language"
                  >
                    <GlobeIcon className="h-4 w-4 mr-2" />
                    <span className='hidden md:inline'>
                      Language
                    </span>
                  </Button>
                }
              </ButtonGroup>
            </div>

            {/* User Note Input - Only show when recording */}
            {isRecording && (
              <form 
                onSubmit={handleAddNote}
                className="flex flex-1 max-w-md ml-4 items-center space-x-2"
              >
                <SpeakerMentionInput
                  placeholder="Add a note to transcript..."
                  value={userNote}
                  onChange={(val) => setUserNote(val)}
                  onSubmit={handleAddNote}
                  disabled={isSendingNote}
                  className="h-9"
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={!userNote.trim() || isSendingNote}
                  className="h-9 px-3"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Permission Warning - Not needed on Linux */}
      {!isRecording && !isChecking && !isLinux && (
        <div className="flex justify-center px-4 pt-4">
          <PermissionWarning
            hasMicrophone={hasMicrophone}
            hasSystemAudio={hasSystemAudio}
            onRecheck={checkPermissions}
            isRechecking={isChecking}
          />
        </div>
      )}

      {/* Transcript content */}
      <div className="pb-20">
        <div className="flex justify-center">
          <div className="w-2/3 max-w-[750px]">
            <VirtualizedTranscriptView
              segments={segments}
              isRecording={isRecording}
              isPaused={isPaused}
              isProcessing={isProcessingStop}
              isStopping={isStopping}
              enableStreaming={isRecording}
              showConfidence={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
