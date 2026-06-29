/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { CHARACTERS_MAP } from "../constants";

interface MangaSpeechBubbleProps {
  characterId: string;
  text: string;
  isStreaming?: boolean;
}

export default function MangaSpeechBubble({
  characterId,
  text,
  isStreaming = false
}: MangaSpeechBubbleProps) {
  const character = CHARACTERS_MAP[characterId];

  if (!character) return null;

  // Render a beautiful manga-style text bubble next to the character
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 18 }}
      className="flex-1 w-full"
    >
      <div
        className="relative p-6 bg-[#121212]/95 border-2 rounded-lg shadow-xl font-sans flex flex-col justify-between h-full min-h-[120px] transition-all duration-300"
        style={{
          borderColor: character.color,
          boxShadow: `0 8px 24px -6px ${character.color}25`,
        }}
      >
        {/* Tail point of speech bubble pointing left towards character */}
        <div
          className="absolute -left-2 top-8 w-4 h-4 rotate-45 border-l-2 border-b-2 bg-[#121212] transition-colors duration-300"
          style={{
            borderColor: character.color,
          }}
        />

        {/* Header with name and badge */}
        <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono font-bold tracking-wider uppercase"
              style={{ color: character.color }}
            >
              {character.name}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-mono text-stone-500">
              {character.role}
            </span>
          </div>

          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-800 font-mono text-[9px] text-neutral-400">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: character.color }}
                ></span>
                <span
                  className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ backgroundColor: character.color }}
                ></span>
              </span>
              TRANSMITIENDO
            </div>
          )}
        </div>

        {/* Streamed Body Text */}
        <div className="text-stone-100 leading-relaxed text-sm md:text-base antialiased font-serif whitespace-pre-line select-text">
          {text ? (
            `"${text}"`
          ) : (
            <span className="italic text-stone-600 animate-pulse">
              Formulando argumento intelectual...
            </span>
          )}
        </div>

        {/* Manga corner bracket for design accentuation */}
        <div
          className="absolute bottom-2 right-2 w-3 h-3 border-r border-b opacity-50"
          style={{ borderColor: character.color }}
        />
      </div>
    </motion.div>
  );
}
