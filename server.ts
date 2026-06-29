import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

// Cargamos primero .env.local (convención de AI Studio y Next.js para secretos locales)
// y luego .env como fallback. La primera lectura gana, así que .env.local tiene prioridad.
dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
// Render (y otros hosts) inyectan el puerto vía variable de entorno PORT.
// En local, si no está definida, usamos 3000.
const PORT = Number(process.env.PORT) || 3000;

// Modo demo: si MOCK_AI=true el servidor simula respuestas sin llamar a Gemini.
// Útil para probar toda la interfaz sin gastar cuota ni configurar API key.
const MOCK_AI = process.env.MOCK_AI === "true";

// Modelos configurables por entorno.
// - Personajes: flash-lite (más rápido y con cuota gratuita más generosa: 1000 req/día,
//   ~2.4x más veloz). Ideal para 20 intervenciones cortas por debate.
// - Moderador: el modelo completo, que solo se llama 1 vez y produce el JSON del veredicto
//   (donde la calidad del análisis importa más que la velocidad).
const MODEL_CHARACTERS = process.env.GEMINI_MODEL_CHARACTERS || "gemini-3.1-flash-lite";
const MODEL_MODERATOR = process.env.GEMINI_MODEL_MODERATOR || "gemini-3.5-flash";

// Nivel de "thinking" (solo modelos Gemini 3.x). En personajes lo bajamos para minimizar
// la latencia hasta el primer token (respuestas de 2-4 frases no necesitan razonamiento
// profundo). Solo se añade si el modelo es 3.x, para no romper con 2.5.x (que usa otra API).
const supportsThinkingLevel = (model: string) => /^gemini-3/.test(model);

// Búsqueda web factual (DuckDuckGo). Activada por defecto; se puede apagar con WEB_SEARCH=false.
// Tiene degradación elegante: si falla o no devuelve nada, el debate continúa igual.
const WEB_SEARCH = process.env.WEB_SEARCH !== "false";

app.use(express.json());

// Serve /assets from absolute workspace so users can upload character sprites
app.use("/assets", express.static(path.join(process.cwd(), "assets")));

