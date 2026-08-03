import { type TextDocument } from "../content/schema";
import { type GenerationRequest } from "./generate";
import { completeJson } from "./providers";
import { profile } from "../lang/index";

export async function checkGrammar(doc: TextDocument, req: GenerationRequest, deadline?: number): Promise<boolean> {
  if (!profile.prompts.syntax) {
    return true;
  }

  try {
    const text = doc.sentences.map(s => s.target).join(" ");
    const prompt = `Please analyze the following text and determine if it adheres to this grammatical/syntax rule:
Rule: ${profile.prompts.syntax}

Text:
${text}

Return JSON with a boolean 'valid' and a string 'reason' explaining your choice.`;

    const result = await completeJson<{ valid: boolean }>(prompt, {
      deadline,
      validate: (raw: string) => {
        const parsed = JSON.parse(raw);
        if (typeof parsed.valid !== "boolean") {
          throw new Error("Missing boolean 'valid' in response");
        }
        return parsed as { valid: boolean; reason?: string };
      }
    });

    return result.valid;
  } catch (e) {
    // Fail open if the checker errors out
    return true;
  }
}
