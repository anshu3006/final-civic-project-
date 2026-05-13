const { MongoClient } = require('mongodb');

let db;

async function connectDB() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB');

  // Ensure indexes
  await db.collection('users').createIndex({ clerkUserId: 1 }, { unique: true });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });

  return db;
}

function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

module.exports = { connectDB, getDB };
