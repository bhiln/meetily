'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { speakerService, Speaker } from '@/services/speakerService';
import { User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeakerMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const SpeakerMentionInput: React.FC<SpeakerMentionInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  className
}) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [filteredSpeakers, setFilteredSpeakers] = useState<Speaker[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSpeakers = async () => {
      if (showMentions) {
        try {
          const speakers = await speakerService.searchSpeakers(mentionQuery);
          setFilteredSpeakers(speakers);
          setSelectedIndex(0);
        } catch (error) {
          console.error('Failed to search speakers:', error);
        }
      }
    };
    fetchSpeakers();
  }, [mentionQuery, showMentions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredSpeakers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredSpeakers.length) % filteredSpeakers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredSpeakers[selectedIndex]) {
          selectSpeaker(filteredSpeakers[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const query = textBeforeCursor.substring(atIndex + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const selectSpeaker = (speaker: Speaker) => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    const newValue = value.substring(0, atIndex) + `@${speaker.name} ` + textAfterCursor;
    onChange(newValue);
    setShowMentions(false);
    
    // Focus back and set cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = atIndex + speaker.name.length + 2;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      
      <AnimatePresence>
        {showMentions && filteredSpeakers.length > 0 && (
          <motion.div
            ref={mentionRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full mb-2 left-0 w-64 bg-white border rounded-lg shadow-xl z-50 overflow-hidden"
          >
            <div className="p-2 border-b bg-gray-50 text-[10px] font-bold uppercase text-gray-400">
              People
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {filteredSpeakers.map((speaker, index) => (
                <div
                  key={speaker.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => selectSpeaker(speaker)}
                >
                  <div className={`p-1.5 rounded-full ${index === selectedIndex ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{speaker.name}</span>
                    {speaker.user_context && (
                      <span className="text-[10px] text-gray-500 truncate">{speaker.user_context}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
