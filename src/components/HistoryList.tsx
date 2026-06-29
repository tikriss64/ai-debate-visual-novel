/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BookOpen, Calendar, Trash2, Trophy } from "lucide-react";
import { SavedDebate } from "../types";

interface HistoryListProps {
  debates: SavedDebate[];
  onSelectDebate: (debate: SavedDebate) => void;
  onDeleteDebate: (id: string, e: React.MouseEvent) => void;
}

export default function HistoryList({
  debates,
  onSelectDebate,
  onDeleteDebate
}: HistoryListProps) {
  if (debates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-neutral-800 bg-[#141414]/50 text-center">
        <BookOpen className="w-8 h-8 text-neutral-700 mb-2" />
        <span className="text-xs font-mono text-neutral-500 font-medium">
          HISTORIAL VACÍO
        </span>
        <p className="text-xs text-neutral-500 max-w-[200px] mt-1 font-serif italic">
          No hay debates previos guardados en este dispositivo todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
      {debates.map((debate) => {
        const dateObj = new Date(debate.date);
        const formattedDate = dateObj.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        });

        return (
          <div
            key={debate.id}
            onClick={() => onSelectDebate(debate)}
            className="group relative p-4 bg-[#141414]/90 hover:bg-[#1c1c1c] border border-neutral-800 hover:border-neutral-600 rounded-lg shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-1 text-[10px] font-mono text-neutral-500">
                <div className="flex items-center gap-1 text-neutral-400">
                  <Calendar className="w-3 h-3 text-neutral-500" />
                  {formattedDate}
                </div>
                {debate.verdict && (
                  <div className="flex items-center gap-1 font-bold text-neutral-300 bg-[#222] border border-neutral-800 px-1.5 py-0.5 rounded uppercase">
                    <Trophy className="w-2.5 h-2.5 text-amber-500" />
                    {debate.verdict.ganador}
                  </div>
                )}
              </div>

              {/* Title / Topic */}
              <h4 className="text-xs font-serif italic text-stone-200 line-clamp-2 pr-6 leading-relaxed">
                {debate.topic}
              </h4>
            </div>

            {/* Footer deletion */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800/80 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-mono text-neutral-500">
                {debate.history.length / 5} fases completas
              </span>
              <button
                onClick={(e) => onDeleteDebate(debate.id, e)}
                className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                title="Eliminar debate"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
