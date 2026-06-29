/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Award, ChevronRight, CornerDownRight, History, HelpCircle, RefreshCw, Trophy, Copy, Check, CheckCircle2, XCircle, Compass } from "lucide-react";
import { Verdict } from "../types";
import { CHARACTERS_MAP } from "../constants";

interface VerdictViewProps {
  verdict: Verdict;
  topic: string;
  onReset: () => void;
}

export default function VerdictView({
  verdict,
  topic,
  onReset
}: VerdictViewProps) {
  // Find information of the winner (case-insensitive + trim + contains, para resistir
  // pequeñas variaciones en cómo Gemini formatea el nombre del ganador).
  const normalizedGanador = (verdict.ganador || "").toLowerCase().trim();
  const winnerId =
    Object.keys(CHARACTERS_MAP).find(
      (key) => CHARACTERS_MAP[key].name.toLowerCase() === normalizedGanador
    ) ||
    Object.keys(CHARACTERS_MAP).find((key) =>
      normalizedGanador.includes(CHARACTERS_MAP[key].name.toLowerCase())
    ) ||
    "estratega";
  const winnerConfig = CHARACTERS_MAP[winnerId] || CHARACTERS_MAP.estratega;

  // Copiar un resumen legible del veredicto al portapapeles (para compartirlo).
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const lines = [
      `DEBATE: ${topic}`,
      ``,
      ...(verdict.recomendacionAccionable
        ? [`RECOMENDACIÓN:`, verdict.recomendacionAccionable, ``]
        : []),
      ...(verdict.queHacer?.length
        ? [`QUÉ HACER:`, ...verdict.queHacer.map((q) => `· ${q}`), ``]
        : []),
      ...(verdict.queEvitar?.length
        ? [`QUÉ EVITAR:`, ...verdict.queEvitar.map((q) => `· ${q}`), ``]
        : []),
      `GANADOR/A DEL DEBATE: ${verdict.ganador}`,
      `TESIS: ${verdict.tesisGanadora}`,
      ``,
      `RAZONES DECISIVAS:`,
      ...verdict.razonesDecisivas.map((r) => `· ${r}`),
      ``,
      ...(verdict.cambiosDeOpinion?.length
        ? [
            `CAMBIOS DE OPINIÓN:`,
            ...verdict.cambiosDeOpinion.map(
              (c) => `· ${c.personaje}: "${c.de}" → "${c.a}" (${c.razon})`
            ),
            ``
          ]
        : []),
      `DESACUERDO PERSISTENTE: ${verdict.desacuerdosPersistentes}`
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Si el navegador bloquea el portapapeles, no hacemos nada disruptivo.
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* Title Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#121212] border border-neutral-800 text-[10px] font-mono uppercase tracking-widest text-[#e0e0e0]">
          <Award className="w-3.5 h-3.5 text-neutral-300" />
          VEREDICTO DE MODERACIÓN
        </div>
        <h2 className="text-2xl font-serif tracking-tight text-white max-w-xl mx-auto leading-snug">
          {topic}
        </h2>
        <div className="w-12 h-0.5 bg-neutral-700 mx-auto mt-4" />
      </div>

      {/* ⭐ RECOMENDACIÓN ACCIONABLE — la respuesta directa al usuario tras el debate. */}
      {verdict.recomendacionAccionable && (
        <div className="bg-[#0e1410] border border-emerald-900/50 rounded-lg p-6 sm:p-8 space-y-5 shadow-lg">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-300">
              Recomendación tras el debate
            </h3>
          </div>
          <p className="text-base sm:text-lg font-serif text-stone-100 leading-relaxed">
            {verdict.recomendacionAccionable}
          </p>

          {(verdict.queHacer?.length || verdict.queEvitar?.length) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {verdict.queHacer?.length ? (
                <div className="bg-[#0a0a0a]/60 border border-emerald-900/40 rounded-md p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Qué hacer
                  </div>
                  <ul className="space-y-2">
                    {verdict.queHacer.map((q, idx) => (
                      <li key={idx} className="flex gap-2 text-xs text-stone-200 leading-relaxed">
                        <span className="text-emerald-500 font-bold shrink-0">{idx + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {verdict.queEvitar?.length ? (
                <div className="bg-[#0a0a0a]/60 border border-red-900/40 rounded-md p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-red-400">
                    <XCircle className="w-4 h-4" />
                    Qué evitar
                  </div>
                  <ul className="space-y-2">
                    {verdict.queEvitar.map((q, idx) => (
                      <li key={idx} className="flex gap-2 text-xs text-stone-200 leading-relaxed">
                        <span className="text-red-500 font-bold shrink-0">·</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Tesis Ganadora Block (The Star Product) */}
      <div
        className="relative overflow-hidden bg-[#121212] border-2 rounded-lg p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start"
        style={{
          borderColor: winnerConfig.color,
          boxShadow: `0 12px 24px -8px ${winnerConfig.color}25`,
        }}
      >
        {/* Decorative Trophy Corner */}
        <div
          className="absolute -top-6 -right-6 w-16 h-16 rotate-12 flex items-center justify-center opacity-10"
          style={{ backgroundColor: winnerConfig.color }}
        >
          <Trophy className="w-8 h-8 text-[#0a0a0a]" />
        </div>

        {/* Big stylized winner badge & fallback portrait sketch */}
        <div className="flex flex-col items-center shrink-0 w-full md:w-32">
          <div
            className="w-24 h-24 rounded-full border-2 flex items-center justify-center bg-[#181818] shadow-inner mb-2"
            style={{ borderColor: winnerConfig.color }}
          >
            <Trophy className="w-10 h-10" style={{ color: winnerConfig.color }} />
          </div>
          <span
            className="text-xs font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded text-center"
            style={{ backgroundColor: `${winnerConfig.color}25`, color: winnerConfig.color }}
          >
            {winnerConfig.name}
          </span>
          <span className="text-[9px] font-mono text-neutral-500 mt-1 uppercase text-center">
            GANADOR/A DEL DEBATE
          </span>
        </div>

        {/* Content detail */}
        <div className="space-y-3 flex-1">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
            Tesis Triunfante
          </h3>
          <p className="text-lg font-serif italic text-stone-100 leading-relaxed pr-2">
            "{verdict.tesisGanadora}"
          </p>
        </div>
      </div>

      {/* Decisive Reasons + Persisting Disagreements Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reasons */}
        <div className="p-6 bg-[#121212] border border-neutral-800/80 rounded-lg space-y-4">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200 flex items-center gap-1.5 pb-2 border-b border-neutral-800">
            <span className="w-2 h-2 bg-[#e0e0e0] rounded-full" />
            Razones Decisivas
          </h4>
          <ul className="space-y-3">
            {verdict.razonesDecisivas.map((reason, idx) => (
              <li key={idx} className="flex gap-2.5 items-start text-xs text-stone-300 leading-relaxed">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-neutral-600 mt-0.5" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Disagreements */}
        <div className="p-6 bg-[#121212]/95 border border-neutral-800/85 rounded-lg space-y-4">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200 flex items-center gap-1.5 pb-2 border-b border-neutral-800">
            <HelpCircle className="w-4 h-4 text-stone-400" />
            Desacuerdos Persistentes
          </h4>
          <p className="text-xs text-stone-300 leading-relaxed font-serif italic">
            "{verdict.desacuerdosPersistentes}"
          </p>
        </div>
      </div>

      {/* Changes of Opinion (If any) */}
      {verdict.cambiosDeOpinion && verdict.cambiosDeOpinion.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-stone-400" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
              Concesiones y Cambios de Opinión
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {verdict.cambiosDeOpinion.map((change, idx) => {
              const charId = Object.keys(CHARACTERS_MAP).find(
                (key) => CHARACTERS_MAP[key].name.toLowerCase() === change.personaje.toLowerCase()
              ) || "cliente";
              const charConfig = CHARACTERS_MAP[charId] || CHARACTERS_MAP.cliente;

              return (
                <div
                  key={idx}
                  className="p-5 bg-[#121212] border rounded-lg space-y-3 shadow-inner"
                  style={{ borderColor: `${charConfig.color}35` }}
                >
                  <div className="flex items-center gap-1.5 pb-1 border-b border-neutral-800">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: charConfig.color }}
                    />
                    <span className="text-xs font-mono font-bold" style={{ color: charConfig.color }}>
                      {change.personaje}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">concedió</span>
                  </div>

                  {/* Flow block */}
                  <div className="grid grid-cols-1 gap-2 text-[11px] font-sans">
                    <div className="p-2 bg-[#181818] rounded border border-neutral-800/60 text-neutral-400">
                      <span className="font-mono text-[9px] uppercase block tracking-wider text-neutral-500">
                        Antes (Asunción):
                      </span>
                      {change.de}
                    </div>
                    <div className="p-2 bg-green-950/20 rounded border border-green-900/30 text-green-300">
                      <span className="font-mono text-[9px] uppercase block tracking-wider text-green-500 font-bold">
                        Después (Consenso):
                      </span>
                      {change.a}
                    </div>
                  </div>

                  {/* Cause */}
                  <div className="text-[11px] text-stone-300 leading-relaxed font-serif pl-1 flex gap-1.5">
                    <CornerDownRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>
                      <strong className="font-sans font-medium text-[#e0e0e0]">Causa:</strong> {change.razon}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="pt-6 flex items-center justify-center gap-3">
        <button
          onClick={handleCopy}
          aria-label="Copiar resumen del veredicto al portapapeles"
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#161616] border border-neutral-800 text-stone-300 hover:text-white hover:border-neutral-600 rounded-md font-mono text-xs font-bold tracking-wider uppercase transition-all active:scale-95 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copiar resumen
            </>
          )}
        </button>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-neutral-700 text-black hover:bg-neutral-200 rounded-md font-mono text-xs font-bold tracking-wider uppercase shadow hover:shadow-md active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Iniciar Nuevo Debate
        </button>
      </div>
    </motion.div>
  );
}
