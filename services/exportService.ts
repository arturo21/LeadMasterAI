import { Profile } from "../types";

export class ExportManager {
  
  static copyToClipboard(profiles: Profile[]): Promise<void> {
    const headers = "Usuario,Nombre Completo,Categoría,Seguidores,Email,URL\n";
    const rows = profiles.map(p => 
      `${p.username},"${p.fullName}","${p.category}",${p.followerCount},${p.email || ''},${p.externalUrl || ''}`
    ).join("\n");
    
    return navigator.clipboard.writeText(headers + rows);
  }

  static downloadCSV(profiles: Profile[], filenamePrefix: string) {
    const headers = ["Usuario", "Nombre Completo", "Categoría", "Biografía", "Seguidores", "Email", "Teléfono", "URL", "Fecha Extracción"];
    
    const csvContent = [
      headers.join(","),
      ...profiles.map(p => [
        p.username,
        `"${p.fullName.replace(/"/g, '""')}"`, // Escape quotes
        `"${p.category}"`,
        `"${p.bio.replace(/"/g, '""').replace(/\n/g, ' ')}"`, // Escape quotes and newlines
        p.followerCount,
        p.email || "",
        p.phone || "",
        p.externalUrl || "",
        p.scrapedAt
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    // Requirement: Random Number in filename
    link.setAttribute("download", `${filenamePrefix}_${this.generateRandomNumber()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static downloadHTML(profiles: Profile[], filenamePrefix: string) {
    // Generates an MS Word compatible HTML table
    const tableRows = profiles.map(p => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px;"><b>@${p.username}</b></td>
        <td style="padding: 8px;">${p.fullName}</td>
        <td style="padding: 8px; background-color: #f0f9ff;">${p.category}</td>
        <td style="padding: 8px;">${p.followerCount.toLocaleString()}</td>
        <td style="padding: 8px;">${p.email || '-'}</td>
        <td style="padding: 8px;"><a href="${p.externalUrl}">${p.externalUrl || '-'}</a></td>
        <td style="padding: 8px; font-size: 0.9em; color: #555;">${p.bio}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Reporte Lead Master AI</title>
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #005a9c; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border: 1px solid #ddd; }
          h2 { color: #333; }
        </style>
      </head>
      <body>
        <h2>Reporte Oficial: ${filenamePrefix}</h2>
        <p>Generado por <b>LEAD MASTER AI</b> el ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Seguidores</th>
              <th>Email</th>
              <th>URL</th>
              <th>Biografía</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Changed MIME type to explicitly trigger Word and extension to .doc
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    // Requirement: Random Number in filename
    link.setAttribute("download", `${filenamePrefix}_${this.generateRandomNumber()}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private static generateRandomNumber(): string {
    // Returns a purely numeric random ID (6 digits)
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}