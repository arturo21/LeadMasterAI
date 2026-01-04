import { RawProfile, SearchParams } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY not found in environment");
  return key;
};

// Helper function to handle potential JSON truncation or Markdown formatting
const parseRobustJSON = (text: string | undefined): any[] => {
  if (!text) return [];
  
  // 1. Remove Markdown code blocks
  let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  
  try {
    const result = JSON.parse(clean);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    // 2. If parse fails (likely truncation), attempt to recover the valid part of the array
    if (clean.startsWith("[") && !clean.endsWith("]")) {
       const lastClosingBrace = clean.lastIndexOf("}");
       if (lastClosingBrace !== -1) {
          const salvaged = clean.substring(0, lastClosingBrace + 1) + "]";
          try {
             return JSON.parse(salvaged);
          } catch (repairError) {
             // Failed repair
          }
       }
    }
    return [];
  }
};

export class MechanicalService {
  
  static async scrapeRawProfiles(params: SearchParams): Promise<RawProfile[]> {
    console.log("[NODE_WORKER] Initiating Scrape Protocol...");
    
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    // Use fast model for scraping
    const model = "gemini-3-flash-preview"; 

    const prompt = `
      ACT AS A NODE.JS WEB SCRAPER (Puppeteer).
      
      Generate ${params.resultsCount} JSON objects representing RAW Instagram profiles found for:
      Niche: ${params.niche}
      Country: ${params.country}
      Musical Style: ${params.musicStyle || "Any"}
      Nature: ${params.contactNature}
      
      Output ONLY: username, fullName, bio, followerCount, externalUrl.
      
      Make the "bio" text realistic, sometimes messy, sometimes with emails inside.
      DO NOT classify them. DO NOT add "category".
    `;

    // RETRY LOGIC (To fix "Click Twice" / Empty results issue)
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`[WORKER] Attempt ${attempts}/${maxAttempts}`);

        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  username: { type: Type.STRING },
                  fullName: { type: Type.STRING },
                  bio: { type: Type.STRING },
                  externalUrl: { type: Type.STRING },
                  followerCount: { type: Type.INTEGER },
                }
              }
            }
          }
        });

        const rawData = parseRobustJSON(response.text);

        if (rawData.length > 0) {
          // Success! Process and return.
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
          const phoneRegex = /\+?[0-9][0-9.\- ]{8,}[0-9]/;

          return rawData.map((p: any) => {
            const emailMatch = p.bio?.match(emailRegex);
            const phoneMatch = p.bio?.match(phoneRegex);

            return {
              username: p.username || "unknown",
              fullName: p.fullName || "",
              bio: p.bio || "",
              externalUrl: p.externalUrl || "",
              followerCount: p.followerCount || 0,
              email: emailMatch ? emailMatch[0] : null,
              phone: phoneMatch ? phoneMatch[0] : null,
              isScraped: true
            };
          });
        } else {
           console.warn(`[WORKER] Attempt ${attempts} returned empty data. Retrying...`);
        }

      } catch (error) {
        console.error(`[WORKER] Attempt ${attempts} failed:`, error);
        if (attempts === maxAttempts) throw error;
      }
      
      // Small delay before retry
      await new Promise(res => setTimeout(res, 1000));
    }

    throw new Error("No se pudieron extraer perfiles después de varios intentos. Intenta con otro Nicho.");
  }
}