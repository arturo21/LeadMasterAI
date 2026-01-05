import { RawProfile, SearchParams, MediaTalentSearchParams } from "../types";

export class MechanicalService {
  
  // --- REAL SCRAPING VIA BACKEND ---
  
  private static async fetchRealData(query: string, count: number): Promise<RawProfile[]> {
    try {
      const response = await fetch('/api/scrape-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: count })
      });

      if (!response.ok) {
        throw new Error(`Backend Error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Fallo en extracción real");
      }

      return data.profiles;
    } catch (error) {
      console.error("Real Scraping Failed:", error);
      throw error;
    }
  }

  static async scrapeRawProfiles(params: SearchParams): Promise<RawProfile[]> {
    console.log("[NODE_WORKER] Initiating REAL Scrape Protocol...");

    // Construimos una "Google Dork" query optimizada para encontrar perfiles con email público
    const providers = '"@gmail.com" OR "@hotmail.com" OR "@outlook.com" OR "@yahoo.com"';
    const baseQuery = `site:instagram.com ${params.niche} ${providers}`;
    
    const query = params.mode === 'followers' 
        ? `site:instagram.com "followers" "${params.sourceUsername}" ${providers}`
        : `${baseQuery} "${params.country}"`;

    return this.fetchRealData(query, params.resultsCount);
  }

  // Specialized Scraper for Media Talent
  static async scrapeMediaTalent(params: MediaTalentSearchParams): Promise<RawProfile[]> {
    console.log("[MEDIA_OSINT] Initiating Real Broadcaster Discovery...");
    
    // Si hay género musical, lo agregamos para forzar afinidad mecánicamente en la búsqueda
    const genreFilter = params.musicGenre ? `"${params.musicGenre}"` : "";

    const keywords = `"${params.role}" "${params.country}" ${genreFilter} ("booking" OR "management" OR "contacto")`;
    const query = `site:instagram.com ${keywords} "@"`;

    const results = await this.fetchRealData(query, params.resultsCount);
    
    // Tag the source
    return results.map(r => ({ ...r, sourceNiche: 'MEDIA_TALENT' }));
  }

  // --- MECHANICAL VALIDATION (NO AI) ---
  static async validateEmailBatch(emails: string[]): Promise<{ email: string, isValid: boolean }[]> {
    try {
      const response = await fetch('/api/validate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });
      const data = await response.json();
      return data.results || [];
    } catch (e) {
      console.error("Batch Validation Failed", e);
      return [];
    }
  }
}