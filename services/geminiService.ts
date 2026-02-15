
import {GoogleGenAI} from "@google/genai";

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface AnalysisResult {
  text: string;
  groundingLinks: GroundingLink[];
}

/**
 * Analiza registros de radio y contexto geoespacial usando la API de Gemini con grounding de Google Maps.
 */
export const analyzeRadioTraffic = async (logs: string[], location?: { latitude: number; longitude: number }): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) return { text: "Análisis de IA no disponible: Sin clave API.", groundingLinks: [] };

  try {
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Realiza un análisis G-INT (Inteligencia Geoespacial) de estos registros de radio.
      Identifica ubicaciones mencionadas, sugiere puntos de reunión tácticos y encuentra hospitales o zonas de extracción cercanas según la ubicación actual.
      
      Registros:
      ${logs.join('\n')}`,
      config: {
        temperature: 0.1,
        systemInstruction: "Eres un Oficial de Inteligencia Geoespacial (GEOINT). Proporciona resúmenes tácticos breves EN ESPAÑOL. Utiliza el grounding de Google Maps para identificar coordenadas reales e instalaciones mencionadas o necesarias.",
        tools: [{googleMaps: {}}],
        toolConfig: location ? {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          }
        } : undefined
      },
    });

    const text = response.text || "No se han extraído hallazgos.";
    const groundingLinks: GroundingLink[] = [];

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps) {
          const snippets = chunk.maps.placeAnswerSources?.reviewSnippets || [];
          const snippetText = snippets.length > 0 ? ` - ${snippets.join('. ')}` : "";
          groundingLinks.push({
            uri: chunk.maps.uri,
            title: `${chunk.maps.title || "Ubicación en Mapa"}${snippetText}`
          });
        }
      });
    }

    return { text, groundingLinks };
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return { text: "Error procesando inteligencia.", groundingLinks: [] };
  }
};
