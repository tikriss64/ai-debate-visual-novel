/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHARACTERS_MAP } from "../constants";

// Global cache for speech loading
let voices: SpeechSynthesisVoice[] = [];

// Load voices from system securely
const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }

    const check = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        voices = v;
        resolve(v);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
};

// Start initial voice load
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
    };
  }
}

// Keep active utterances in memory to prevent Chrome garbage collection of speech callbacks
let activeUtterances: SpeechSynthesisUtterance[] = [];

// Pistas para adivinar el género de una voz por su nombre (Windows, macOS, Chrome…).
// La Web Speech API no expone el género, así que lo inferimos por nombres conocidos.
const FEMALE_HINTS = [
  "female", "mujer", "femenin",
  "helena", "laura", "sabina", "elvira", "ximena", "dalia", "renata",
  "monica", "mónica", "paulina", "marisol", "esperanza", "lucia", "lucía", "isabela"
];
const MALE_HINTS = [
  "male", "hombre", "masculin",
  "pablo", "raul", "raúl", "alvaro", "álvaro", "dario", "darío", "gonzalo", "lorenzo",
  "jorge", "diego", "juan", "carlos", "miguel", "enrique", "felipe"
];

const guessVoiceGender = (v: SpeechSynthesisVoice): "F" | "M" | null => {
  const n = `${v.name} ${v.voiceURI || ""}`.toLowerCase();
  if (MALE_HINTS.some((h) => n.includes(h))) return "M";
  if (FEMALE_HINTS.some((h) => n.includes(h))) return "F";
  return null;
};

// --- Conversión número → palabras en español (para que la voz no lea "2.000" como "dos punto cero cero cero") ---
const UNIDADES = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve",
  "diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve",
  "veinte","veintiuno","veintidós","veintitrés","veinticuatro","veinticinco","veintiséis","veintisiete","veintiocho","veintinueve"];
