/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { CHARACTERS_MAP } from "../constants";

interface SupportIndicatorsProps {
  ratings: Record<string, { initial: number; current: number }>;
}

export default function SupportIndicators({ ratings }: SupportIndicatorsProps) {
  return (
    <div className="p-5 bg-[#121212]/90 border border-neutral-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800/80">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
            Ideas en Juego
          </h3>
          <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
            Apoyo inicial vs. Desempeño en vivo
          </p>
        </div>
        <div className="text-[10px] font-mono text-neutral-400 bg-[#161616] px-2 py-0.5 rounded border border-neutral-800">
          Sincronizado
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(CHARACTERS_MAP).map(([id, config]) => {
          const valueObj = ratings[id] || { initial: 30, current: 30 };
          const { initial, current } = valueObj;
          const delta = current - initial;

          return (
            <div key={id} className="space-y-1">
              {/* Header */}
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 font-medium">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-stone-300">{config.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 font-light">{initial}%</span>
                  <span className="text-neutral-700">→</span>
                  <span className="font-bold text-stone-200" style={{ color: config.color }}>
                    {current}%
                  </span>
                  {delta !== 0 && (
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded-sm ${
                        delta > 0
                          ? "bg-green-950/40 text-green-400 border border-green-900/30"
                          : "bg-red-950/40 text-red-400 border border-red-900/30"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}%
                    </span>
                  )}
                </div>
              </div>

              {/* Gauge Track */}
              <div className="relative h-2.5 w-full bg-[#181818] rounded-full overflow-hidden border border-neutral-800/60">
                {/* Initial baseline marker track */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-neutral-800"
                  style={{ width: `${initial}%` }}
                />

                {/* Live current support bar animating */}
                <motion.div
                  className="absolute top-0 bottom-0 left-0 rounded-full"
                  style={{ backgroundColor: config.color }}
                  initial={{ width: `${initial}%` }}
                  animate={{ width: `${current}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                />

                {/* Separation tick for baseline */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#0a0a0a]/50"
                  style={{ left: `${initial}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
