import request from "supertest";
import app from "../../src/index";
import prisma from "../../src/lib/prisma";
import { redis } from "../../src/lib/redis";
import { emailService } from "../../src/services/email.service";
import type { Request, Response, NextFunction } from "express";

interface MemberResponse {
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
}

// Mock email service
jest.mock("../../src/services/email.service", () => ({
  emailService: {
    sendInvitationEmail: jest.fn().mockResolvedValue(true),
  },
}));

// Mock authorization middleware
jest.mock("../../src/middleware/authorization", () => ({
  requirePermission:
    () => (req: Request, res: Response, next: NextFunction) => {
      // Inject mock session
      req.session = { user: { id: "test-owner-id", role: "ADMIN" } };
      next();
    },
  requireAdmin: (req: Request, res: Response, next: NextFunction) => {
    req.session = { user: { id: "test-owner-id", role: "ADMIN" } };
    next();
  },
  requireProjectAccess: (req: Request, res: Response, next: NextFunction) => {
    req.session = { user: { id: "test-owner-id", role: "ADMIN" } };
    next();
  },
}));

describe("Project Members Integration", () => {
  let projectId: string;
  let dbAvailable = false;
  const ownerId = "test-owner-id";
  const inviteEmail = "test-invitee-" + Date.now() + "@example.com";

  beforeAll(async () => {
    // Check if real DB is available (skip tests otherwise)
    try {
      await prisma.$connect();
      dbAvailable = true;
    } catch {
      console.warn(
        "Skipping project-members integration tests — no DB available",
      );
      return;
    }

    // Ensure owner exists
    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: {
        id: ownerId,
        name: "Test Owner",
        email: "owner@test.com",
        apsUserId: "owner123",
        role: "ADMIN",
      },
    });

    // Create Project
    const project = await prisma.project.create({
      data: {
        name: "Test Project Members",
        ownerId: ownerId,
        status: "ACTIVE",
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    try {
      if (!dbAvailable) return;

      // Clean up
      await prisma.projectMember.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } });

      const invited = await prisma.user.findUnique({
        where: { email: inviteEmail },
      });
      if (invited) {
        await prisma.projectMember.deleteMany({
          where: { userId: invited.id },
        });
        await prisma.user.delete({ where: { id: invited.id } });
      }

      await prisma.user.delete({ where: { id: ownerId } });
    } catch (e) {
      console.error("Cleanup failed", e);
    } finally {
      await redis.quit();
      await prisma.$disconnect();
    }
  });

  it("should invite a new user and trigger email", async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/project-members/${projectId}/members`)
      .send({
        email: inviteEmail,
        role: "VIEWER",
      });

    if (res.status !== 201) {
      console.error("Test Failed Response:", JSON.stringify(res.body, null, 2));
    }

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.member.user.email).toBe(inviteEmail);

    // Check if email was sent
    expect(emailService.sendInvitationEmail).toHaveBeenCalled();
    const callArgs = (emailService.sendInvitationEmail as jest.Mock).mock
      .calls[0];
    expect(callArgs[0]).toBe(inviteEmail); // To address
    expect(callArgs[3]).toBe("VIEWER"); // Role
  });

  it("should list members returning an array", async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(
      `/api/project-members/${projectId}/members`,
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1); // Owner + Invited

    const invitedMember = res.body.find(
      (m: MemberResponse) => m.user.email === inviteEmail,
    );
    expect(invitedMember).toBeDefined();
    expect(invitedMember.role).toBe("VIEWER");
  });
});
