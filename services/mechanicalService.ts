
import { RawProfile, SearchParams } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// This service mimics the behavior of `src/workers/scraper.ts` 
// It acts as the "Mechanical" layer in this demo environment.
// Simulates Puppeteer/Playwright execution in a Node.js environment.

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY not found in environment");
  return key;
};

export class MechanicalService {
  
  static async scrapeRawProfiles(params: SearchParams): Promise<RawProfile[]> {
    console.log("[NODE_WORKER] Initiating Scrape Protocol (Puppeteer/Playwright)...");
    
    // We use a lighter/faster call to simulate the "Scraping" phase.
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const model = "gemini-3-flash-preview"; // Faster model for "mechanical" simulation

    const prompt = `
      ACT AS A NODE.JS WEB SCRAPER (Puppeteer).
      
      Generate ${params.resultsCount} JSON objects representing RAW Instagram profiles found for:
      Niche: ${params.niche}
      Country: ${params.country}
      Nature: ${params.contactNature}
      
      Output ONLY: username, fullName, bio, followerCount, externalUrl.
      
      Make the "bio" text realistic, sometimes messy, sometimes with emails inside.
      DO NOT classify them. DO NOT add "category".
      Just give me the raw data dump mimicking a DOM extraction.
    `;

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
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

      const rawData = JSON.parse(response.text || "[]");

      // --- MECHANICAL PROCESSING (Node.js Logic Simulation) ---
      // Simulating: const emailRegex = /.../; const matches = bio.match(emailRegex);
      
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const phoneRegex = /\+?[0-9][0-9.\- ]{8,}[0-9]/;

      const processedProfiles: RawProfile[] = rawData.map((p: any) => {
        const emailMatch = p.bio.match(emailRegex);
        const phoneMatch = p.bio.match(phoneRegex);

        return {
          ...p,
          email: emailMatch ? emailMatch[0] : null,
          phone: phoneMatch ? phoneMatch[0] : null,
          isScraped: true
        };
      });

      return processedProfiles;

    } catch (error) {
      console.error("Mechanical Scrape Failed:", error);
      throw new Error("Error de conexión con el Worker Node.js.");
    }
  }
}
