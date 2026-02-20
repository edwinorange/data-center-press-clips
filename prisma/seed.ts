import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create a test user
  const passwordHash = await bcrypt.hash('password123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'edwin@edwinorange.com' },
    update: {},
    create: {
      email: 'edwin@edwinorange.com',
      name: 'Admin User',
      passwordHash,
      digestPreference: {
        create: {
          frequency: 'daily',
          topics: [],
          states: [],
          importance: 'high_and_medium',
        },
      },
    },
  })

  console.log('Created user:', user.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
