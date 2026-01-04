import { GoogleGenAI, Type } from "@google/genai";
import { Profile, LeadCategory, RawProfile, Campaign } from "../types";

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY not found in environment");
  return key;
};

// Usamos el modelo FLASH para velocidad extrema en la extracción
const MODEL_NAME = "gemini-3-flash-preview"; 

// Helper para limpiar respuestas JSON que vienen envueltas en Markdown o truncadas
const cleanJsonOutput = (text: string | undefined): string => {
  if (!text) return "[]";
  
  // Eliminar bloques de código markdown ```json y ```
  let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  
  // Fix Truncation (Si el array no se cierra correctamente)
  if (clean.startsWith("[") && !clean.endsWith("]")) {
     const lastBrace = clean.lastIndexOf("}");
     if (lastBrace !== -1) {
         clean = clean.substring(0, lastBrace + 1) + "]";
     }
  }
  
  return clean;
};

// --- GENERATIVE LAYER ---
export const enrichProfiles = async (
  rawProfiles: RawProfile[],
  targetCategory: string
): Promise<Profile[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  if (rawProfiles.length === 0) return [];

  // optimizacion: enviamos lotes para clasificar
  const prompt = `
    You are an EXPERT LEAD CLASSIFIER.
    
    I will provide a list of ${rawProfiles.length} RAW Instagram profiles.
    
    YOUR TASK:
    1. Analyze the "bio" and "username" of each profile.
    2. Determine the exact "category" from this list:
       ["Medios y Prensa", "Prospecto de Agencia", "Negocios Digitales", "Inversión / Capital", "Industria Musical", "Ruido / Irrelevante"]
    3. Calculate a "relevanceScore" (0-100) based on how well they match the target: "${targetCategory}".
    
    INPUT DATA:
    ${JSON.stringify(rawProfiles.map(p => ({ username: p.username, bio: p.bio })))}
    
    OUTPUT:
    Return a JSON Array of objects with: { "username": string, "category": string, "relevanceScore": number }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.1, // Bajamos temperatura para mayor precisión determinista
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              username: { type: Type.STRING },
              category: { type: Type.STRING },
              relevanceScore: { type: Type.INTEGER }
            }
          }
        }
      }
    });

    // Usamos el helper de limpieza
    const jsonStr = cleanJsonOutput(response.text);
    let classificationData = [];
    
    try {
        classificationData = JSON.parse(jsonStr);
    } catch (parseError) {
        console.error("Error parsing AI JSON:", parseError);
        // Fallback: array vacío, se manejará abajo
    }
    
    // Merge Raw Data (Mechanical) with Insights (AI)
    const enrichedProfiles: Profile[] = rawProfiles.map(raw => {
      const insight = classificationData.find((c: any) => c.username === raw.username);
      return {
        ...raw,
        id: crypto.randomUUID(),
        scrapedAt: new Date().toISOString(),
        category: insight?.category || LeadCategory.Unclassified,
        relevanceScore: insight?.relevanceScore || 50
      };
    });

    return enrichedProfiles;

  } catch (error) {
    console.error("AI Enrichment Failed:", error);
    // Fallback: return raw profiles as unclassified if AI fails
    return rawProfiles.map(raw => ({
        ...raw,
        id: crypto.randomUUID(),
        scrapedAt: new Date().toISOString(),
        category: LeadCategory.Unclassified,
        relevanceScore: 0
    }));
  }
};

// ... (Rest of the file remains for Templates and Analysis)
export const generateEmailTemplate = async (subject: string, category: string, extraInstructions: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const systemInstruction = `
    Eres un experto en Email Marketing y Desarrollo Web Frontend.
    Tu tarea es escribir una plantilla de correo HTML profesional, limpia y persuasiva.
    
    REGLAS TÉCNICAS:
    1. Usa HTML5 puro.
    2. ESTILOS INLINE (CSS) OBLIGATORIOS para máxima compatibilidad con clientes de correo (Gmail, Outlook).
    3. Diseño responsivo (ancho máximo 600px, centrado).
    4. Usa fuentes sans-serif estándar (Arial, Helvetica, sans-serif).
    5. Fondo gris claro (#f4f4f4), contenedor blanco (#ffffff) con padding.
    
    ESTRUCTURA SEGÚN CATEGORÍA:
    - Si es "Nota de prensa": Formato formal, encabezado claro, fecha, cuerpo estructurado, contacto de prensa al final.
    - Si es "Evento" (Vivo/Online): Diseño visual atractivo, fecha/hora destacada, Call to Action (Botón) grande para registrarse.
    - Si es "Convocatoria": Tono directo, detalles de acreditación.
    
    CONTENIDO:
    1. Asunto Contextual: "${subject}"
    2. Instrucciones Específicas del Usuario (MÁXIMA PRIORIDAD): "${extraInstructions}"
    3. Incluye marcadores de posición EXACTOS: {{username}} (nombre usuario), {{fullname}} (nombre real).
    4. NO incluyas markdown, solo devuelve el código HTML crudo.
  `;

  const prompt = `
    Genera una plantilla HTML para una campaña de tipo: "${category}".
    Asunto: "${subject}".
    ${extraInstructions ? `Instrucciones adicionales imperativas: ${extraInstructions}` : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        responseMimeType: "text/plain" // We want raw HTML string
      }
    });

    let html = response.text || "";
    // Limpieza agresiva de markdown para asegurar HTML puro
    html = html.replace(/```html/g, '').replace(/```/g, '');
    return html;
  } catch (error) {
    console.error("Gemini Template Error:", error);
    throw new Error("No se pudo generar la plantilla.");
  }
}

export const analyzeCampaignPerformance = async (campaign: Campaign): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const openRate = (campaign.stats.uniqueOpens / campaign.stats.totalSent) * 100;
  
  const systemInstruction = `
    Eres "DATA ANALYST AI", un consultor de marketing experto en métricas de conversión.
    
    Tu tarea es analizar los resultados de una campaña de email y proporcionar un diagnóstico corto, directo y accionable.
    
    ESTRUCTURA DE RESPUESTA:
    1. Diagnóstico: Evaluación de la Tasa de Apertura (Open Rate).
    2. Problema Detectado: ¿Por qué funcionó o falló? (Analiza el Asunto: "${campaign.subject}").
    3. Acción Correctiva: Una sugerencia concreta para la próxima campaña.
    
    Mantén la respuesta bajo 80 palabras. Usa un tono analítico pero constructivo.
  `;

  const prompt = `
    Analiza esta campaña:
    - Categoría: ${campaign.category}
    - Asunto: "${campaign.subject}"
    - Enviados: ${campaign.stats.totalSent}
    - Aperturas Únicas: ${campaign.stats.uniqueOpens}
    - Tasa de Apertura: ${openRate.toFixed(1)}%
    
    ¿Qué debería mejorar?
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.5,
      }
    });
    return response.text || "No se pudo generar análisis.";
  } catch (error) {
    return "Error al conectar con el motor de análisis.";
  }
};