import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

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

    const result = await model.generateContent(prompt);

    const output = result.response.text();

    console.log("\n=== GEMINI OUTPUT ===\n");
    console.log(output);

    fs.writeFileSync("graph.json", output);

    console.log("\n✅ Graph saved successfully to graph.json");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

test();