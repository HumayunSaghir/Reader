require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  try {
    console.log("Key prefix:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) : 'none');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage("hello");
    console.log(result.response.text());
  } catch (e) {
    console.error("AI Error:", e);
  }
}
run();
