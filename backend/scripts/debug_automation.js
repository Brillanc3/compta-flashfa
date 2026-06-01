const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  const companyId = 1; // On suppose la compagnie 1 pour le test
  
  console.log('--- DEBUG AUTOMATION ---');
  
  // 1. Module Scratch actif ?
  const scratchModule = await prisma.companyModule.findFirst({
    where: { companyId, module: { name: 'scratch' } },
    include: { module: true }
  });
  console.log('Module Scratch actif :', !!scratchModule);
  if (!scratchModule) {
      const allModules = await prisma.module.findMany();
      console.log('Available modules:', allModules.map(m => m.name));
  }
  
  // 2. Workflows en DB ?
  const settings = await prisma.companySettings.findUnique({
    where: { companyId }
  });
  console.log('Workflows en DB:', JSON.stringify(settings?.settings?.automation_workflows, null, 2));

  // 3. User 4 existe ?
  const user4 = await prisma.user.findUnique({ where: { id: 4 } });
  console.log('User 4 existe :', !!user4);
}

debug().catch(console.error).finally(() => prisma.$disconnect());
