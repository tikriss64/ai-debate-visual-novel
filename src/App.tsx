/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BrainCircuit,
  Volume2,
  VolumeX,
  History as HistoryIcon,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  ArrowRight,
  PlusCircle,
  Trophy,
  Loader2,
  Sparkles,
  RefreshCw,
  Info
} from "lucide-react";
import { SavedDebate, DebateTurn, Verdict } from "./types";
import { CHARACTERS_LIST, CHARACTERS_MAP, SUGGESTED_TOPICS } from "./constants";
import CharacterPortrait from "./components/CharacterPortrait";
import MangaSpeechBubble from "./components/MangaSpeechBubble";
import SupportIndicators from "./components/SupportIndicators";
import HistoryList from "./components/HistoryList";
import VerdictView from "./components/VerdictView";
import { speakText, stopSpeech } from "./lib/speech";



export default function App() {
  // Screens: 'start' | 'debate' | 'verdict'
  const [screen, setScreen] = useState<"start" | "debate" | "verdict">("start");

  // User question states
  const [question, setQuestion] = useState("");
  const [isVerifyingKey, setIsVerifyingKey] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isMockMode, setIsMockMode] = useState(false);

  // Saved debates from localStorage
  const [savedDebates, setSavedDebates] = useState<SavedDebate[]>([]);
  const [selectedDebate, setSelectedDebate] = useState<SavedDebate | null>(null);

  // Live debate variables
  const [currentPhase, setCurrentPhase] = useState<number>(1); // 1: Tesis, 2: Ataque, 3: Defensa, 4: Voto
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [activeTurnIdx, setActiveTurnIdx] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [supportRatings, setSupportRatings] = useState<Record<string, { initial: number; current: number }>>({});

  // Overlays or effects
  const [activeReactions, setActiveReactions] = useState<Record<string, string>>({});
  const [concededCharacter, setConcededCharacter] = useState<string | null>(null);
  const [showConcededFlash, setShowConcededFlash] = useState(false);

  // Audio settings (persistidos en localStorage para recordar la preferencia)
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ai_debates_speech") === "1";
  });
  const [autoPlayEnabled, setAutoPlayEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("ai_debates_autoplay");
    return v === null ? true : v === "1";
  });

  // Sincroniza preferencias a localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ai_debates_speech", speechEnabled ? "1" : "0");
    } catch {}
  }, [speechEnabled]);
  useEffect(() => {
    try {
      localStorage.setItem("ai_debates_autoplay", autoPlayEnabled ? "1" : "0");
    } catch {}
  }, [autoPlayEnabled]);

  // Verdict response
  const [finalVerdict, setFinalVerdict] = useState<Verdict | null>(null);
  const [isSynthesizingVerdict, setIsSynthesizingVerdict] = useState(false);

  // Available character image assets
  const [availableAssets, setAvailableAssets] = useState<Record<string, string[]>>({});

  // Auto-play timer ref
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);



  // Load saved debates and verify API keys on mount
  useEffect(() => {
    const saved = localStorage.getItem("ai_debates_history");
    if (saved) {
      try {
        setSavedDebates(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse debate history:", e);
      }
    }

    // Verify if environment has API key
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
        setIsMockMode(!!data.mock);
        setIsVerifyingKey(false);
      })
      .catch(() => {
        setIsVerifyingKey(false);
      });

    // Check custom character image assets
    fetch("/api/assets")
      .then((res) => res.json())
      .then((data) => {
        setAvailableAssets(data);
      })
      .catch((e) => {
        console.warn("Failed to check character images:", e);
      });
  }, []);

  // Save history helper
  const saveDebateToHistory = (newDebate: SavedDebate) => {
    const updated = [newDebate, ...savedDebates.filter((d) => d.id !== newDebate.id)];
    setSavedDebates(updated);
    localStorage.setItem("ai_debates_history", JSON.stringify(updated));
  };

  // Delete debate helper
  const handleDeleteDebate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedDebates.filter((d) => d.id !== id);
    setSavedDebates(updated);
    localStorage.setItem("ai_debates_history", JSON.stringify(updated));
    if (selectedDebate?.id === id) {
      setSelectedDebate(null);
    }
  };

  // Generate dynamic, realistic values for support rates at start of debate
  const initSupportRatings = () => {
    const ratings: Record<string, { initial: number; current: number }> = {};
    const baselines: Record<string, number> = {
      estratega: 35,
      esceptico: 25,
      ingeniera: 32,
      inversor: 30,
      cliente: 38
    };

    CHARACTERS_LIST.forEach((c) => {
      const variation = Math.floor(Math.random() * 9) - 4; // -4 to +4
      const initial = Math.max(15, baselines[c.id] + variation);
      ratings[c.id] = { initial, current: initial };
    });
    setSupportRatings(ratings);
    return ratings;
  };

  // Active turn triggers voice readout, target reactions, and autoplay timer
  useEffect(() => {
    if (turns.length === 0 || activeTurnIdx >= turns.length) return;

    const currentTurn = turns[activeTurnIdx];
    if (!currentTurn) return;

    // Optimización: mientras se generan respuestas en streaming, este efecto se
    // re-dispararía con cada chunk de texto. Como la voz, las reacciones y el autoplay
    // solo deben actuar sobre un turno YA completo, salimos temprano durante la generación.
    // Cuando isGenerating pasa a false, el efecto vuelve a ejecutarse y procesa el turno.
    if (isGenerating) return;

    // Reset reactions overlay with 500ms delay as requested
    setActiveReactions({});
    let reactTimeout: NodeJS.Timeout | null = null;
    if (currentTurn.phase === 2 && currentTurn.targetCharacterId) {
      const targetId = currentTurn.targetCharacterId;
      const reactionSymbol = currentTurn.reaction || "sweat";

      reactTimeout = setTimeout(() => {
        setActiveReactions((prev) => ({ ...prev, [targetId]: reactionSymbol }));
      }, 500);
    }

    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);

    let turnTimeoutCleared = false;
    const advanceTurn = () => {
      if (turnTimeoutCleared) return;
      turnTimeoutCleared = true;
      if (autoPlayEnabled && !isGenerating) {
        if (activeTurnIdx < turns.length - 1) {
          setActiveTurnIdx((prev) => prev + 1);
        }
      }
    };

    if (speechEnabled && currentTurn.text && !isGenerating) {
      // Hablar solo cuando NO se está generando: durante el streaming este efecto
      // se re-dispara en cada chunk y reiniciaría la voz constantemente (tartamudeo).
      const words = currentTurn.text.split(" ").length;
      // High-fidelity fallback watchdog timeout of 550ms/word + 8 seconds padding, so it NEVER cuts off prematurely even on slow speech engines
      const watchdogTime = Math.max(8000, words * 550 + 8000);

      speakText(currentTurn.text, currentTurn.characterId, () => {
        // Speech completed! Add a mini-pause of 1000ms for dramatic visual novel pacing
        setTimeout(() => {
          advanceTurn();
        }, 1000);
      });

      if (autoPlayEnabled && !isGenerating) {
        autoPlayTimerRef.current = setTimeout(() => {
          console.log("[Speech Watchdog] Speech timed out, advancing proactively");
          advanceTurn();
        }, watchdogTime);
      }
    } else {
      // Speech disabled, traditional word-count-based reading delay
      if (autoPlayEnabled && !isGenerating && currentTurn.text) {
        const words = currentTurn.text.split(" ").length;
        // Increase base reading delay to 380ms per word with a minimum of 4500ms, making it much more comfortable to read
        const readingDelayMs = Math.max(4500, words * 380);

        autoPlayTimerRef.current = setTimeout(() => {
          advanceTurn();
        }, readingDelayMs);
      }
    }

    return () => {
      turnTimeoutCleared = true;
      if (reactTimeout) clearTimeout(reactTimeout);
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [activeTurnIdx, turns, speechEnabled, autoPlayEnabled, isGenerating]);

  // Parallel stream loader helper
  const streamCharacterTurn = async (
    charId: string,
    phase: number,
    bodyParams: any
  ): Promise<string> => {
    const turnId = `${phase}-${charId}-${Date.now()}`;

    // Add empty turn placeholder inside current state
    setTurns((prev) => {
      const exists = prev.some((t) => t.characterId === charId && t.phase === phase);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: turnId,
          characterId: charId,
          phase,
          text: "",
          expression: "hablando",
          targetCharacterId: bodyParams.targetCharacterId,
          reaction: bodyParams.reaction
        }
      ];
    });

    try {
      const response = await fetch("/api/debate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: charId,
          phase,
          topic: question,
          ...bodyParams
        })
      });

      if (!response.ok) {
        throw new Error("Fatal network response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let textBuffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          textBuffer += chunk;

          // Push streaming text chunk into specific turns array item
          setTurns((prev) =>
            prev.map((t) => (t.characterId === charId && t.phase === phase ? { ...t, text: textBuffer } : t))
          );
        }
      }

      // Restore expression to neutral or characteristic once completed
      setTurns((prev) =>
        prev.map((t) =>
          t.characterId === charId && t.phase === phase ? { ...t, expression: "neutro" } : t
        )
      );

      return textBuffer;
    } catch (e: any) {
      console.error(`Streaming failed for ${charId}:`, e);
      const errorText = `[Error de conexión: ${e.message || "reintente"}]`;
      setTurns((prev) =>
        prev.map((t) => (t.characterId === charId && t.phase === phase ? { ...t, text: errorText } : t))
      );
      return errorText;
    }
  };

  // Phase 1: Begin core debate
  const handleStartDebate = async (selectedTopicText?: string) => {
    const finalQuestion = selectedTopicText || question;
    if (!finalQuestion.trim()) return;

    setQuestion(finalQuestion);
    setScreen("debate");
    setCurrentPhase(1);
    setTurns([]);
    setActiveTurnIdx(0);
    setConcededCharacter(null);
    setFinalVerdict(null);
    setIsGenerating(true);

    const initialRatings = initSupportRatings();

    // Trigger all 5 streams simultaneously in parallel
    const promises = CHARACTERS_LIST.map((c) =>
      streamCharacterTurn(c.id, 1, {})
    );

    await Promise.all(promises);
    setIsGenerating(false);

    // Save temporary state
    const currentDebate: SavedDebate = {
      id: `debate-${Date.now()}`,
      topic: finalQuestion,
      date: new Date().toISOString(),
      history: [],
      supportRatings: initialRatings,
      verdict: null
    };
    setSelectedDebate(currentDebate);
  };

  // Phase 2: Crucial attacks
  const handleStartAttacks = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setCurrentPhase(2);

    // Ring target mapping:
    // estratega -> inversor
    // inversor -> ingeniera
    // ingeniera -> cliente
    // cliente -> esceptico
    // esceptico -> estratega
    const ringTargets: Record<string, { targetId: string; reaction: "sweat" | "?" | "!?" }> = {
      // Cada personaje ataca a otro y al objetivo se le dibuja un símbolo manga.
      // sweat = nervios, ? = confusión, !? = pillado a contrapié.
      estratega: { targetId: "inversor", reaction: "sweat" },
      inversor: { targetId: "ingeniera", reaction: "!?" },
      ingeniera: { targetId: "cliente", reaction: "?" },
      cliente: { targetId: "esceptico", reaction: "sweat" },
      esceptico: { targetId: "estratega", reaction: "!?" }
    };

    // Grab phase 1 theses generated
    const phase1Turns = turns.filter((t) => t.phase === 1);

    const promises = CHARACTERS_LIST.map((c) => {
      const ringAttr = ringTargets[c.id];
      const targetCharTurn = phase1Turns.find((t) => t.characterId === ringAttr.targetId);
      const targetThesisText = targetCharTurn?.text || "Tesis vacía";

      return streamCharacterTurn(c.id, 2, {
        targetCharacterId: ringAttr.targetId,
        targetThesis: targetThesisText,
        reaction: ringAttr.reaction
      });
    });

    const results = await Promise.all(promises);

    // Dynamic support rate shifting after heavy crossover attacks:
    // Decrement targets, slight increment to robust attacking statements
    setSupportRatings((prev) => {
      const next = { ...prev };
      Object.entries(ringTargets).forEach(([attacker, info]) => {
        const loss = Math.floor(Math.random() * 4) + 2; // -2 to -5
        next[info.targetId] = {
          ...next[info.targetId],
          current: Math.max(10, next[info.targetId].current - loss)
        };
        const gain = Math.floor(Math.random() * 3) + 1; // +1 to +3
        next[attacker] = {
          ...next[attacker],
          current: Math.min(85, next[attacker].current + gain)
        };
      });
      return next;
    });

    // Reset active cursor index to point to first Attack turn
    const firstAttackIdx = turns.length;
    setActiveTurnIdx(firstAttackIdx);
    setIsGenerating(false);
  };

  // Phase 3: Sincere defenses & concession logic
  const handleStartDefenses = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setCurrentPhase(3);

    // Match who attacked whom in Phase 2 for context mapping:
    // estratega was attacked by esceptico
    // esceptico was attacked by cliente
    // cliente was attacked by ingeniera
    // ingeniera was attacked by inversor
    // inversor was attacked by estratega
    const defenseMapping: Record<string, string> = {
      estratega: "esceptico",
      esceptico: "cliente",
      cliente: "ingeniera",
      ingeniera: "inversor",
      inversor: "estratega"
    };

    const phase1Turns = turns.filter((t) => t.phase === 1);
    const phase2Turns = turns.filter((t) => t.phase === 2);

    // Random choice for a single character to concede on Phase 3
    const potentialConceders = ["cliente", "inversor", "ingeniera"];
    const chosenConceder = potentialConceders[Math.floor(Math.random() * potentialConceders.length)];
    setConcededCharacter(chosenConceder);

    const promises = CHARACTERS_LIST.map((c) => {
      const attackerId = defenseMapping[c.id];
      const attackTurn = phase2Turns.find((t) => t.characterId === attackerId);
      const originalThesisTurn = phase1Turns.find((t) => t.characterId === c.id);

      return streamCharacterTurn(c.id, 3, {
        attackerId,
        attackText: attackTurn?.text || "Crítica general",
        originalThesis: originalThesisTurn?.text || "Tesis vacía",
        concede: c.id === chosenConceder // Custom instruction handled on gemini prompt side implicitly
      });
    });

    await Promise.all(promises);

    // Visual novelty transition event for opinion changing
    setShowConcededFlash(true);
    setTimeout(() => {
      setShowConcededFlash(false);
    }, 1200);

    // Update rating spikes for concessions or brilliant defensive arguments
    setSupportRatings((prev) => {
      const next = { ...prev };
      // The Conceding character gets slightly boosted because users love vulnerability and honesty!
      next[chosenConceder] = {
        ...next[chosenConceder],
        current: Math.min(90, next[chosenConceder].current + 8)
      };
      // Other defenses slightly change ratings
      CHARACTERS_LIST.forEach((c) => {
        if (c.id !== chosenConceder) {
          const shift = Math.floor(Math.random() * 5) - 2; // -2 to +2
          next[c.id] = {
            ...next[c.id],
            current: Math.min(90, Math.max(10, next[c.id].current + shift))
          };
        }
      });
      return next;
    });

    // Advance turn focus and expression parameters
    setTurns((prev) =>
      prev.map((t) =>
        t.characterId === chosenConceder && t.phase === 3 ? { ...t, expression: "convencido" } : t
      )
    );

    const firstDefenseIdx = turns.length;
    setActiveTurnIdx(firstDefenseIdx);
    setIsGenerating(false);
  };

  // Phase 4: Sincere voting
  const handleStartVotes = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setCurrentPhase(4);

    const runningTheses = turns.filter((t) => t.phase === 3);
    const thesesSummary = CHARACTERS_LIST.map((c) => {
      const turnObj = runningTheses.find((t) => t.characterId === c.id);
      return `${c.name}: "${turnObj?.text || "Tesis consolidada"}"`;
    }).join("\n");

    const promises = CHARACTERS_LIST.map((c) =>
      streamCharacterTurn(c.id, 4, {
        thesesList: thesesSummary
      })
    );

    const results = await Promise.all(promises);

    // Apoyo REAL: derivado de los votos emitidos en esta fase, no de valores aleatorios.
    // Cada personaje vota a otro; detectamos el primer nombre (sin artículo) mencionado
    // en su texto que no sea él mismo, y contamos los votos recibidos por cada tesis.
    setSupportRatings((prev) => {
      const voteCounts: Record<string, number> = {};
      CHARACTERS_LIST.forEach((c) => (voteCounts[c.id] = 0));

      const keyOf = (name: string) => name.toLowerCase().replace(/^(el|la)\s+/, "");

      results.forEach((voteText, idx) => {
        const voterId = CHARACTERS_LIST[idx].id;
        const lower = (voteText || "").toLowerCase();
        let bestId: string | null = null;
        let bestPos = Infinity;
        CHARACTERS_LIST.forEach((c) => {
          if (c.id === voterId) return;
          const pos = lower.indexOf(keyOf(c.name));
          if (pos !== -1 && pos < bestPos) {
            bestPos = pos;
            bestId = c.id;
          }
        });
        if (bestId) voteCounts[bestId] += 1;
      });

      const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0) || 1;

      const next = { ...prev };
      CHARACTERS_LIST.forEach((c) => {
        const votePct = (voteCounts[c.id] / totalVotes) * 100;
        // Mezcla con el apoyo previo (40/60) para que la barra evolucione con suavidad
        // en vez de saltar de golpe, manteniendo el resultado fiel a los votos reales.
        const prevVal = prev[c.id]?.current ?? 30;
        const blended = Math.round(prevVal * 0.4 + votePct * 0.6);
        next[c.id] = {
          ...next[c.id],
          current: Math.min(95, Math.max(8, blended))
        };
      });
      return next;
    });

    const firstVoteIdx = turns.length;
    setActiveTurnIdx(firstVoteIdx);
    setIsGenerating(false);
  };

  // Sintetizar el veredicto final con Moderador
  const handleSynthesizeVerdict = async () => {
    if (isSynthesizingVerdict) return;
    setIsSynthesizingVerdict(true);

    try {
      const response = await fetch("/api/debate/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: question,
          history: turns
        })
      });

      if (!response.ok) {
        throw new Error("Verdict request failed");
      }

      const report: Verdict = await response.json();

      // Final rating tilt towards winner (matching tolerante a variaciones)
      const ganadorNorm = (report.ganador || "").toLowerCase().trim();
      const winnerId =
        Object.keys(CHARACTERS_MAP).find(
          (key) => CHARACTERS_MAP[key].name.toLowerCase() === ganadorNorm
        ) ||
        Object.keys(CHARACTERS_MAP).find((key) =>
          ganadorNorm.includes(CHARACTERS_MAP[key].name.toLowerCase())
        ) ||
        "estratega";

      setSupportRatings((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k === winnerId) {
            next[k] = { ...next[k], current: Math.min(98, next[k].current + 18) };
          } else {
            next[k] = { ...next[k], current: Math.max(5, next[k].current - 6) };
          }
        });
        return next;
      });

      setFinalVerdict(report);

      // Save complete debate to history securely
      if (selectedDebate) {
        const finishedDebate: SavedDebate = {
          ...selectedDebate,
          history: turns,
          supportRatings: { ...supportRatings },
          verdict: report
        };
        saveDebateToHistory(finishedDebate);
        setSelectedDebate(finishedDebate);
      }

      setScreen("verdict");
    } catch (e) {
      console.error("Failed synthesizing final report:", e);
      // Fallback verdict mock to prevent visual blocking if network gets interrupted
      const mockReport: Verdict = {
        ganador: "La Estratega",
        tesisGanadora: "Establecer la solución basándose en el análisis y el largo plazo.",
        recomendacionAccionable: "Recomendación tentativa: avanza con cautela y reevalúa en un horizonte corto. (Veredicto sintético: la conexión con el moderador falló.)",
        queHacer: ["Reintentar el debate cuando la conexión se restablezca."],
        queEvitar: ["No tomar decisiones irreversibles basándote en este veredicto degradado."],
        razonesDecisivas: [
          "Presenta la asunción de riesgos macro más sólida.",
          "Las objeciones de viabilidad fueron respondidas con plazos específicos."
        ],
        cambiosDeOpinion: [
          {
            personaje: "El Cliente Final",
            de: "Incertidumbre sobre el coste inicial.",
            a: "Comprensión del valor amortizado.",
            razon: "La Estratega demostró sustentabilidad futura."
          }
        ],
        desacuerdosPersistentes: "La viabilidad operativa inmediata sigue siendo un debate abierto."
      };
      setFinalVerdict(mockReport);
      setScreen("verdict");
    } finally {
      setIsSynthesizingVerdict(false);
    }
  };

  // Load a historical saved debate to review it.
  // Los debates guardados siempre tienen veredicto (solo se guardan al finalizar),
  // así que abrimos directamente la pantalla de veredicto. Si por algún motivo no
  // tuviera veredicto, caemos en la vista de debate desde la fase 1.
  const handleLoadSavedDebate = (debate: SavedDebate) => {
    stopSpeech();
    setQuestion(debate.topic);
    setTurns(debate.history);
    setSupportRatings(debate.supportRatings);
    setFinalVerdict(debate.verdict);
    setConcededCharacter(null);
    setActiveTurnIdx(0);
    setSelectedDebate(debate);
    if (debate.verdict) {
      setScreen("verdict");
    } else {
      setCurrentPhase(1);
      setScreen("debate");
    }
  };

  // Reset entire debate states to run again
  const handleReset = () => {
    stopSpeech();
    setQuestion("");
    setTurns([]);
    setActiveTurnIdx(0);
    setCurrentPhase(1);
    setFinalVerdict(null);
    setSelectedDebate(null);
    setScreen("start");
  };

  // Filter turns to only show those of the current active phase in UI
  const phaseTurns = turns.filter((t) => t.phase === currentPhase);
  const activeTurnInCurrentPhase = phaseTurns.find(
    (pt) => turns.indexOf(pt) === activeTurnIdx
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-sans flex flex-col">
      {/* Top Header Banner */}
      <header className="bg-[#0c0c0c]/80 backdrop-blur-md border-b border-neutral-800/60 px-6 py-4 flex items-center justify-between shadow-lg z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-neutral-800 border border-neutral-700/50 flex items-center justify-center rounded-md text-white">
            <BrainCircuit className="w-5 h-5 text-stone-100" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              DEBATE DE IAs
            </h1>
            <p className="text-[10px] font-mono text-neutral-500">
              NOVELA VISUAL ANALÍTICA · GEMINI
            </p>
          </div>
          {isMockMode && (
            <span
              className="ml-2 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-amber-950/40 border border-amber-700/60 text-amber-300"
              title="Estás en modo demo. Las respuestas son simuladas, no analizan tu pregunta."
            >
              MODO DEMO
            </span>
          )}
        </div>

        {/* Global toggles */}
        <div className="flex items-center gap-3">

          {/* Web Speech API speak switch */}
          <button
            onClick={() => {
              if (speechEnabled) {
                stopSpeech();
                setSpeechEnabled(false);
              } else {
                setSpeechEnabled(true);
              }
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-[10px] font-mono font-bold tracking-wider transition-all uppercase cursor-pointer ${
              speechEnabled
                ? "bg-white border-white text-black hover:bg-neutral-200"
                : "bg-[#141414] border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            }`}
            title="Activa voces reales para cada personaje mientras hablan"
          >
            {speechEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-neutral-800" />
                Voz: Activada
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
                Voz: Silenciada
              </>
            )}
          </button>

          {/* If debate is running, reset shortcut */}
          {screen !== "start" && (
            <button
              onClick={handleReset}
              className="p-1.5 px-3 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 rounded-md text-xs font-mono text-neutral-400 cursor-pointer transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </header>

      {/* Screen 1: Start landing */}
      {screen === "start" && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 justify-center">
          {/* Main Question Card Column */}
          <div className="md:col-span-2 space-y-6 flex flex-col justify-center">
            {/* Elegant prompt title */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono bg-neutral-800 text-stone-300 px-2 py-0.5 rounded uppercase font-bold tracking-widest border border-neutral-700/55">
                Novela Visual Conversacional
              </span>
              <h2 className="text-3xl font-serif text-white leading-tight">
                Plantea un dilema ejecutivo, técnico o existencial.
              </h2>
              <p className="text-xs text-neutral-500 max-w-lg leading-relaxed">
                Cinco personalidades con roles de asimetría intelectual (Estratega, Escéptico, Ingeniera, Inversor, Cliente Final) debatirán rigurosamente hasta que el Moderador final emita un veredicto definitivo. Con debates estructurados y honestidad de acero.
              </p>
            </div>

            {/* Aviso visible cuando se está en modo demo (respuestas simuladas) */}
            {isMockMode && (
              <div className="bg-amber-950/30 border border-amber-800/60 rounded-md p-4 text-amber-100 text-xs leading-relaxed">
                <div className="flex items-center gap-2 mb-1 font-mono font-bold uppercase tracking-wider text-amber-300 text-[11px]">
                  <Info className="w-4 h-4" />
                  Modo demo activo
                </div>
                <p>
                  Las respuestas que veas son <strong>simuladas</strong> y siempre las mismas: el modo demo
                  sirve para enseñarte la interfaz sin gastar cuota. Para que los personajes analicen DE VERDAD
                  tu pregunta, arranca la app sin <code className="px-1 bg-amber-950/60 rounded">MOCK_AI=true</code> y
                  con tu <code className="px-1 bg-amber-950/60 rounded">GEMINI_API_KEY</code> configurada.
                </p>
              </div>
            )}

            {/* Input area */}
            <div className="bg-[#121212] border border-neutral-800 rounded-lg p-5 shadow-lg space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-neutral-400 uppercase block">
                  Tu Pregunta o Dilema
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    // Ctrl/Cmd + Enter envía (no rompe la escritura multilínea con Enter normal).
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && hasApiKey && question.trim()) {
                      e.preventDefault();
                      handleStartDebate();
                    }
                  }}
                  autoFocus
                  aria-label="Tu pregunta o dilema para el debate"
                  placeholder="Ej: Lanzar un chatbot autónomo de atención psicológica 24/7 sin supervisión humana. ¿Es ética y comercialmente viable?"
                  className="w-full h-32 p-3 bg-[#181818] focus:bg-[#1e1e1e] border border-neutral-800 focus:border-neutral-600 rounded-md text-xs text-stone-200 leading-relaxed outline-none transition-all resize-none placeholder-neutral-600"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-neutral-500">
                  Ctrl + Enter para iniciar · Powered by Gemini
                </span>

                {isVerifyingKey ? (
                  <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Verificando API...
                  </div>
                ) : !hasApiKey ? (
                  <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded">
                    <Info className="w-4 h-4 text-red-500" />
                    Configura GEMINI_API_KEY en Secretos para iniciar.
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartDebate()}
                    disabled={!question.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-neutral-700 text-black hover:bg-neutral-200 disabled:bg-[#1a1a1a] disabled:border-neutral-800 disabled:text-neutral-600 rounded-md font-mono text-xs font-bold tracking-wider uppercase shadow active:scale-95 transition-all cursor-pointer"
                  >
                    Iniciar Debate
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Suggested topics list */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">
                Dilemas Recomendados
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SUGGESTED_TOPICS.map((topic, id) => (
                  <div
                    key={id}
                    onClick={() => {
                      if (hasApiKey) handleStartDebate(topic.question);
                    }}
                    className={`p-4 bg-[#121212]/95 border border-neutral-800/80 hover:border-neutral-600 rounded-lg shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 ${
                      !hasApiKey && "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <h5 className="text-[11px] font-mono font-bold text-stone-300 tracking-tight uppercase line-clamp-1 mb-1">
                      {topic.title}
                    </h5>
                    <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-3">
                      {topic.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Historical Debates Sidebar */}
          <div className="bg-[#121212] border border-neutral-800 rounded-lg p-5 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center gap-2 mb-4 pb-1.5 border-b border-neutral-800/80">
                <HistoryIcon className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-300">
                  Debates Recientes
                </h3>
              </div>
              <HistoryList
                debates={savedDebates}
                onSelectDebate={handleLoadSavedDebate}
                onDeleteDebate={handleDeleteDebate}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-800 text-[10px] font-mono text-neutral-500 leading-relaxed">
              * Los debates y veredictos se guardan localmente en tu navegador de forma persistente.
            </div>
          </div>
        </main>
      )}

      {/* Screen 2: Active visual novel debate board */}
      {screen === "debate" && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
          {/* Phase progress banner & CURRENT PHASE CONTROLLER */}
          <div className="bg-[#121212] border border-neutral-800 text-stone-100 px-6 py-3 rounded-lg shadow-md flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                FASE {currentPhase}/4
              </span>
              <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-stone-200">
                {currentPhase === 1 && "Fase 1 · Lectura de Tesis Paralelas"}
                {currentPhase === 2 && "Fase 2 · Ataques Cruzados de Asimetría"}
                {currentPhase === 3 && "Fase 3 · Defensas y Concesiones"}
                {currentPhase === 4 && "Fase 4 · Veredicto Final de Votos"}
              </h2>
            </div>

            {/* Current debate question snippet */}
            <div className="text-[11px] bg-[#1a1a1a] border border-neutral-800/80 py-1 px-3 rounded text-neutral-300 max-w-sm shrink-0 truncate">
              Tema: <span className="font-serif italic">"{question}"</span>
            </div>
          </div>

          {/* Visual stage panel */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Left side 5 portraits visual novel scene & Current Speech Bubble */}
            <div className="lg:col-span-3 space-y-6">
              {/* Character stage */}
              <div className="relative bg-[#111] border border-neutral-800 rounded-lg p-6 sm:p-10 flex flex-wrap gap-4 items-center justify-around select-none min-h-[300px] shadow-lg overflow-hidden">
                {/* Visual Conceded Opinion Flash Effect */}
                <AnimatePresence>
                  {showConcededFlash && concededCharacter && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.95 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-[#0c0c0c]/95 z-10 flex flex-col items-center justify-center border border-amber-900/40 text-[#e0e0e0]"
                    >
                      <Sparkles className="w-12 h-12 text-amber-500 animate-spin mb-2" />
                      <h3 className="font-mono uppercase tracking-widest text-sm font-extrabold text-[#d97706]/90">
                        CONCESIÓN HONESTA
                      </h3>
                      <p className="font-serif italic text-xs max-w-sm text-center mt-1 text-neutral-400">
                        "{CHARACTERS_MAP[concededCharacter]?.name} ha sido convencido por los argumentos cruzados."
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Draw all 5 characters */}
                {CHARACTERS_LIST.map((c) => {
                  const id = c.id;

                  // Find expression logic based on active states
                  const activept = activeTurnInCurrentPhase;
                  const isCurrentSpeaker = activept?.characterId === id;

                  let expr: "neutro" | "hablando" | "caracteristico" | "sorprendido" | "convencido" = "neutro";
                  if (isCurrentSpeaker) {
                    expr = "hablando";
                  } else if (id === concededCharacter && currentPhase >= 3) {
                    expr = "convencido";
                  } else if (currentPhase === 2 && activept?.targetCharacterId === id) {
                    expr = "sorprendido";
                  } else if (currentPhase === 4 && activept?.characterId !== id) {
                    expr = "caracteristico";
                  }

                  // Find reaction icon overlay
                  const targetReaction = activeReactions[id] || "";

                  return (
                    <div key={id} className="transition-all duration-500">
                      <CharacterPortrait
                        characterId={id}
                        expression={expr}
                        isTalking={isCurrentSpeaker}
                        reaction={targetReaction}
                        availableFiles={availableAssets[id]}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Speech bubble component container */}
              <div className="flex gap-4 items-start">
                {activeTurnInCurrentPhase ? (
                  <MangaSpeechBubble
                    characterId={activeTurnInCurrentPhase.characterId}
                    text={activeTurnInCurrentPhase.text}
                    isStreaming={isGenerating && activeTurnIdx === turns.indexOf(activeTurnInCurrentPhase)}
                  />
                ) : (
                  <div className="p-6 border border-neutral-800 rounded-lg w-full bg-[#121212] text-center font-mono text-xs text-neutral-500">
                    Cargando diálogo...
                  </div>
                )}
              </div>
            </div>

            {/* Right side dynamic panels: "Ideas en juego" and progress list */}
            <div className="space-y-6">
              {/* Dynamic Rates panel */}
              <SupportIndicators ratings={supportRatings} />

              {/* Sequence progression card */}
              <div className="bg-[#121212] border border-neutral-800 rounded-lg p-5 shadow-lg">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-300 mb-3 pb-1 border-b border-neutral-800/80">
                  Diálogos de esta Fase
                </h4>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {phaseTurns.map((pt, idx) => {
                    const charObj = CHARACTERS_MAP[pt.characterId];
                    const idxGlobal = turns.indexOf(pt);
                    const isFocus = idxGlobal === activeTurnIdx;

                    return (
                      <div
                        key={pt.id}
                        onClick={() => {
                          if (!isGenerating) {
                            setActiveTurnIdx(idxGlobal);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-all border duration-150 ${
                          isFocus
                            ? "bg-[#1e1e1e] border-neutral-600 font-bold text-stone-100 shadow-md"
                            : "bg-[#161616]/60 hover:bg-[#181818] border-transparent text-stone-400 hover:text-stone-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: charObj?.color }}
                          />
                          <span className="truncate">{charObj?.name}</span>
                        </div>
                        {isGenerating && idxGlobal === turns.length - 1 && (
                          <Loader2 className="w-3 h-3 animate-spin text-stone-500" />
                        )}
                        {!pt.text && (
                          <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 animate-pulse">
                            Pensando
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Dialog Flow controller bar */}
          <div className="bg-[#121212] border border-neutral-800 p-4 rounded-lg flex flex-wrap gap-4 items-center justify-between shadow-lg">
            {/* Timeline controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (activeTurnIdx > turns.indexOf(phaseTurns[0])) {
                    setActiveTurnIdx((prev) => prev - 1);
                  }
                }}
                disabled={activeTurnIdx <= turns.indexOf(phaseTurns[0])}
                className="p-2 border border-neutral-800 bg-[#161616] disabled:opacity-30 hover:bg-neutral-800 hover:border-neutral-700 rounded cursor-pointer transition-colors"
                title="Conversación anterior"
                aria-label="Conversación anterior"
              >
                <ChevronLeft className="w-4 h-4 text-neutral-300" />
              </button>

              <span className="text-xs font-mono text-neutral-400">
                Línea {phaseTurns.indexOf(activeTurnInCurrentPhase as any) + 1} de {phaseTurns.length}
              </span>

              <button
                onClick={() => {
                  if (activeTurnIdx < turns.indexOf(phaseTurns[phaseTurns.length - 1])) {
                    setActiveTurnIdx((prev) => prev + 1);
                  }
                }}
                disabled={activeTurnIdx >= turns.indexOf(phaseTurns[phaseTurns.length - 1])}
                className="p-2 border border-neutral-800 bg-[#161616] disabled:opacity-30 hover:bg-neutral-800 hover:border-neutral-700 rounded cursor-pointer transition-colors"
                title="Siguiente conversación"
                aria-label="Siguiente conversación"
              >
                <ChevronRight className="w-4 h-4 text-neutral-300" />
              </button>

              {/* Autoplay toggle switch */}
              <button
                onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
                className={`ml-2 px-3 py-1.5 rounded border text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  autoPlayEnabled
                    ? "bg-green-950/25 border-green-900/30 text-green-400"
                    : "bg-[#181818] border-neutral-800 text-neutral-500 hover:border-neutral-700"
                }`}
              >
                {autoPlayEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                Autoplay: {autoPlayEnabled ? "Encendido" : "Apagado"}
              </button>
            </div>

            {/* Phase switching panel */}
            <div className="flex items-center gap-3">
              {/* If streaming, indicate */}
              {isGenerating ? (
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-950/20 px-3 py-1.5 rounded border border-amber-900/30 italic">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  Transmitiendo en paralelo...
                </div>
              ) : (
                <>
                  {currentPhase === 1 && (
                    <button
                      onClick={handleStartAttacks}
                      className="inline-flex items-center gap-1 px-5 py-2.5 bg-white border border-neutral-800 hover:bg-neutral-200 text-black rounded font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Ataques Cruzados
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {currentPhase === 2 && (
                    <button
                      onClick={handleStartDefenses}
                      className="inline-flex items-center gap-1 px-5 py-2.5 bg-white border border-neutral-800 hover:bg-neutral-200 text-black rounded font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Defensas y Rectificación
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {currentPhase === 3 && (
                    <button
                      onClick={handleStartVotes}
                      className="inline-flex items-center gap-1 px-5 py-2.5 bg-white border border-neutral-800 hover:bg-neutral-200 text-black rounded font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Votación de Tesis
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {currentPhase === 4 && (
                    <button
                      onClick={handleSynthesizeVerdict}
                      disabled={isSynthesizingVerdict}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-neutral-800 outline-none hover:bg-neutral-200 disabled:bg-neutral-800 text-black disabled:text-neutral-500 rounded font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      {isSynthesizingVerdict ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                          Sintetizando...
                        </>
                      ) : (
                        <>
                          <Trophy className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          Calcular Veredicto
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Screen 3: Verdict Viewer Report Card */}
      {screen === "verdict" && finalVerdict && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
          <VerdictView
            verdict={finalVerdict}
            topic={question}
            onReset={handleReset}
          />
        </main>
      )}
    </div>
  );
}
