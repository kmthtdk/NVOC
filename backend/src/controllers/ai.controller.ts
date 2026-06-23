import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const triageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

/**
 * Forward-looking AI triage. Returns a heuristic suggestion when no GEMINI_API_KEY
 * is configured, so the endpoint is always usable in dev/demo without external calls.
 * When a key is present, this is where a @google/genai call would be wired in.
 */
export const aiController = {
  async triage(req: Request, res: Response): Promise<void> {
    const { title, description } = req.body as z.infer<typeof triageSchema>;
    const text = `${title} ${description}`.toLowerCase();

    if (!env.GEMINI_API_KEY) {
      res.json(heuristicTriage(text, title));
      return;
    }

    // Placeholder for a real Gemini call. Kept behind the key check so the build
    // never hard-depends on the SDK or network at runtime.
    try {
      res.json(heuristicTriage(text, title));
    } catch {
      throw AppError.internal('AI triage failed');
    }
  },
};

function heuristicTriage(text: string, title: string) {
  let suggestedCategory = 'general_request';
  if (/firewall|port|zone|network security/.test(text)) suggestedCategory = 'network_security';
  else if (/ip|wifi|lan|phone|c2d/.test(text)) suggestedCategory = 'network_request';
  else if (/folder|server|permission|restore|directory/.test(text)) suggestedCategory = 'server_request';
  else if (/usb|decrypt|security app|exemption|mds/.test(text)) suggestedCategory = 'security_request';
  else if (/laptop|desktop|monitor|hardware|device|keyboard|mouse/.test(text)) suggestedCategory = 'hardware_request';

  let suggestedPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  if (/urgent|asap|immediately|critical|down|outage/.test(text)) suggestedPriority = 'urgent';
  else if (/important|soon|blocking|deadline/.test(text)) suggestedPriority = 'high';

  const summary = title.length > 120 ? `${title.slice(0, 117)}...` : title;
  return { suggestedCategory, suggestedPriority, summary };
}