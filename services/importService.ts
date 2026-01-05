import { Profile, LeadCategory } from "../types";

export class ImportService {
  
  static async parseFile(file: File): Promise<Profile[]> {
    return new Promise((resolve, reject) => {
      const isCSV = file.name.endsWith('.csv');
      const isDOC = file.name.endsWith('.doc');

      if (!isCSV && !isDOC) {
        reject(new Error("Formato no soportado. Usa .CSV o .DOC generados por la plataforma."));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error("El archivo está vacío."));
          return;
        }

        try {
          const profiles = isCSV ? this.parseCSV(text) : this.parseDOC(text);
          if (profiles.length === 0) {
            reject(new Error("No se encontraron contactos válidos en el archivo."));
          } else {
            resolve(profiles);
          }
        } catch (error: any) {
          reject(new Error("Error al procesar el archivo: " + error.message));
        }
      };

      reader.onerror = () => reject(new Error("Error de lectura de archivo."));
      reader.readAsText(file);
    });
  }

  private static parseCSV(text: string): Profile[] {
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    
    // Detect column indices dynamically
    let usernameIdx = headers.findIndex(h => h.includes('usuario') || h.includes('user'));
    let nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('name'));
    let categoryIdx = headers.findIndex(h => h.includes('categor') || h.includes('category'));
    let emailIdx = headers.findIndex(h => h.includes('email') || h.includes('correo'));
    let bioIdx = headers.findIndex(h => h.includes('bio') || h.includes('biograf'));
    let followersIdx = headers.findIndex(h => h.includes('seguidores') || h.includes('followers'));
    let urlIdx = headers.findIndex(h => h.includes('url') || h.includes('link'));

    // Fallback logic for emails if header detection fails
    if (emailIdx === -1) {
        if (lines[1]) {
            const firstRow = lines[1].split(',');
            emailIdx = firstRow.findIndex(col => col.includes('@'));
        }
    }

    const profiles: Profile[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i] || !lines[i].trim()) continue; // Skip empty lines
      
      // Basic CSV parsing regex handling quotes
      const rowMatches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      // Fallback to simple split if regex fails or no match found
      const row = rowMatches || lines[i].split(',');
      
      if (!row || row.length === 0) continue;
      
      // Clean quotes function
      const clean = (val: string | undefined) => val ? val.replace(/^"|"$/g, '').trim() : '';

      const email = emailIdx !== -1 && row[emailIdx] ? clean(row[emailIdx]) : null;
      
      // Create profile object only if valid structure found (At least username or email)
      if ((usernameIdx !== -1 && row[usernameIdx]) || email) {
          profiles.push({
            id: crypto.randomUUID(),
            username: usernameIdx !== -1 && row[usernameIdx] ? (clean(row[usernameIdx]) || 'ImportedUser') : 'ImportedUser',
            fullName: nameIdx !== -1 && row[nameIdx] ? clean(row[nameIdx]) : '',
            category: categoryIdx !== -1 && row[categoryIdx] ? (clean(row[categoryIdx]) || LeadCategory.Unclassified) : LeadCategory.Unclassified,
            bio: bioIdx !== -1 && row[bioIdx] ? (clean(row[bioIdx]) || 'Importado vía CSV') : 'Importado vía CSV',
            email: (email && email.includes('@')) ? email : null,
            followerCount: followersIdx !== -1 && row[followersIdx] ? (parseInt(clean(row[followersIdx]) || '0') || 0) : 0,
            phone: null,
            externalUrl: urlIdx !== -1 && row[urlIdx] ? clean(row[urlIdx]) : '',
            relevanceScore: 50,
            scrapedAt: new Date().toISOString(),
            isScraped: true
          });
      }
    }

    return profiles;
  }

  private static parseDOC(htmlContent: string): Profile[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const rows = Array.from(doc.querySelectorAll('tr'));
    
    const profiles: Profile[] = [];

    // Skip header row (index 0)
    rows.forEach((row, index) => {
      if (index === 0) return;
      
      const cells = row.querySelectorAll('td');
      // Expecting standard export format
      if (cells.length < 5) return;

      const rawEmail = cells[4]?.textContent?.trim() || '';
      
      profiles.push({
        id: crypto.randomUUID(),
        username: cells[0]?.textContent?.replace('@', '').trim() || 'Imported',
        fullName: cells[1]?.textContent?.trim() || '',
        category: cells[2]?.textContent?.trim() || LeadCategory.Unclassified,
        followerCount: parseInt(cells[3]?.textContent?.replace(/,/g, '').replace(/\./g, '') || '0'),
        email: (rawEmail !== '-' && rawEmail.includes('@')) ? rawEmail : null,
        externalUrl: cells[5]?.textContent?.trim() || '',
        bio: cells[6]?.textContent?.trim() || 'Importado vía DOC',
        phone: null,
        relevanceScore: 50,
        scrapedAt: new Date().toISOString(),
        isScraped: true
      });
    });

    return profiles;
  }
}