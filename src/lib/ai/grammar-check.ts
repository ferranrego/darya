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
    const prompt = `Please analyze the following text and determine if it strictly adheres to this grammatical/syntax rule:
Rule: ${profile.prompts.syntax}

Text:
${text}

IMPORTANT: Be lenient. ONLY return valid: false if the text EXPLICITLY violates the Rule stated above. Do not reject the text for stylistic choices, slightly unnatural phrasing, or minor errors unrelated to the Rule. If the text does not violate the rule, it is valid.

Return JSON with a boolean 'valid' and a string 'reason' explaining your choice.`;

    const result = await completeJson<{ valid: boolean; reason?: string }>(prompt, {
      deadline,
      validate: (raw: string) => {
        const parsed = JSON.parse(raw);
        if (typeof parsed.valid !== "boolean") {
          throw new Error("Missing boolean 'valid' in response");
        }
        return parsed as { valid: boolean; reason?: string };
      }
    });

    if (!result.valid) {
      console.warn("GRAMMAR VALIDATION REJECTED TEXT. Reason:", result.reason);
    }
    return result.valid;
  } catch {
    // Fail open if the checker errors out
    return true;
  }
}
