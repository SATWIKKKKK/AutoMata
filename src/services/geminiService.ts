import { GoogleGenAI, Type } from "@google/genai";

// Lazy — only instantiated when a request is actually made so the app
// loads fine even if GEMINI_API_KEY is not set.
function getAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to your .env file to use AI workflow generation."
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: any;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowDAG {
  workflow_name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export async function generateWorkflowFromPrompt(prompt: string): Promise<WorkflowDAG> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: `You are an expert workflow architect. Convert a plain English workflow description into a precise JSON DAG.
      
      AVAILABLE NODE TYPES:
      - cron_trigger: Scheduled start. Config: { cron: string }
      - llm_call: AI task. Config: { model, system_prompt, input_template }
      - tool_call: External tool (gmail, sheets, slack, notion, hubspot). Config: { mcp_server, tool_name, tool_params_template }
      - condition: Branch logic. Config: { expression }
      - human_gate: Approval step. Config: { notify_user_id }
      
      Return a WorkflowDAG object. Position nodes top-to-bottom (y increases by 150px per level).
      Use x=0 for main flow.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          workflow_name: { type: Type.STRING },
          description: { type: Type.STRING },
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                label: { type: Type.STRING },
                config: { type: Type.OBJECT },
                position: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER }
                  }
                }
              }
            }
          },
          edges: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                label: { type: Type.STRING }
              }
            }
          }
        },
        required: ["workflow_name", "description", "nodes", "edges"]
      }
    }
  });

  return JSON.parse(response.text);
}
