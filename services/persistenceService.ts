import { Campaign, Profile, RecipientStats } from "../types";

const STORAGE_KEY = "lead_master_campaigns_db";

export class PersistenceService {
  
  // Load all campaigns from "Database"
  static getCampaigns(): Campaign[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Save a new campaign (Integrity Check)
  static async saveCampaign(
    subject: string, 
    category: string,
    htmlContent: string, 
    recipients: Profile[]
  ): Promise<Campaign> {
    
    // 1. Prepare Recipient Data Structure
    const recipientStats: RecipientStats[] = recipients.map(p => ({
      email: p.email || "",
      status: 'sent', // Assume sent for the initial record, will be updated if fails
      openCount: 0
    }));

    // 2. Create Campaign Record
    const newCampaign: Campaign = {
      id: crypto.randomUUID(),
      name: `${category} - ${new Date().toLocaleDateString()}`,
      subject,
      category,
      htmlContent,
      createdAt: new Date().toISOString(),
      recipients: recipientStats,
      stats: {
        totalSent: recipients.length,
        delivered: recipients.length, // Optimistic initial state
        failed: 0,
        uniqueOpens: 0,
        totalOpens: 0
      }
    };

    // 3. Commit to Storage (Simulating SQL Transaction)
    const campaigns = this.getCampaigns();
    campaigns.unshift(newCampaign); // Add to top
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
      return newCampaign;
    } catch (error) {
      throw new Error("Fallo de Integridad: No se pudo persistir la campaña en la base de datos.");
    }
  }

  // Simulate Tracking Pixel Hit (Update Open Count)
  static simulateOpen(campaignId: string): void {
    const campaigns = this.getCampaigns();
    const campaignIndex = campaigns.findIndex(c => c.id === campaignId);
    
    if (campaignIndex !== -1) {
      const campaign = campaigns[campaignIndex];
      
      // Pick a random recipient to "open" the email
      if (campaign.recipients.length > 0) {
        const randomIndex = Math.floor(Math.random() * campaign.recipients.length);
        const recipient = campaign.recipients[randomIndex];
        
        recipient.status = 'opened';
        recipient.openCount += 1;
        recipient.lastOpenAt = new Date().toISOString();

        // Recalculate Aggregates
        campaign.stats.totalOpens += 1;
        campaign.stats.uniqueOpens = campaign.recipients.filter(r => r.openCount > 0).length;

        // Save back
        localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
      }
    }
  }

  static updateAnalysis(campaignId: string, analysis: string): void {
     const campaigns = this.getCampaigns();
     const campaign = campaigns.find(c => c.id === campaignId);
     if (campaign) {
         campaign.aiAnalysis = analysis;
         localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
     }
  }
}