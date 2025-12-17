import { GoogleGenAI, Type } from "@google/genai";
import { ExcalidrawElement } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert diagram generator.
You will generate a list of drawing primitives (rectangle, ellipse, diamond, arrow, text) to create a visual diagram based on the user's request.
The coordinate system starts at x=0, y=0.
Elements should be laid out logically.
For arrows, the 'points' array contains exactly two points: start (0,0) relative to element x,y and end (dx, dy).
`;

export const generateDiagram = async (prompt: string): Promise<ExcalidrawElement[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["rectangle", "ellipse", "diamond", "arrow", "text"] },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
              text: { type: Type.STRING },
              points: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                  },
                },
              },
            },
            required: ["type", "x", "y", "width", "height"],
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const rawElements = JSON.parse(jsonText);

    // Hydrate with default styles
    return rawElements.map((el: any) => ({
      ...el,
      id: crypto.randomUUID(),
      strokeColor: "#000000",
      backgroundColor: "transparent",
      strokeWidth: 2,
      opacity: 100,
      fontSize: 20,
    }));
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
};
