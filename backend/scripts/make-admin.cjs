const mongoose = require('mongoose');
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !process.env.MONGODB_URI) throw new Error('Define MONGODB_URI en el entorno y proporciona un correo.');
  const connection = await mongoose.createConnection(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false }).asPromise();
  try {
    const result = await connection.collection('users').updateOne({ email }, { $set: { role: 'admin', updatedAt: new Date() } });
    if (!result.matchedCount) throw new Error('Usuario no encontrado.');
    console.log('Rol actualizado.');
  } finally { await connection.close(); }
}
main().catch(() => { console.error('No se pudo actualizar el rol. Revisa el entorno y el correo.'); process.exitCode = 1; });
