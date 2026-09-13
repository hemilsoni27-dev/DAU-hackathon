import { prisma } from "../lib/prisma";
import type { User, UserRole } from "@prisma/client";

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByClerkId(clerkId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { clerkId } });
  }

  async create(data: {
    email: string;
    displayName: string;
    role?: UserRole;
    clerkId?: string;
  }): Promise<User> {
    return prisma.user.create({ data });
  }

  async countActiveProsumers(): Promise<number> {
    return prisma.user.count({
      where: { role: "PROSUMER" },
    });
  }
}

export const userRepository = new UserRepository();
