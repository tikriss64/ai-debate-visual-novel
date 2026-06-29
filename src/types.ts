/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DebateTurn {
  id: string;
  characterId: string;
  phase: number; // 1: Tesis, 2: Ataque, 3: Defensa, 4: Voto
  text: string;
  reaction?: string; // "?", "!?", "sweat"
  expression: "neutro" | "hablando" | "caracteristico" | "sorprendido" | "convencido";
  targetCharacterId?: string; // For Phase 2 (Ataque)
}

export interface ChangeOfOpinion {
  personaje: string;
  de: string;
  a: string;
  razon: string;
}

export interface Verdict {
  ganador: string;
  tesisGanadora: string;
  // RECOMENDACIÓN ACCIONABLE: la respuesta directa al usuario tras el debate.
  // "Sí/No/Depende" + cómo proceder, qué hacer concretamente y qué evitar.
  // Son opcionales para no romper debates antiguos guardados sin estos campos.
  recomendacionAccionable?: string;
  queHacer?: string[];
  queEvitar?: string[];
  razonesDecisivas: string[];
  cambiosDeOpinion: ChangeOfOpinion[];
  desacuerdosPersistentes: string;
}

export interface SavedDebate {
  id: string;
  topic: string;
  date: string;
  history: DebateTurn[];
  supportRatings: Record<string, { initial: number; current: number }>; // For "Ideas en juego"
  verdict: Verdict | null;
}

export interface CharacterConfig {
  id: string;
  name: string;
  role: string;
  color: string;
  borderColor: string;
  textCol: string;
  bgColor: string; // Background tint for light mode bubbles
  description: string;
  voiceLang: string; // Ideal Web Speech Lang
  voiceGender: "F" | "M"; // Para asignar una voz coherente con el personaje
  voicePitch: number;
  voiceRate: number;
}
