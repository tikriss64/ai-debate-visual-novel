/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterConfig } from "./types";

export const CHARACTERS_MAP: Record<string, CharacterConfig> = {
  estratega: {
    id: "estratega",
    name: "La Estratega",
    role: "Estrategia & Patrones a Largo Plazo",
    color: "#1e3a8a", // Midnight blue
    borderColor: "border-blue-900/65",
    textCol: "text-blue-900",
    bgColor: "bg-blue-50/70",
    description: "Analiza variables profundas, palancas de crecimiento y dinámicas de sistemas macro.",
    voiceLang: "es-ES",
    voiceGender: "F",
    voicePitch: 1.12,
    voiceRate: 0.95,
  },
  esceptico: {
    id: "esceptico",
    name: "El Escéptico",
    role: "Análisis de Fricción & Steelman",
    color: "#b91c1c", // Rojo oscuro/granate (prompt: "rojo oscuro")
    borderColor: "border-red-700/65",
    textCol: "text-red-700",
    bgColor: "bg-red-50/70",
    description: "Encuentra falacias lógicas, sesgos cognitivos, costes de oportunidad y agujeros en las tesis.",
    voiceLang: "es-MX",
    voiceGender: "M",
    voicePitch: 0.85,
    voiceRate: 1.05,
  },
  ingeniera: {
    id: "ingeniera",
    name: "La Ingeniera",
    role: "Pragmatismo Técnico & Ejecución",
    color: "#65a30d", // Verde oliva apagado (prompt: "verde oliva", paleta madura)
    borderColor: "border-lime-700/65",
    textCol: "text-lime-700",
    bgColor: "bg-lime-50/70",
    description: "Evalúa plazos realistas, deudas del sistema, escalabilidad empírica y complejidad de infraestructura.",
    voiceLang: "es-ES",
    voiceGender: "F",
    voicePitch: 1.05,
    voiceRate: 1.1,
  },
  inversor: {
    id: "inversor",
    name: "El Inversor",
    role: "Análisis Financiero & Unitaria Económica",
    color: "#b45309", // Ámbar/dorado apagado (prompt: "ámbar/dorado apagado, sin ostentación")
    borderColor: "border-amber-700/65",
    textCol: "text-amber-800",
    bgColor: "bg-amber-50/70",
    description: "Frío, enfocado en margen bruto, costes distributivos, competencia asimétrica y retorno de inversión.",
    voiceLang: "es-ES",
    voiceGender: "M",
    voicePitch: 0.78,
    voiceRate: 0.9,
  },
  cliente: {
    id: "cliente",
    name: "El Cliente Final",
    role: "Voz del Usuario & Dolor Real",
    color: "#fb7185", // Coral cálido (prompt: "coral cálido", no naranja)
    borderColor: "border-rose-400/65",
    textCol: "text-rose-500",
    bgColor: "bg-rose-50/70",
    description: "Representa a la persona real con sus límites cognitivos, pereza inherente e incentivos de compra.",
    voiceLang: "es-MX",
    voiceGender: "F",
    voicePitch: 1.15,
    voiceRate: 1.05,
  }
};

export const CHARACTERS_LIST = Object.values(CHARACTERS_MAP);

export const SUGGESTED_TOPICS = [
  {
    title: "IA local para médicos",
    description: "Lanzar una IA offline autónoma instalada en hardware local en consultas tradicionales, para resumir fichas clínicas de pacientes sin violar la privacidad.",
    question: "Diseñar una IA para médicos locales instalada físicamente en su consulta de forma offline para resúmenes de pacientes. ¿Es viable técnica y comercialmente?"
  },
  {
    title: "Monetizar un blog con micro-pagos",
    description: "Sustituir toda la publicidad de un periódico digital de nicho con un sistema de micropagos obligatorios de $0.05 por artículo leído mediante Lightning Network de Bitcoin.",
    question: "Eliminar anuncios y cobrar $0.05 por lectura de artículo de blog mediante micropagos de Bitcoin. ¿Logrará sostenibilidad de ingresos?"
  },
  {
    title: "Restaurante robótico autónomo",
    description: "Montar un restaurante de ramen donde el 100% de la cocina, cobro y servicio está automatizado mediante brazos robóticos articulados, eliminando costes laborales en el centro de Madrid.",
    question: "Montar un restaurante de ramen totalmente gestionado por brazos robóticos en el centro de Madrid para ahorrar costes laborales. ¿Es un negocio sólido?"
  }
];
