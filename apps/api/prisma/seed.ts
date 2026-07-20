import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@webaudit.ai';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const hashedPassword = await bcrypt.hash('webaudit123!', 12);
    const user = await prisma.user.create({
      data: {
        email,
        name: 'WebAudit Admin',
        password: hashedPassword,
        plan: 'ENTERPRISE',
      },
    });
    console.log(`Seed completed: Created user ${user.email} (Password: webaudit123!)`);
  } else {
    console.log(`Seed skipped: User ${email} already exists`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