const DECENAS = ["", "", "", "treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
const CENTENAS = ["", "ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];

function numeroAPalabras(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return "menos " + numeroAPalabras(-n);
  if (n < 30) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
  }
  if (n === 100) return "cien";
  if (n < 1000) {
    const c = Math.floor(n / 100), r = n % 100;
    return r === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${numeroAPalabras(r)}`;
  }
  if (n < 1000000) {
    const miles = Math.floor(n / 1000), r = n % 1000;
    const milesTxt = miles === 1 ? "mil" : `${numeroAPalabras(miles)} mil`;
    return r === 0 ? milesTxt : `${milesTxt} ${numeroAPalabras(r)}`;
  }
  if (n < 1000000000) {
    const mill = Math.floor(n / 1000000), r = n % 1000000;
    const millTxt = mill === 1 ? "un millón" : `${numeroAPalabras(mill)} millones`;
    return r === 0 ? millTxt : `${millTxt} ${numeroAPalabras(r)}`;
  }
  return String(n); // muy grande: dejarlo como está
}

// Normaliza el texto antes de enviarlo a la síntesis de voz para que se lea natural en español.
function normalizeForSpeech(text: string): string {
  return text
    // Porcentajes: "35%" -> "treinta y cinco por ciento"
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, n) => {
      const num = parseFloat(n.replace(",", "."));
      return Number.isInteger(num) ? `${numeroAPalabras(num)} por ciento` : `${n.replace(".", ",")} por ciento`;
    })
    // Moneda: "$5.000" / "5.000€" / "USD 5000"
    .replace(/(?:\$|USD\s?|EUR\s?|€\s?)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/gi, (_, n) => {
      const clean = parseInt(n.replace(/[.,]/g, ""), 10);
      return Number.isFinite(clean) ? `${numeroAPalabras(clean)} dólares` : n;
    })
    .replace(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*€/g, (_, n) => {
      const clean = parseInt(n.replace(/[.,]/g, ""), 10);
      return Number.isFinite(clean) ? `${numeroAPalabras(clean)} euros` : n;
    })
    // Números con separador de miles tipo "2.000", "15.000", "1.500.000" -> palabras
    .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, (m) => {
      const clean = parseInt(m.replace(/\./g, ""), 10);
      return Number.isFinite(clean) ? numeroAPalabras(clean) : m;
    })
    // Números enteros entre 1000 y 999999 sin separadores -> palabras
    .replace(/\b\d{4,6}\b/g, (m) => {
      const n = parseInt(m, 10);
      return Number.isFinite(n) ? numeroAPalabras(n) : m;
    })
    // Decimales con coma: "3,5" -> "tres coma cinco"
    .replace(/\b(\d+),(\d+)\b/g, (_, a, b) => `${a} coma ${b}`);
}

export const speakText = async (
  text: string,
  characterId: string,
  onEnd?: () => void
): Promise<void> => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    if (onEnd) onEnd();
    return;
  }

  // Cancel existing playing speak synthesis to prevent queue collision
  window.speechSynthesis.cancel();
  activeUtterances = [];

  const character = CHARACTERS_MAP[characterId];
  if (!character) {
    if (onEnd) onEnd();
    return;
  }

  if (voices.length === 0) {
    await loadVoices();
  }

  // Clean the text from custom markers or symbols like !? or emoji.
  // Después normalizamos números a palabras para que el TTS los lea en español natural
  // (sin esto, "2.000" se pronuncia "dos punto cero cero cero" en muchas voces).
  const clearedText = normalizeForSpeech(
    text
      .replace(/[!?]/g, "")
      .replace(/\[ERROR.*?\]/g, "")
      .trim()
  );

  if (!clearedText) {
    if (onEnd) onEnd();
    return;
  }

  // --- Asignación de voz coherente con el GÉNERO del personaje ---
  // Prioridad: (1) voz en español del mismo género; (2) cualquier voz en español
  // (el tono/pitch del personaje empuja hacia su género); (3) cualquier voz del sistema.
  // Cuando hay varias voces válidas, repartimos por el índice del personaje DENTRO de su
  // mismo género, para que dos personajes del mismo sexo no compartan exactamente la misma voz.
  const targetGender = character.voiceGender;
  let chosenVoice: SpeechSynthesisVoice | null = null;

  const esVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const genderVoices = esVoices.filter((v) => guessVoiceGender(v) === targetGender);

  // Pool preferente: voces ES del género correcto; si no hay, todas las ES; si no, todas.
  const pool = genderVoices.length > 0 ? genderVoices : esVoices.length > 0 ? esVoices : voices;

  // Índice del personaje entre los de su mismo género (para repartir voces distintas).
  const sameGenderChars = Object.values(CHARACTERS_MAP).filter((c) => c.voiceGender === targetGender);
  const genderIndex = Math.max(0, sameGenderChars.findIndex((c) => c.id === characterId));

  if (pool.length > 0) {
    chosenVoice = pool[genderIndex % pool.length];
  }

  // Chrome corta las locuciones largas (~15 s / >200 caracteres). Para evitarlo dividimos
  // el texto en frases y las encolamos como utterances separadas: cada una es corta y no
  // se corta a mitad. El callback final se dispara al terminar la última frase.
  const chunks =
    clearedText.match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) || [clearedText];

  // Si no conseguimos una voz del género correcto, exageramos el tono para acentuar
  // la diferencia de género (más grave en hombres, más agudo en mujeres). Cuando la voz
  // SÍ es del género adecuado, usamos el pitch natural del personaje.
  const chosenGender = chosenVoice ? guessVoiceGender(chosenVoice) : null;
  let effectivePitch = character.voicePitch;
  if (chosenGender !== targetGender) {
    effectivePitch = targetGender === "M"
      ? Math.min(effectivePitch, 0.7)
      : Math.max(effectivePitch, 1.35);
  }

  let callbackTriggered = false;
  const triggerEndCallback = () => {
    if (callbackTriggered) return;
    callbackTriggered = true;
    activeUtterances = [];
    if (onEnd) onEnd();
  };

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    if (chosenVoice) {
      u.voice = chosenVoice;
      u.lang = chosenVoice.lang;
    } else {
      u.lang = character.voiceLang;
    }
    u.pitch = effectivePitch;
    u.rate = character.voiceRate;
    u.volume = 0.95;

    // Solo la última frase dispara el callback de "terminó de hablar".
    if (i === chunks.length - 1) {
      u.onend = triggerEndCallback;
    }
    u.onerror = (event) => {
      console.warn("Speech synthesis error event:", event);
      triggerEndCallback();
    };

    activeUtterances.push(u); // evita que el recolector de basura elimine el callback
    window.speechSynthesis.speak(u);
  });
};

export const stopSpeech = (): void => {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};
