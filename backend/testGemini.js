import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const prompt = `
You are a system architecture parser.

Extract all entities and dependencies from the given text.

Rules:
- Services should have type "Service"
- External providers like Google OAuth, Twilio, Razorpay should have type "Vendor"
- Databases should have type "Database"
- Return ONLY valid JSON
- Do NOT return markdown
- Do NOT return explanations

Format:

{
  "nodes": [
    {
      "id": "",
      "type": ""
    }
  ],
  "relationships": [
    {
      "source": "",
      "target": "",
      "type": ""
    }
  ]
}

Text:

Auth Service uses Google OAuth.
Login Service depends on Auth Service.
Registration Service depends on Auth Service.
Payment Service uses Razorpay.
Notification Service uses Twilio.
`;

    const result = await genAI.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    const output = result.text;

    console.log("\n=== GEMINI OUTPUT ===\n");
    console.log(output);

    fs.writeFileSync(path.join(__dirname, "graph.json"), output);

    console.log("\n✅ Graph saved successfully to graph.json");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

test();