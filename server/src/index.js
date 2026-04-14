const { PORT, NODE_ENV } = require('./config/env');
const prisma = require('./config/prisma');
const app = require('./app');

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} [${NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

main();
