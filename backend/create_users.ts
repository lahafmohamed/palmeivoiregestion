import db from './src/config/database.js';
import bcrypt from 'bcrypt';

async function main() {
  const users = [
    { nom: 'Rabih', email: 'Jammal@palmeivoire.com', password: 'P@LM1988', role: 'ADMIN' as const },
    { nom: 'Reem', email: 'reem@palmeivoire.com', password: 'P@LM1988', role: 'ADMIN' as const },
    { nom: 'Hussein', email: 'Assi@palmeivoire.com', password: 'P@LM1990', role: 'SUPERVISEUR' as const },
    { nom: 'Abdo', email: 'abdo@palmeivoire.com', password: 'P@LM1988', role: 'SUPERVISEUR' as const },
    { nom: 'Faouzi', email: 'faouzi@palmeivoire.com', password: 'P@LM1969', role: 'SUPERVISEUR' as const },
    { nom: 'Hasan', email: 'hassan@palmeivoire.com', password: 'P@LM1990', role: 'SUPERVISEUR' as const },
    { nom: 'Ali Nazzal', email: 'nazzal@palmeivoire.com', password: 'P@LM1999', role: 'SUPERVISEUR' as const },
  ];

  for (const userData of users) {
    const hash = await bcrypt.hash(userData.password, 10);
    const user = await db.user.upsert({
      where: { email: userData.email },
      update: { passwordHash: hash, role: userData.role, nom: userData.nom },
      create: { email: userData.email, passwordHash: hash, role: userData.role, nom: userData.nom },
    });

    console.log(`${userData.nom}:`, user.id, user.email, user.role);
  }

  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
