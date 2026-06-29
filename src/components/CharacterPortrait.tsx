/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CHARACTERS_MAP } from "../constants";

interface CharacterPortraitProps {
  characterId: string;
  expression: "neutro" | "hablando" | "caracteristico" | "sorprendido" | "convencido";
  isTalking: boolean;
  reaction?: string; // "sweat" | "?" | "!?" | ""
  availableFiles?: string[];
}

export default function CharacterPortrait({
  characterId,
  expression,
  isTalking,
  reaction,
  availableFiles
}: CharacterPortraitProps) {
  const [imgError, setImgError] = useState(false);
  const character = CHARACTERS_MAP[characterId];

  // Check if matching specific expression image is verified as present on back-end, otherwise fallback to any available file for this character
  const matchedFile = (() => {
    if (!availableFiles || availableFiles.length === 0) return null;
    
    // 1. Try exact expression
    const exact = availableFiles.find(
      (f) =>
        f.toLowerCase() === `${expression}.png` ||
        f.toLowerCase() === `${expression}.jpg` ||
        f.toLowerCase() === `${expression}.jpeg`
    );
    if (exact) return exact;

    // 2. Try 'neutro' fallback
    const neutro = availableFiles.find(
      (f) =>
        f.toLowerCase() === "neutro.png" ||
        f.toLowerCase() === "neutro.jpg" ||
        f.toLowerCase() === "neutro.jpeg"
    );
    if (neutro) return neutro;

    // 3. Fallback to any image file
    return availableFiles[0];
  })();

  const shouldRenderImg = !!matchedFile && !imgError;

  // Try to load user-uploaded assets
  const imageSrc = matchedFile ? `/assets/${characterId}/${matchedFile}` : "";

  // Reset error when source changes
  useEffect(() => {
    setImgError(false);
  }, [characterId, expression]);

  // Occasional blink trigger for idle state
  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  if (!character) return null;

  // Custom SVG Silhouettes to make the app look stunning out of the box
  const renderSVGSilhouette = () => {
    const strokeColor = "currentColor";
    const accentColor = character.color;

    // Render unique hair and accessory curves matching the exact prompt visual details!
    if (characterId === "estratega") {
      // Elegant female bun, high collar blazer
      return (
        <svg viewBox="0 0 120 200" className="w-full h-full text-slate-800" fill="none">
          {/* Subtle background glow */}
          <circle cx="60" cy="100" r="50" fill={`${accentColor}12`} />
          
          <path
            d="M60 45 C70 45, 78 55, 78 68 C78 78, 70 85, 60 85 C50 85, 42 78, 42 68 C42 55, 50 45, 60 45 Z"
            fill={`${accentColor}25`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Tied bun hair */}
          <circle cx="60" cy="38" r="8" fill={`${accentColor}40`} stroke={strokeColor} strokeWidth="1.5" />
          {/* Head tilt / neck */}
          <path d="M56 84 L56 102 M64 84 L64 102" stroke={strokeColor} strokeWidth="1.5" />
          {/* Elegant hand on chin (characteristic or thinking gesture) */}
          {(expression === "caracteristico" || expression === "neutro") && (
            <path d="M50 86 Q42 86, 50 78" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          )}
          {/* High collar blazer & shoulders */}
          <path
            d="M30 140 L45 105 L52 112 L60 110 L68 112 L75 105 L90 140 Z"
            fill={`${accentColor}15`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          <path d="M48 115 L52 140 M72 115 L68 140" stroke={strokeColor} strokeWidth="1" />
          {/* Subtle facial cues based on expression */}
          {expression === "sorprendido" && (
            <circle cx="60" cy="65" r="3" fill={accentColor} />
          )}
          {expression === "hablando" && (
            <ellipse cx="60" cy="72" rx="3" ry="5" fill={`${accentColor}40`} stroke={strokeColor} strokeWidth="1" />
          )}
          {expression === "convencido" && (
            <path d="M55 70 Q60 74, 65 70" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          )}
          {/* Eye line */}
          {!isBlinking ? (
            <g opacity="0.75" stroke={strokeColor} strokeWidth="1.5">
              <path d="M50 63 Q54 61, 56 63" />
              <path d="M64 63 Q66 61, 70 63" />
            </g>
          ) : (
            <g opacity="0.75" stroke={strokeColor} strokeWidth="1.5">
              <line x1="49" y1="63" x2="57" y2="63" />
              <line x1="63" y1="63" x2="71" y2="63" />
            </g>
          )}
        </svg>
      );
    } else if (characterId === "esceptico") {
      // Sharp black hair smirk male, turtleneck suit
      return (
        <svg viewBox="0 0 120 200" className="w-full h-full text-slate-800" fill="none">
          <circle cx="60" cy="100" r="50" fill={`${accentColor}12`} />
          {/* Head & Neck */}
          <path d="M55 86 L55 104 M65 86 L65 104" stroke={strokeColor} strokeWidth="1.5" />
          <path
            d="M60 42 C72 42, 80 50, 78 68 C76 82, 68 85, 60 85 C52 85, 44 82, 42 68 C40 50, 48 42, 60 42 Z"
            fill={`${accentColor}25`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Sharp messy hair spikes */}
          <path
            d="M40 52 L45 42 L52 38 L62 42 L72 37 L78 45 L83 55 L75 52 L68 45 L60 48 L48 45 Z"
            fill={`${accentColor}40`}
            stroke={strokeColor}
            strokeWidth="1.2"
          />
          {/* Turtleneck & coat shoulders */}
          <path
            d="M32 140 L45 110 L75 110 L88 140 Z"
            fill={`${accentColor}15`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Turtleneck fold */}
          <path d="M48 104 L48 114 M72 104 L72 114" stroke={strokeColor} strokeWidth="1.5" />
          <rect x="48" y="104" width="24" height="8" rx="2" fill={`${accentColor}30`} stroke={strokeColor} strokeWidth="1.2" />
          {/* Face Expression Cues */}
          {expression === "caracteristico" && (
            <path d="M54 71 Q60 67, 66 73" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" /> // Smirk
          )}
          {expression === "hablando" && (
            <ellipse cx="60" cy="73" rx="4" ry="4" fill={`${accentColor}50`} stroke={strokeColor} strokeWidth="1" />
          )}
          {expression === "sorprendido" && (
            <circle cx="60" cy="70" r="4.5" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          )}
          {expression === "convencido" && (
            <path d="M55 74 Q60 71, 65 74" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          )}
          {!isBlinking ? (
            <g opacity="0.85" stroke={strokeColor} strokeWidth="1.5">
              <path d="M49 61 L55 64" />
              <path d="M71 61 L65 64" />
            </g>
          ) : (
            <g opacity="0.85" stroke={strokeColor} strokeWidth="1.5">
              <line x1="48" y1="63" x2="56" y2="63" />
              <line x1="64" y1="63" x2="72" y2="63" />
            </g>
          )}
        </svg>
      );
    } else if (characterId === "ingeniera") {
      // High bun bun hair, olive blazer
      return (
        <svg viewBox="0 0 120 200" className="w-full h-full text-slate-800" fill="none">
          <circle cx="60" cy="100" r="50" fill={`${accentColor}12`} />
          {/* High bun hair */}
          <circle cx="60" cy="33" r="10" fill={`${accentColor}40`} stroke={strokeColor} strokeWidth="1.5" />
          <path
            d="M60 45 C71 45, 76 53, 76 66 C76 77, 69 84, 60 84 C51 84, 44 77, 44 66 C44 53, 49 45, 60 45 Z"
            fill={`${accentColor}25`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Face details */}
          {expression === "caracteristico" && (
            <path d="M45 105 Q30 115, 45 125" stroke={strokeColor} strokeWidth="1.5" fill="none" /> // Crossed arm feel
          )}
          {expression === "hablando" && (
            <ellipse cx="60" cy="72" rx="3.5" ry="4.5" fill={`${accentColor}50`} stroke={strokeColor} strokeWidth="1" />
          )}
          {expression === "sorprendido" && (
            <path d="M55 75 Q60 68, 65 75" stroke={strokeColor} strokeWidth="1.8" />
          )}
          {/* Blazer shoulders */}
          <path
            d="M28 140 L45 106 L75 106 L92 140 Z"
            fill={`${accentColor}15`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {!isBlinking ? (
            <g opacity="0.85" stroke={strokeColor} strokeWidth="1.5">
              <path d="M49 61 Q53 60, 56 61" />
              <path d="M64 61 Q67 60, 71 61" />
            </g>
          ) : (
            <g opacity="0.85" stroke={strokeColor} strokeWidth="1.5">
              <line x1="48" y1="61" x2="56" y2="61" />
              <line x1="64" y1="61" x2="72" y2="61" />
            </g>
          )}
        </svg>
      );
    } else if (characterId === "inversor") {
      // Refined older gentleman, brown turtleneck, neat grey hair
      return (
        <svg viewBox="0 0 120 200" className="w-full h-full text-slate-800" fill="none">
          <circle cx="60" cy="100" r="50" fill={`${accentColor}12`} />
          <path
            d="M60 48 C71 48, 77 56, 77 69 C77 79, 70 85, 60 85 C50 85, 43 79, 43 69 C43 56, 49 48, 60 48 Z"
            fill={`${accentColor}25`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Sleek older hair contour */}
          <path
            d="M42 56 Q40 42, 60 38 Q80 42, 78 56 L81 65 L76 62 Q60 52, 44 62 Z"
            fill="#d1d5db"
            stroke={strokeColor}
            strokeWidth="1.2"
          />
          {/* Glasses or neat eye lines */}
          <g opacity="0.85" stroke={strokeColor} strokeWidth="1.2">
            <rect x="47" y="58" width="10" height="7" rx="1" />
            <rect x="63" y="58" width="10" height="7" rx="1" />
            <line x1="57" y1="61" x2="63" y2="61" strokeWidth="1.5" />
          </g>
          {/* Turtleneck & coat jacket */}
          <path
            d="M30 140 L44 112 L76 112 L90 140 Z"
            fill={`${accentColor}15`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          <path d="M46 112 C46 100, 74 100, 74 112 Z" fill={`${accentColor}30`} stroke={strokeColor} strokeWidth="1.2" />
          {/* Hand on chin (thinking) */}
          {expression === "caracteristico" && (
            <path d="M60 86 Q54 88, 60 98" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          )}
          {expression === "hablando" && (
            <ellipse cx="60" cy="74" rx="3" ry="4" fill={`${accentColor}50`} stroke={strokeColor} strokeWidth="1" />
          )}
          {expression === "sorprendido" && (
            <circle cx="60" cy="74" r="3.5" fill="none" stroke={strokeColor} strokeWidth="1.2" />
          )}
        </svg>
      );
    } else {
      // Coral sweater young client, messy brown hair, friendly sweater look
      return (
        <svg viewBox="0 0 120 200" className="w-full h-full text-slate-800" fill="none">
          <circle cx="60" cy="100" r="50" fill={`${accentColor}12`} />
          <path
            d="M60 46 C69 46, 76 53, 76 66 C76 77, 69 83, 60 83 C51 83, 44 77, 44 66 C44 53, 51 46, 60 46 Z"
            fill={`${accentColor}25`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Messy brown hair spikes */}
          <path
            d="M40 54 L44 42 L52 46 L60 40 L68 46 L76 42 L80 54 L75 58 Q60 50, 45 58 Z"
            fill={`${accentColor}40`}
            stroke={strokeColor}
            strokeWidth="1.2"
          />
          {/* Friendly round eyes */}
          {!isBlinking ? (
            <g opacity="0.85" stroke={strokeColor} strokeWidth="1.5">
              <circle cx="51" cy="62" r="1.5" fill="currentColor" />
              <circle cx="69" cy="62" r="1.5" fill="currentColor" />
            </g>
          ) : (
            <g opacity="0.85" stroke={strokeColor} strokeWidth="1.5">
              <line x1="48" y1="62" x2="54" y2="62" />
              <line x1="66" y1="62" x2="72" y2="62" />
            </g>
          )}
          {/* Friendly sweater collar */}
          <path
            d="M30 140 L44 118 Q60 126, 76 118 L90 140 Z"
            fill={`${accentColor}15`}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          <path d="M44 118 C44 118, 60 130, 76 118" stroke={strokeColor} strokeWidth="1.5" />
          {/* Hand scratching neck (characteristic) */}
          {expression === "caracteristico" && (
            <path d="M74 85 Q82 92, 74 100" stroke={strokeColor} strokeWidth="1.5" fill="none" />
          )}
          {expression === "hablando" && (
            <ellipse cx="60" cy="72" rx="3.5" ry="4" fill={`${accentColor}50`} stroke={strokeColor} strokeWidth="1" />
          )}
          {expression === "sorprendido" && (
            <ellipse cx="60" cy="72" rx="5" ry="5" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          )}
        </svg>
      );
    }
  };

  // Reactions overlay logic based on the manga rules
  const renderMangaReactionSymbol = () => {
    if (!reaction) return null;

    let symbol = "";
    let animationClass = "";

    if (reaction === "?") {
      symbol = "?";
      animationClass = "text-blue-500 font-bold text-3xl";
    } else if (reaction === "!?") {
      symbol = "!?";
      animationClass = "text-red-500 font-extrabold text-3xl italic";
    } else if (reaction === "sweat") {
      // Soft comic sweat drop
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 5 }}
          exit={{ opacity: 0 }}
          className="absolute right-4 top-8 pointer-events-none"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21C16.4183 21 20 17.4183 20 13C20 8.58172 12 2 12 2C12 2 4 8.58172 4 13C4 17.4183 7.58172 21 12 21Z"
              fill="#adc4fc"
              stroke="#2563eb"
              strokeWidth="1.5"
            />
          </svg>
        </motion.div>
      );
    } else {
      return null;
    }

    return (
      <motion.div
        initial={{ scale: 0, rotate: -15, opacity: 0 }}
        animate={{ scale: [1.2, 1.0], rotate: [20, 0], opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
        className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white px-2 py-0.5 rounded-md border border-zinc-300 shadow-md pointer-events-none select-none z-10"
      >
        <span className={animationClass} style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          {symbol}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Portait frame mapping to character signature color */}
      <motion.div
        className={`relative w-24 h-40 sm:w-32 sm:h-52 lg:w-36 lg:h-56 rounded-md overflow-hidden bg-zinc-50 border-2 transition-all duration-500 ${
          isTalking
            ? "border-[3px] shadow-[0_0_12px_rgba(0,0,0,0.15)] ring-2"
            : "border-zinc-300 shadow-sm opacity-65"
        }`}
        style={{
          borderColor: isTalking ? character.color : "#d4d4d8",
          boxShadow: isTalking ? `0 6px 16px -4px ${character.color}25` : "none",
          transformOrigin: "bottom center",
          // Opacity is set explicitly as dictated by JERARQUÍA DE MOVIMIENTO
          opacity: isTalking ? 1.0 : 0.55,
        }}
        // CAPA DE VIDA EN REPOSO constant breathing
        animate={
          isTalking
            ? {
                scale: 1.06, // Talking character grows sutilmente (escala ~1.06)
              }
            : {
                scale: [1.0, 1.015, 1.0], // Constant breathing loop (scale 1.0 a 1.015)
              }
        }
        transition={
          isTalking
            ? { type: "spring", stiffness: 180, damping: 15 }
            : {
                repeat: Infinity,
                duration: 4.5,
                ease: "easeInOut",
              }
        }
      >
        {/* Subtle background signature pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] transition-colors duration-500"
          style={{ backgroundColor: character.color }}
        />

        {/* Character Image Tag or fallback custom SVG */}
        <div className="w-full h-full flex items-end">
          {shouldRenderImg ? (
            <img
              src={imageSrc}
              alt={`${character.name} - ${expression}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-bottom"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2 text-zinc-400">
              {renderSVGSilhouette()}
            </div>
          )}
        </div>

        {/* Shadow Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {/* Active Speaker Ring Tint */}
        {isTalking && (
          <div
            className="absolute inset-0 border-2 pointer-events-none"
            style={{ borderColor: `${character.color}35` }}
          />
        )}
      </motion.div>

      {/* Manga Expression Overlay Symbols */}
      <AnimatePresence>{renderMangaReactionSymbol()}</AnimatePresence>

      {/* Character Name under frame */}
      <div className="mt-2 text-center">
        <span
          className="text-xs font-mono font-medium tracking-tight uppercase px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: `${character.color}10`,
            color: character.color,
          }}
        >
          {character.name}
        </span>
      </div>
    </div>
  );
}
