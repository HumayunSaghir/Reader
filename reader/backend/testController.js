require('dotenv').config();
const mongoose = require('mongoose');
const { chatWithBook } = require('./controllers/bookController');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const req = {
    params: { id: '6ac639fae222eb72029ed007' },
    body: {
      message: 'hey can you tell me more about this book',
      history: []
    }
  };
  
  const res = {
    status: (code) => {
      console.log('Status:', code);
      return res;
    },
    json: (data) => {
      console.log('JSON:', data);
    }
  };
  
  await chatWithBook(req, res);
  process.exit(0);
}
run();