// Lazy GoogleGenAI initialization
let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it in the Secrets panel in AI Studio.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Reintento con backoff exponencial para errores transitorios, sobre todo 429
// (rate limit del free tier: 15 req/min). Al lanzar 5 personajes en paralelo es fácil
// rozar ese límite; reintentar evita que una intervención se quede vacía.
async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      const status = err?.status || err?.code;
      const isTransient =
        status === 429 || status === 503 || status === 500 ||
        /429|rate|quota|overloaded|unavailable|temporarily/i.test(msg);
      if (!isTransient || attempt === retries) break;
      // 0.8s, 1.6s, 3.2s + jitter
      const delay = Math.round(800 * Math.pow(2, attempt) + Math.random() * 400);
      console.warn(`[retry] ${label} intento ${attempt + 1} falló (${status || "?"}). Reintento en ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

const CHARACTERS: Record<string, { name: string; role: string; systemPrompt: string; color: string }> = {
  estratega: {
    name: "La Estratega",
    role: "La Estratega (azul medianoche)",
    color: "#1e3a8a",
    systemPrompt:
      "Eres una amiga que piensa a largo plazo. Cuando alguien te cuenta una idea, lo primero que ves es qué pasa dentro de dos años si esto sale bien y si sale mal. Tu manía: te encanta poner ejemplos de cosas que has visto pasar antes. " +
      "Hablas en frases cortas y tranquilas. NO usas palabras de consultora. Si quieres decir que algo es complicado, dices 'es complicado', no 'presenta una elevada complejidad'. " +
      "Cuando alguien dice algo y vas a opinar, primero recoges lo que ha dicho con tus palabras ('lo que oigo es...', 'entonces tú dices que...') y luego das tu visión. Si te convencen, lo dices ('vale, llevas razón en esto'). Si ves un problema, lo dices claro ('el problema que veo aquí es...'). " +
      "Lo que tú aportas y los demás no: lo que va a pasar el año que viene si avanzamos por ese camino. " +
      "PROHIBIDO en lo que escribes: las palabras 'tesis', 'postura', 'fase', 'argumento', 'steelman', 'robusto', 'rigor', 'sostenible' (en sentido abstracto), 'óptimo', 'paradigma', 'asimetría'. Si te sale una de esas, reescribe la frase con palabras normales."
  },
  esceptico: {
    name: "El Escéptico",
    role: "El Escéptico (rojo oscuro)",
    color: "#b91c1c",
    systemPrompt:
      "Eres ese amigo que te frena cuando estás emocionado con una idea. No por aguafiestas: porque sabes que las ideas brillantes mueren por detalles aburridos. Te gustan las preguntas incómodas: '¿y quién paga eso?', '¿y si no funciona?', '¿estás seguro de que la gente quiere esto?'. " +
      "Hablas en directo, con un punto de humor seco si toca. Usas comparaciones de la vida real ('eso es como abrir un restaurante porque a ti te gusta cocinar'). NUNCA hablas como un filósofo ni como un crítico de cine. " +
      "Cuando vas a discrepar, primero dejas claro que has entendido al otro ('vale, lo que dices es...'). Luego sueltas tu duda concreta. Si te convencen, lo aceptas sin drama ('vale, eso no lo había pensado, tienes razón'). Si no encuentras un fallo serio, lo dices ('honestamente, lo que dices se sostiene'). " +
      "Lo que tú aportas: la pregunta incómoda que nadie quería hacer. " +
      "PROHIBIDO en lo que escribes: 'tesis', 'postura', 'argumento', 'steelman', 'falacia', 'sesgo cognitivo', 'asimetría', 'paradigma', 'robusto', 'incisivo'. Habla normal, como alguien con calle."
  },
  ingeniera: {
    name: "La Ingeniera",
    role: "La Ingeniera (verde oliva)",
    color: "#65a30d",
    systemPrompt:
      "Eres una desarrolladora con quince años de oficio que ha entregado muchas cosas y se ha quemado las manos varias veces. Cuando alguien dice 'lo lanzamos en un mes' tú piensas '¿en serio? esto son seis semanas mínimo'. No es pesimismo: es haberlo vivido. " +
      "Hablas claro, frases cortas, vas al grano. Tu tic: traducir todo a tiempo o personas ('eso son tres semanas con un equipo de dos', 'eso no lo monta una sola persona'). Si alguien dice algo vago, pides cifras ('¿cuántos usuarios? ¿en qué plazo?'). " +
      "Cuando opinas: primero recoges la idea del otro en una frase ('o sea, lo que propones es...'). Luego dices si es construible o no, y con qué. Si te convencen, lo dices ('vale, eso sí se puede'). " +
      "Lo que tú aportas: cuánto tiempo, cuánta gente, qué se rompe primero. Y lo que no es viable, dilo. " +
      "PROHIBIDO: 'tesis', 'fase', 'steelman', 'paradigma', 'robusto', 'arquitectónicamente', 'óptimamente'. Habla como una persona normal que sabe del tema, no como una arquitecta de software en una conferencia."
  },
  inversor: {
    name: "El Inversor",
    role: "El Inversor (ámbar/dorado apagado)",
    color: "#b45309",
    systemPrompt:
      "Eres un emprendedor que montó dos negocios: uno funcionó, otro se hundió. Ahora cuando alguien te cuenta una idea piensas dos cosas: '¿de dónde sale el dinero?' y '¿qué impide que otro lo copie y te coma?'. Eres frío con los números, no con las personas. " +
      "Hablas directo, con un punto cansado de quien ha visto demasiadas presentaciones. Tus comparaciones: 'eso ya lo intentó tal empresa y se la pegó'. Si una idea no se sostiene económicamente, lo dices sin rodeos. " +
      "Al opinar: primero resumes lo que ha dicho el otro ('si te entiendo, propones que...'). Luego vas a lo tuyo: ¿quién paga, cuánto, cada cuánto? Si los números no salen, lo dices. Si te convencen, lo aceptas ('vale, ahí sí veo negocio'). " +
      "Lo que tú aportas: si esto puede dar dinero de verdad o no, y por dónde se entra la competencia. " +
      "PROHIBIDO: 'tesis', 'fase', 'asimetría', 'unidad económica' (di 'cuánto gana por cliente'), 'defensibilidad' (di 'cómo evitamos que nos copien'), 'tracción' (di 'señales de que la gente quiere esto'). Habla como un empresario de toda la vida, no como un consultor."
  },
  cliente: {
    name: "El Cliente Final",
    role: "El Cliente Final (coral cálido)",
    color: "#fb7185",
    systemPrompt:
      "Eres una mujer normal, no del mundo de la empresa ni de la tecnología. Trabajas, tienes tus cosas, y si te muestran una idea piensas tres cosas muy simples: ¿entiendo qué es esto? ¿me ayuda a mí en algo? ¿pagaría por esto? " +
      "Hablas como hablarías con un colega en una cafetería. Frases cortas, palabras sencillas. Si no entiendes algo de lo que dicen los otros, lo dices: 'oye, eso último no lo he entendido'. Si algo te suena raro, lo dices: 'a mí esto me sonaría a tomadura de pelo'. " +
      "Cuando opinas: primero dices con tus palabras lo que has entendido del otro ('o sea, lo que dices es que...'). Si te convence, lo dices ('mira, esto último sí me ha hecho cambiar de idea'). Si no, sueltas tu pega tal cual ('pero entonces yo tengo que hacer tres pasos antes de usarlo, eso a mí me da pereza'). " +
      "Lo que tú aportas: la fricción real que el resto no ve porque están muy metidos. Cuando algo suena bonito en una reunión pero no lo usarías ni gratis, lo dices. " +
      "PROHIBIDO: jerga, anglicismos, frases largas, hablar como un libro. Si te sale, reescríbelo más corto y más fácil."
  }
};

// Check API key configuration status
app.get("/api/config", (req, res) => {
  const hasKey = MOCK_AI || !!process.env.GEMINI_API_KEY;
  res.json({ hasApiKey: hasKey, mock: MOCK_AI });
});

// --- Helpers para el modo demo (MOCK_AI) ---
const MOCK_FRASES: Record<string, Record<number, string>> = {
  estratega: {
    1: "Si miramos el tablero a tres años vista, la pregunta real no es si esto funciona hoy, sino qué palanca de crecimiento desbloquea mañana. Apostaría por la opción que mantiene más caminos abiertos.",
    2: "Reformulando a {target}: su tesis maximiza el retorno inmediato, lo cual es legítimo. Pero ignora que optimizar el corto plazo aquí cierra la puerta a la ventaja compuesta que solo aparece con paciencia.",
    3: "El Escéptico tiene razón en que asumo continuidad del mercado. Lo concedo en parte: añado una cláusula de revisión a 12 meses, pero mantengo que la dirección estratégica es correcta.",
    4: "Mi voto va para La Ingeniera. Su realismo de ejecución expuso la debilidad de mi enfoque: una estrategia sin plazos verificables es solo una intención elegante."
  },
  esceptico: {
    1: "Permítanme dudar antes de aplaudir. Toda propuesta aquí asume que el usuario se comportará racionalmente, y eso casi nunca ocurre. ¿Dónde está el coste oculto que nadie quiere nombrar?",
    2: "La versión más fuerte de lo que dice {target} es impecable sobre el papel. El problema: descansa sobre una suposición no verificada de adopción. Sin ese dato, todo el castillo se sostiene en el aire.",
    3: "Acepto la crítica: mi escepticismo no propone alternativas. Matizo entonces: no pido abandonar la idea, pido un experimento barato que la valide antes de comprometer recursos.",
    4: "Otorgo mi voto a La Estratega. Reconozco que mi postura, aunque afilada, era puramente defensiva; ella ofreció una dirección y la defendió bajo fuego."
  },
  ingeniera: {
    1: "Pregunta práctica: ¿con qué recursos y en qué plazo? Puedo construir casi cualquier cosa, pero 'casi' y 'cualquier cosa' tienen un precio en semanas y deuda técnica que conviene poner sobre la mesa ya.",
    2: "Entiendo a {target}: su visión es ambiciosa y coherente. Pero desde ingeniería, esa ambición implica una complejidad de mantenimiento que duplicaría el equipo. Eso no aparece en su cálculo.",
    3: "El Inversor señala bien que mi plan es conservador. Lo asumo y lo defiendo: prefiero entregar algo sólido en seis semanas que prometer lo brillante en seis meses que nunca llegan.",
    4: "Mi voto es para El Cliente Final. Su honestidad me recordó que la viabilidad técnica no sirve de nada si la persona real no entiende ni usa lo que construimos."
  },
  inversor: {
    1: "Solo me importa una cosa: el retorno ajustado al riesgo. ¿Cuál es el coste de adquisición, el margen y la defensa frente a la competencia? Sin unidad económica clara, lo demás es poesía.",
    2: "Concedo que la propuesta de {target} es sólida en su lógica interna. Sin embargo, no he visto un solo número de mercado. Una buena idea sin distribución es un pasivo, no un activo.",
    3: "La Estratega tiene un punto: estoy descontando el valor a largo plazo. Lo incorporo, pero mantengo que sin tracción temprana no hay largo plazo que valga.",
    4: "Voto por La Ingeniera. Fue la única que tradujo la ambición en costes concretos, y el dinero solo respeta lo que se puede medir."
  },
  cliente: {
    1: "A ver, hablando claro: si yo no entiendo esto en diez segundos, no lo uso. Me da igual lo inteligente que sea por dentro; lo que me importa es si me resuelve mi problema y si lo pagaría.",
    2: "Lo que dice {target} suena muy bien para gente lista como ustedes. Pero yo, persona normal, me pierdo. Y si yo me pierdo, su idea tiene un problema que no es mío, es suyo.",
    3: "Vale, me han convencido de que exageraba con lo del precio. Lo reconozco. Pero sigo necesitando que alguien me explique esto sin palabras raras, porque ahí está el verdadero filtro.",
    4: "Mi voto va para El Escéptico. Hizo las preguntas incómodas que yo sentía pero no sabía formular. Me fío de quien duda antes de quien promete."
  }
};

function mockTextFor(characterId: string, phase: number, targetName?: string): string {
  const base = MOCK_FRASES[characterId]?.[phase] || "Intervención de prueba en modo demo.";
  return base.replace(/\{target\}/g, targetName || "mi colega");
}

async function streamMock(res: express.Response, text: string) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  // Enviar palabra a palabra para simular el streaming real
  const words = text.split(" ");
  for (const w of words) {
    res.write(w + " ");
    await new Promise((r) => setTimeout(r, 35));
  }
  res.end();
}

// --- Búsqueda web factual gratuita (DuckDuckGo Instant Answer API, sin API key) ---
// Devuelve un breve contexto factual o cadena vacía. NUNCA lanza: si algo falla,
// devuelve "" y el debate sigue sin datos externos (degradación elegante).
async function webSearch(query: string): Promise<string> {
  if (!WEB_SEARCH || !query?.trim()) return "";
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&skip_disambig=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "debate-ias/1.0" }
    });
    clearTimeout(timer);
    if (!r.ok) return "";
    const data: any = await r.json();
    const bits: string[] = [];
    if (data.AbstractText) bits.push(data.AbstractText);
    if (Array.isArray(data.RelatedTopics)) {
      for (const rt of data.RelatedTopics) {
        if (rt?.Text) bits.push(rt.Text);
        if (bits.length >= 4) break;
      }
    }
    return bits.join("\n").slice(0, 700).trim();
  } catch {
    // Timeout, red caída, JSON inválido… da igual: seguimos sin contexto externo.
    return "";
  }
}

// Check which custom character assets physically exist on the server
app.get("/api/assets", (req, res) => {
  try {
    const assetsDir = path.join(process.cwd(), "assets");
    const result: Record<string, string[]> = {};
    if (fs.existsSync(assetsDir)) {
      const characters = ["estratega", "esceptico", "ingeniera", "inversor", "cliente"];
      for (const charId of characters) {
        const charDir = path.join(assetsDir, charId);
        if (fs.existsSync(charDir)) {
          const files = fs.readdirSync(charDir);
          result[charId] = files.filter(f => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg"));
        } else {
          result[charId] = [];
        }
      }
    }
    res.json(result);
  } catch (err) {
    res.json({});
  }
});

// Stream debate responses per character and phase
app.post("/api/debate/stream", async (req, res) => {
  const {
    characterId,
    phase,
    topic,
    targetCharacterId,
    targetThesis,
    attackerId,
    attackText,
    originalThesis,
    thesesList
  } = req.body;

  try {
    const character = CHARACTERS[characterId];
    if (!character) {
      res.status(400).send("Character not found");
      return;
    }

    // Modo demo: devolver texto simulado sin tocar la API de Gemini
    if (MOCK_AI) {
      const targetName = targetCharacterId ? CHARACTERS[targetCharacterId]?.name : undefined;
      await streamMock(res, mockTextFor(characterId, phase, targetName));
      return;
    }

    const ai = getAI();

    // Set connection headers for chunked transferring
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    let prompt = "";

    if (phase === 1) {
      // Contexto factual opcional. Si la búsqueda no aporta nada, factual = "" y el
      // prompt queda idéntico al original: nunca degrada la respuesta del personaje.
      const factual = await webSearch(topic);
      const factualBlock = factual
        ? `\n\nDatos de contexto encontrados en la web (úsalos SOLO si son relevantes y fiables para tu argumento; si no aportan, ignóralos por completo y no los menciones):\n"""\n${factual}\n"""`
        : "";

      prompt = `Esto es lo que ha planteado la persona:
"${topic}"${factualBlock}

Reacciona como reaccionarías en una conversación de café con un amigo que te lo acaba de contar. Sin estructura ni numeración: habla.

Lo que tu respuesta debe contener (de forma natural):
· Lo que tú harías o no harías, dicho claro. Si la respuesta es "depende", di de qué depende exactamente.
· Por qué piensas eso, con un par de razones tuyas. Si puedes, con un ejemplo o comparación concreta.
· Algo en lo que la persona quizá no haya caído.

Extensión: entre 3 y 5 frases CORTAS. Sin "interesante propuesta", sin "buena pregunta", sin presentarte. Métete directo. Frases que entienda cualquiera, sin palabras de consultor.`;
    } else if (phase === 2) {
      const targetCharacterName = CHARACTERS[targetCharacterId]?.name || targetCharacterId;
      prompt = `${targetCharacterName} acaba de decir esto:
"${targetThesis}"

Tu turno: contéstale como en una conversación de verdad. Primero, con tus palabras, di lo que has entendido (algo como "vale, o sea tú dices que..." o "si te entiendo bien..."). Después, suelta tu pega o tu duda concreta: lo que crees que no ha pensado, o el problema que ves desde tu lado.

Extensión: 3-5 frases CORTAS. Nada de discursos largos. Habla como una persona normal hablándole a otra. Si después de pensarlo te parece que lo que dijo tiene sentido, dilo: "la verdad, lo que dice me cuadra; mi única duda sería...".`;
    } else if (phase === 3) {
      const attackerName = CHARACTERS[attackerId]?.name || attackerId;
      prompt = `${attackerName} te ha contestado esto:
"${attackText}"

Lo que tú habías dicho era:
"${originalThesis}"

Respóndele honesto. Tres caminos posibles (elige el que de verdad pienses):
· Si crees que su pega no te toca, explícale por qué con un argumento NUEVO (no repetir lo de antes).
· Si tiene parte de razón, dilo claro: "vale, eso me hace pensarlo de otra manera; lo replantearía así...".
· Si te ha convencido, reconócelo sin más: "tienes razón, ahora lo veo de otro modo".

Extensión: 3-5 frases CORTAS. Habla en lenguaje normal, como en una conversación. Aquí ser honesto vale más que tener razón.`;
    } else if (phase === 4) {
      prompt = `Tras escuchar a todos, dinos con cuál de los demás (no contigo) te quedas: cuál es la opinión que más te ha convencido para responder a la persona que nos lo planteó.

Esto es lo que dijo cada uno después de la conversación:
${thesesList}

Responde en 3-5 frases CORTAS:
· Di con quién te quedas, usando su nombre completo ("Me quedo con La Ingeniera", "Voto por El Inversor"...).
· Explica POR QUÉ: qué dijo esa persona que te abrió los ojos.
· Reconoce algo que tú te habías saltado y que la conversación te ha hecho ver.

No te elijas a ti mismo. No te quedes a medias. Decídete por uno. Lenguaje normal.`;
    }

    const charConfig: any = {
      systemInstruction: character.systemPrompt,
      // Temperatura alta (0.85) para que sus voces sean distintas y vivas, no calcadas.
      temperature: 0.85,
      // Espacio amplio para que la respuesta no se trunque a mitad de frase. En conversación
      // suele quedar muy por debajo de este tope; el límite real lo marca el prompt ("3-5 frases").
      maxOutputTokens: 800,
    };
    // NOTA: NO añadimos thinkingConfig aquí. En Gemini 3.x "lite" el thinking consume
    // tokens del mismo presupuesto que la salida y, en frases conversacionales cortas,
    // hacía que algunas respuestas se cortaran. La temperatura alta basta para variedad.

    const responseStream = await withRetry(
      () =>
        ai.models.generateContentStream({
          model: MODEL_CHARACTERS,
          contents: prompt,
          config: charConfig,
        }),
      `stream ${characterId} fase ${phase}`
    );

    for await (const chunk of responseStream) {
      res.write(chunk.text || "");
    }
    res.end();
  } catch (error: any) {
    console.error("Error in streaming response:", error);
    res.status(500).write(`[ERROR: ${error.message || "Error al conectar con la API de Gemini"}]`);
    res.end();
  }
});

// Calculate final verdict from the entire debate history
app.post("/api/debate/verdict", async (req, res) => {
  const { topic, history } = req.body;

  try {
    // Modo demo: veredicto simulado sin llamar a Gemini
    if (MOCK_AI) {
      res.json({
        ganador: "La Ingeniera",
        tesisGanadora: "Avanzar con un MVP acotado, medible en seis semanas, antes de comprometer recursos a la visión completa.",
        recomendacionAccionable: "Sí, adelante, pero con un MVP estrictamente acotado. Define un alcance medible en seis semanas y un único indicador de éxito; si no lo alcanzas, replantéate la inversión.",
        queHacer: [
          "Definir un MVP con UNA sola funcionalidad nuclear y un criterio de éxito numérico.",
          "Validar con 10-15 usuarios reales antes de cualquier desarrollo serio.",
          "Establecer un presupuesto y un plazo de 6 semanas; revisar al final si seguir o parar.",
          "Medir desde el día 1 una métrica de adopción clave (no de vanidad)."
        ],
        queEvitar: [
          "No comprometer recursos a la visión completa hasta validar el MVP.",
          "No confundir feedback amable con tracción real.",
          "No optimizar prematuramente: feo y funcional es mejor que bonito y especulativo."
        ],
        razonesDecisivas: [
          "Fue la única tesis que tradujo la ambición en plazos y costes verificables.",
          "Resistió tanto la crítica financiera del Inversor como la duda metodológica del Escéptico.",
          "Mantiene abiertas las palancas de largo plazo que defendía La Estratega."
        ],
        cambiosDeOpinion: [
          {
            personaje: "El Cliente Final",
            de: "El precio inicial es un obstáculo insalvable.",
            a: "El precio es aceptable si la propuesta se entiende sin fricción.",
            razon: "La Ingeniera demostró que el coste se amortiza con una curva de aprendizaje mínima."
          },
          {
            personaje: "El Inversor",
            de: "Sin tracción temprana no hay caso de inversión.",
            a: "Un MVP medible es tracción suficiente para una primera apuesta.",
            razon: "La Estratega reconcilió el corto plazo con el valor compuesto futuro."
          }
        ],
        desacuerdosPersistentes: "Persiste el desacuerdo sobre si escalar con un solo modelo o con varios modelos diversos desde el inicio."
      });
      return;
    }

    const ai = getAI();

    const debateHistoryText = history
      .map((h: any) => `[Fase ${h.phase}] ${CHARACTERS[h.characterId]?.name || h.characterId}: ${h.text}`)
      .join("\n\n");

    const prompt = `Eres quien resume al usuario lo que las cinco personas dijeron sobre lo que él planteó:
"${topic}"

Conversación completa:
${debateHistoryText}

No eres un consultor ni un analista. Eres un amigo del usuario que estaba escuchando y ahora le explica el resultado en lenguaje normal. El usuario quiere SABER QUÉ HACER, no leer un informe.

Devuelve un JSON con todos los campos del esquema. Importante cómo escribes cada uno:

- "recomendacionAccionable": dirígete al usuario de tú. En 2-3 frases CORTAS, dile claro qué pensamos: si lo haga, si no lo haga, o de qué depende. Frases como "Sí, hazlo, pero antes...", "No vale la pena, mejor X", "Depende: si Y, sí; si Z, no". Lenguaje cotidiano.

- "queHacer": 3-5 acciones concretas, cada una en una frase corta y entendible. Empezando por verbo en infinitivo (validar, probar, hablar con, calcular...). Como una lista de cosas para apuntar en una libreta. Nada de "implementar metodologías".

- "queEvitar": 2-4 cosas concretas a evitar, también frases cortas, empezando por "No ...". Específicas, derivadas de la conversación.

- "tesisGanadora": la idea de la persona que más convenció, resumida con tus palabras (no copies su frase). 1-2 frases sencillas.

- "razonesDecisivas": 2-3 razones por las que esa idea convenció. Frases cortas, lenguaje normal.

- "cambiosDeOpinion": personajes que cambiaron lo que pensaban durante la conversación.

- "desacuerdosPersistentes": qué quedó sin resolver y a la persona le toca investigar después. 1-2 frases simples.

PROHIBIDO en TODO el JSON: las palabras "tesis", "postura", "argumento", "robusto", "rigor", "ejecutivo", "óptimo", "paradigma", "tracción", "asimetría", "unidad económica", "defensibilidad", "asunción". Si alguna te sale, reescríbelo en lenguaje normal. Tu lector tiene que entenderlo TODO sin esfuerzo.`;

    const moderatorConfig: any = {
      systemInstruction: "Eres un amigo del usuario que estaba escuchando la conversación y ahora le resume las conclusiones. Hablas claro, en lenguaje cotidiano, con frases cortas. Nada de tono de informe ni de consultor. Tu objetivo: que el usuario sepa exactamente qué hacer cuando termine de leerte.",
      responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ganador: {
              type: Type.STRING,
              description: "El nombre del personaje cuya tesis original o madurada resultó la más sólida del debate (La Estratega, El Escéptico, La Ingeniera, El Inversor, El Cliente Final)."
            },
            tesisGanadora: {
              type: Type.STRING,
              description: "Resumen pulcro de la tesis ganadora y su propuesta filosófica central."
            },
            recomendacionAccionable: {
              type: Type.STRING,
              description: "Respuesta directa al usuario en 2-3 frases con un veredicto claro (sí/no/depende de X) y la dirección concreta a seguir tras el debate."
            },
            queHacer: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de 3-5 acciones concretas y ordenadas por prioridad que el usuario debería ejecutar. Cada item empieza con un verbo en infinitivo."
            },
            queEvitar: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de 2-4 errores o riesgos concretos a evitar, derivados de las críticas que aguantaron en el debate. Cada item empieza con 'No ...' u otro verbo en negativo."
            },
            razonesDecisivas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Las 2 o 3 razones fundamentales e intelectuales por las cuales esta postura prevaleció sobre las demás."
            },
            cambiosDeOpinion: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  personaje: { type: Type.STRING, description: "El nombre del personaje." },
                  de: { type: Type.STRING, description: "Su postura o asunción original antes del debate." },
                  a: { type: Type.STRING, description: "La postura razonada que adoptó o el terreno que concedió." },
                  razon: { type: Type.STRING, description: "La fundamentación lógica o el contraargumento de su colega que le forzó a cambiar." }
                },
                required: ["personaje", "de", "a", "razon"]
              },
              description: "Lista de personajes que cambiaron parcial o totalmente su opinión y las causas."
            },
            desacuerdosPersistentes: {
              type: Type.STRING,
              description: "Puntos de fricción teórica, riesgos no mitigados o desacuerdos implícitos que siguen sin resolverse."
            }
          },
          required: ["ganador", "tesisGanadora", "recomendacionAccionable", "queHacer", "queEvitar", "razonesDecisivas", "cambiosDeOpinion", "desacuerdosPersistentes"]
        }
    };

    // El moderador sí se beneficia de algo de razonamiento (analiza todo el debate).
    if (supportsThinkingLevel(MODEL_MODERATOR)) {
      moderatorConfig.thinkingConfig = { thinkingLevel: "medium" };
    }

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model: MODEL_MODERATOR,
          contents: prompt,
          config: moderatorConfig,
        }),
      "verdict moderator"
    );

    const parsedResponse = JSON.parse(response.text || "{}");
    res.json(parsedResponse);
  } catch (error: any) {
    console.error("Error generating final verdict JSON:", error);
    res.status(500).json({ error: error.message || "Error al sintetizar el veredicto" });
  }
});

// Setup Vite Dev Server / Static files serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
