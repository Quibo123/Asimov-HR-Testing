import { PrismaClient, Prisma } from "@prisma/client";

export const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 10_000, // wait up to 10 s to get a connection
    timeout: 30_000, // a transaction may run up to 30 s
  },
});

export { Prisma };
export type Tx = Prisma.TransactionClient;