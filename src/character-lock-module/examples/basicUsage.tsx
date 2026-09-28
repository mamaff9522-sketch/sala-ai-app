/**
 * Character Lock Module - React Usage Example
 * Demonstrates mounting the CharacterLibrary component, selecting and locking characters,
 * and injecting character traits into image/video generation prompts.
 */

import React, { useState } from 'react';
import { CharacterLibrary } from '../components/CharacterLibrary';
import { Character } from '../types';
import { injectCharacterIntoPrompt } from '../prompt/promptInjector';
import { toggleCharacterLock } from '../core/characterEngine';

export const CharacterLockExampleApp: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('standing near a riverside cafe at sunset, cinematic lighting');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedChar = characters.find(c => c.id === activeCharacterId);

  // Injects locked traits into user prompt
  const compiledPrompt = selectedChar
    ? injectCharacterIntoPrompt(userPrompt, selectedChar, { strictContinuity: true })
    : userPrompt;

  const handleToggleLock = async (char: Character) => {
    const updated = await toggleCharacterLock(char);
    setCharacters(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 bg-slate-950 text-white min-h-screen">
      <header className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold">Sala AI - Character Lock Integration Example</h1>
        <p className="text-slate-400 text-sm">Upload reference images, analyze 4-layer profile, and lock consistency.</p>
      </header>

      {/* Trigger Character Library Modal */}
      <div className="flex gap-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium"
        >
          Open Character Library Modal
        </button>
      </div>

      {/* Selected Character Preview */}
      {selectedChar && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selectedChar.name}</h2>
            <button
              onClick={() => handleToggleLock(selectedChar)}
              className={`px-3 py-1 rounded text-xs font-bold ${
                selectedChar.lockStatus === 'LOCKED' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {selectedChar.lockStatus === 'LOCKED' ? '🔒 LOCKED' : '🔓 UNLOCKED'}
            </button>
          </div>
          <p className="text-sm text-slate-300">Trigger: {selectedChar.triggerTag}</p>
          <p className="text-sm text-slate-300">Hair: {selectedChar.visualProfile?.hair || 'N/A'}</p>
          <p className="text-sm text-slate-300">Outfit: {selectedChar.visualProfile?.visibleOutfit || 'N/A'}</p>
        </div>
      )}

      {/* Prompt Injection Preview */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">Target Generation Prompt:</label>
        <textarea
          value={userPrompt}
          onChange={e => setUserPrompt(e.target.value)}
          className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-sm"
          rows={3}
        />
        <div className="p-3 bg-slate-900/60 border border-dashed border-slate-800 rounded-lg">
          <p className="text-xs text-slate-400 font-semibold mb-1">FINAL COMPILED PROMPT (SENT TO MODEL):</p>
          <p className="text-sm text-emerald-300 font-mono">{compiledPrompt}</p>
        </div>
      </div>

      {/* Embedded or Modal Character Library */}
      <CharacterLibrary
        characters={characters}
        onRefreshCharacters={saved => {
          if (saved) {
            setCharacters(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
          }
        }}
        onUseCharacterInStudio={charId => {
          setActiveCharacterId(charId);
          setIsModalOpen(false);
        }}
        isOpenModal={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        onOpenModal={() => setIsModalOpen(true)}
      />
    </div>
  );
};
