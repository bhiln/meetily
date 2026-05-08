'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Pencil, Trash2, User, ChevronRight, MessageSquare, Info, Mic, StopCircle, RefreshCw, Loader2 } from 'lucide-react';
import { speakerService, Speaker } from '@/services/speakerService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfig } from '@/contexts/ConfigContext';
import { useRouter } from 'next/navigation';

export default function SpeakersPage() {
  const { betaFeatures } = useConfig();
  const router = useRouter();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);

  // Redirect if feature is disabled
  useEffect(() => {
    if (!betaFeatures.speechIdentification) {
      router.push('/');
    }
  }, [betaFeatures.speechIdentification, router]);

  if (!betaFeatures.speechIdentification) {
    return null;
  }
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<Speaker | null>(null);
  
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [newSpeakerContext, setNewSpeakerContext] = useState('');

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingProgress, setRecordingVoiceProgress] = useState(0);
  const [recordingForId, setRecordingForId] = useState<string | null>(null);
  const [isModelDownloading, setIsModelDownloading] = useState(false);

  const fetchSpeakers = async () => {
    try {
      setIsLoading(true);
      const data = await speakerService.getAllSpeakers();
      setSpeakers(data);
    } catch (error) {
      console.error('Failed to fetch speakers:', error);
      toast.error('Failed to load speakers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpeakers();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchSpeakers();
      return;
    }
    try {
      const data = await speakerService.searchSpeakers(query);
      setSpeakers(data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleAddSpeaker = async () => {
    if (!newSpeakerName.trim()) {
      toast.error('Speaker name is required');
      return;
    }
    try {
      await speakerService.createSpeaker(newSpeakerName.trim(), newSpeakerContext.trim());
      toast.success('Speaker added successfully');
      setNewSpeakerName('');
      setNewSpeakerContext('');
      setIsAddDialogOpen(false);
      fetchSpeakers();
    } catch (error) {
      console.error('Failed to add speaker:', error);
      toast.error('Failed to add speaker');
    }
  };

  const handleUpdateSpeaker = async () => {
    if (!currentSpeaker || !newSpeakerName.trim()) return;
    try {
      await speakerService.updateSpeaker(currentSpeaker.id, newSpeakerName.trim(), newSpeakerContext.trim());
      toast.success('Speaker updated successfully');
      setIsEditDialogOpen(false);
      setCurrentSpeaker(null);
      setNewSpeakerName('');
      setNewSpeakerContext('');
      fetchSpeakers();
    } catch (error) {
      console.error('Failed to update speaker:', error);
      toast.error('Failed to update speaker');
    }
  };

  const handleDeleteSpeaker = async (id: string) => {
    if (!confirm('Are you sure you want to delete this speaker?')) return;
    try {
      await speakerService.deleteSpeaker(id);
      toast.success('Speaker deleted');
      fetchSpeakers();
    } catch (error) {
      console.error('Failed to delete speaker:', error);
      toast.error('Failed to delete speaker');
    }
  };

  const openEditDialog = (speaker: Speaker) => {
    setCurrentSpeaker(speaker);
    setNewSpeakerName(speaker.name);
    setNewSpeakerContext(speaker.user_context || '');
    setIsEditDialogOpen(true);
  };

  const handleDownloadModel = async () => {
    try {
      setIsModelDownloading(true);
      await speakerService.downloadDiarizationModel();
      toast.success('Diarization model ready');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download model');
    } finally {
      setIsModelDownloading(false);
    }
  };

  const handleRecordVoice = async (speaker: Speaker) => {
    try {
      setIsRecordingVoice(true);
      setRecordingForId(speaker.id);
      setRecordingVoiceProgress(0);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      let samples: number[] = [];
      const duration = 5000; // 5 seconds
      const startTime = Date.now();

      const stopRecording = async () => {
        source.disconnect();
        processor.disconnect();
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        
        setIsRecordingVoice(false);
        setRecordingForId(null);
        setRecordingVoiceProgress(0);

        try {
          toast.info('Processing voice profile...');
          await speakerService.associateVoice(speaker.id, samples);
          toast.success(`Voice profile saved for ${speaker.name}`);
          fetchSpeakers();
        } catch (error) {
          console.error('Association failed:', error);
          toast.error('Failed to save voice profile. Make sure the model is downloaded.');
        }
      };

      processor.onaudioprocess = (e: any) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Explicitly convert to number array to satisfy TypeScript
        for (let i = 0; i < inputData.length; i++) {
          samples.push(inputData[i]);
        }
        
        const elapsed = Date.now() - startTime;
        setRecordingVoiceProgress(Math.min(100, (elapsed / duration) * 100));

        if (elapsed >= duration) {
          stopRecording();
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (error) {
      console.error('Mic access failed:', error);
      toast.error('Could not access microphone');
      setIsRecordingVoice(false);
      setRecordingForId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Speakers</h1>
              <p className="text-sm text-gray-500">Manage known speakers and their context</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDownloadModel}
              disabled={isModelDownloading}
              className="text-gray-500 hover:text-blue-600"
            >
              {isModelDownloading ? (
                <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
              )}
              {isModelDownloading ? 'Diarization: Downloading...' : 'Diarization: Sync Model'}
            </Button>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Speaker
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Speaker</DialogTitle>
                  <DialogDescription>
                    Create a voice profile to recognize this speaker in future meetings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input 
                      placeholder="e.g. John Doe" 
                      value={newSpeakerName}
                      onChange={(e) => setNewSpeakerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Extra Context</label>
                    <textarea 
                      className="w-full min-h-[100px] p-3 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="e.g. CEO of ACME Inc. Preferred pronoun: they/them"
                      value={newSpeakerContext}
                      onChange={(e) => setNewSpeakerContext(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddSpeaker}>Create Speaker</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {/* Search Bar */}
          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input 
              className="pl-10 h-12 text-lg bg-white border-gray-200 shadow-sm"
              placeholder="Search speakers by name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : speakers.length === 0 ? (
            <Card className="text-center py-20 bg-white">
              <CardContent className="flex flex-col items-center pt-6">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                  <Users className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No speakers found</h3>
                <p className="text-gray-500 mb-6 max-w-sm">
                  {searchQuery ? `No results for "${searchQuery}"` : "Add speakers manually or associate them during a recording."}
                </p>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add your first speaker
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {speakers.map((speaker) => (
                  <motion.div
                    key={speaker.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="group hover:shadow-md transition-shadow duration-200 bg-white border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => openEditDialog(speaker)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDeleteSpeaker(speaker.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <CardTitle className="text-xl mt-4 group-hover:text-blue-600 transition-colors">
                          {speaker.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Added on {new Date(speaker.created_at).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {speaker.user_context ? (
                          <div className="bg-gray-50 p-3 rounded-md border border-gray-100 mb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Info className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-[10px] font-bold uppercase text-gray-400">Speaker Context</span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-3">
                              {speaker.user_context}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic mb-4">No extra context provided</p>
                        )}
                        
                        <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${speaker.voice_profile ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {speaker.voice_profile ? 'VOICE REGISTERED' : 'NO VOICE PROFILE'}
                            </span>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isRecordingVoice}
                            onClick={() => handleRecordVoice(speaker)}
                            className={`h-8 text-[10px] font-bold uppercase transition-all ${
                              isRecordingVoice && recordingForId === speaker.id
                                ? 'bg-red-50 border-red-200 text-red-600'
                                : 'hover:bg-blue-50 hover:text-blue-600'
                            }`}
                          >
                            {isRecordingVoice && recordingForId === speaker.id ? (
                              <>
                                <StopCircle className="w-3 h-3 mr-1 animate-pulse" />
                                {Math.round(recordingProgress)}%
                              </>
                            ) : (
                              <>
                                <Mic className="w-3 h-3 mr-1" />
                                {speaker.voice_profile ? 'Re-record' : 'Register Voice'}
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Speaker</DialogTitle>
            <DialogDescription>
              Update speaker information and context.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input 
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Extra Context</label>
              <textarea 
                className="w-full min-h-[100px] p-3 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={newSpeakerContext}
                onChange={(e) => setNewSpeakerContext(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setCurrentSpeaker(null);
            }}>Cancel</Button>
            <Button onClick={handleUpdateSpeaker}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
