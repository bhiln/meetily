'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Transcript } from '@/types';
import { speakerService, Speaker } from '@/services/speakerService';
import { User, Info, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface MeetingSpeakersProps {
  transcripts: Transcript[];
}

export const MeetingSpeakers: React.FC<MeetingSpeakersProps> = ({ transcripts }) => {
  const [allSpeakers, setAllSpeakers] = useState<Speaker[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchSpeakers = async () => {
      try {
        const speakers = await speakerService.getAllSpeakers();
        setAllSpeakers(speakers);
      } catch (error) {
        console.error('Failed to fetch speakers:', error);
      }
    };
    fetchSpeakers();
  }, []);

  const mentionedSpeakers = useMemo(() => {
    if (allSpeakers.length === 0 || transcripts.length === 0) return [];
    
    const transcriptText = transcripts.map(t => t.text).join(' ').toLowerCase();
    
    return allSpeakers.filter(speaker => {
      const nameLower = speaker.name.toLowerCase();
      const atMention = `@${nameLower}`;
      return transcriptText.includes(nameLower) || transcriptText.includes(atMention);
    });
  }, [allSpeakers, transcripts]);

  if (mentionedSpeakers.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <User className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">People in this meeting</h3>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {mentionedSpeakers.map((speaker) => (
          <motion.div
            key={speaker.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/speakers?id=${speaker.id}`)}
            className="cursor-pointer"
          >
            <Card className="bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-full">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px]">
                    {speaker.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {speaker.voice_profile ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-gray-300" />
                    )}
                    <span className="text-[10px] text-gray-500">
                      {speaker.voice_profile ? 'Recognized' : 'No profile'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
