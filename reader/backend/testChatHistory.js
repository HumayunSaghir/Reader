require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    
    const systemContext = `You are a helpful and knowledgeable AI "Book Sommelier" for a reading tracking app. 
You are currently discussing the book "Test Book" by "Test Author". 
Here is a brief description of the book for context: "This is a test description". 
Answer the user's questions about this book politely, accurately, and without giving away major spoilers unless explicitly asked.`;

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemContext + "\n\nDo you understand your role?" }] },
        { role: 'model', parts: [{ text: "Yes, I understand! I am ready to answer any questions about the book." }] },
      ]
    });

    const result = await chat.sendMessage("hey can you tell me more about this book");
    console.log(result.response.text());
  } catch (e) {
    console.error("AI Error:", e);
  }
}
run();
