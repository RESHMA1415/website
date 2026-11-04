// Fills an empty database with starter data. Stop the dev server first when
// using the built-in local database.
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedIfEmpty } from './seeder.js';

await connectDatabase();
const seeded = await seedIfEmpty();
console.log(seeded ? 'Starter data added.' : 'Database already has data; nothing changed.');
await disconnectDatabase();
