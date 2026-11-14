const mongoose = require('mongoose');
const { userSchema, sessionSchema } = require('../dist/modules/auth/auth.module');
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI.');
  const connection = await mongoose.createConnection(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false }).asPromise();
  try {
    // Crear los índices declarados no elimina índices existentes ni datos.
    await connection.model('User', userSchema).createIndexes();
    await connection.model('Session', sessionSchema).createIndexes();
    await connection.collection('music_cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log('Índices creados.');
  } finally { await connection.close(); }
}
main().catch(() => { console.error('No se pudieron crear los índices. Revisa conexión y duplicados.'); process.exitCode = 1; });
