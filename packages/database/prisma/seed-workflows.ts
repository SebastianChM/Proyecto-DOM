/**
 * Workflow Seed Script
 *
 * Creates default workflow templates for PROJECT and FILE entities
 * Run with: npx ts-node prisma/seed-workflows.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedWorkflows() {
  console.log("🌱 Seeding workflow templates...");

  // ============================================
  // PROJECT WORKFLOW TEMPLATE
  // ============================================

  const projectTemplate = await prisma.workflowTemplate.upsert({
    where: { code: "PROJECT_DELIVERY" },
    update: {},
    create: {
      name: "Project Delivery",
      code: "PROJECT_DELIVERY",
      description: "Standard workflow for BIM project delivery lifecycle",
      entityType: "PROJECT",
      isDefault: true,
      isSystem: true,
      version: 1,
    },
  });

  console.log("  ✅ Created PROJECT_DELIVERY template");

  // Project States
  const projectStates = await Promise.all([
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: projectTemplate.id, name: "DRAFT" },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        name: "DRAFT",
        displayName: "Draft",
        description: "Project is being set up",
        color: "#6B7280",
        icon: "file-edit",
        order: 0,
        isInitial: true,
        isFinal: false,
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: {
          templateId: projectTemplate.id,
          name: "IN_PROGRESS",
        },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        name: "IN_PROGRESS",
        displayName: "In Progress",
        description: "Active development and file uploads",
        color: "#3B82F6",
        icon: "loader",
        order: 1,
        isInitial: false,
        isFinal: false,
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: projectTemplate.id, name: "IN_REVIEW" },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        name: "IN_REVIEW",
        displayName: "In Review",
        description: "Pending review and approval",
        color: "#F59E0B",
        icon: "eye",
        order: 2,
        isInitial: false,
        isFinal: false,
        requiredRole: "EDITOR",
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: projectTemplate.id, name: "APPROVED" },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        name: "APPROVED",
        displayName: "Approved",
        description: "Project approved and ready for delivery",
        color: "#10B981",
        icon: "check-circle",
        order: 3,
        isInitial: false,
        isFinal: false,
        requiredRole: "OWNER",
        onEnterActions: JSON.stringify([
          { type: "notify", target: "owner", template: "project_approved" },
        ]),
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: projectTemplate.id, name: "DELIVERED" },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        name: "DELIVERED",
        displayName: "Delivered",
        description: "Project has been delivered to client",
        color: "#8B5CF6",
        icon: "package-check",
        order: 4,
        isInitial: false,
        isFinal: true,
        requiredRole: "OWNER",
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: projectTemplate.id, name: "RETURNED" },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        name: "RETURNED",
        displayName: "Returned for Revision",
        description: "Changes requested, needs more work",
        color: "#EF4444",
        icon: "rotate-ccw",
        order: 5,
        isInitial: false,
        isFinal: false,
      },
    }),
  ]);

  const stateMap = Object.fromEntries(projectStates.map((s) => [s.name, s]));

  // Project Transitions
  await Promise.all([
    // DRAFT -> IN_PROGRESS
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: projectTemplate.id,
          fromStateId: stateMap.DRAFT.id,
          toStateId: stateMap.IN_PROGRESS.id,
        },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        fromStateId: stateMap.DRAFT.id,
        toStateId: stateMap.IN_PROGRESS.id,
        name: "start_work",
        displayName: "Start Work",
        description: "Begin active development",
        icon: "play",
        buttonVariant: "default",
        requiredRole: "EDITOR",
      },
    }),
    // IN_PROGRESS -> IN_REVIEW
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: projectTemplate.id,
          fromStateId: stateMap.IN_PROGRESS.id,
          toStateId: stateMap.IN_REVIEW.id,
        },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        fromStateId: stateMap.IN_PROGRESS.id,
        toStateId: stateMap.IN_REVIEW.id,
        name: "submit_for_review",
        displayName: "Submit for Review",
        description: "Send project for approval",
        icon: "send",
        buttonVariant: "default",
        requiredRole: "EDITOR",
        conditions: JSON.stringify([{ type: "hasFiles" }]),
        actions: JSON.stringify([
          { type: "notify", target: "owner", template: "review_requested" },
        ]),
      },
    }),
    // IN_REVIEW -> APPROVED
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: projectTemplate.id,
          fromStateId: stateMap.IN_REVIEW.id,
          toStateId: stateMap.APPROVED.id,
        },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        fromStateId: stateMap.IN_REVIEW.id,
        toStateId: stateMap.APPROVED.id,
        name: "approve",
        displayName: "Approve",
        description: "Approve the project",
        icon: "check",
        buttonVariant: "default",
        requiredRole: "OWNER",
        requireConfirmation: true,
        confirmationMessage: "Are you sure you want to approve this project?",
      },
    }),
    // IN_REVIEW -> RETURNED
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: projectTemplate.id,
          fromStateId: stateMap.IN_REVIEW.id,
          toStateId: stateMap.RETURNED.id,
        },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        fromStateId: stateMap.IN_REVIEW.id,
        toStateId: stateMap.RETURNED.id,
        name: "request_changes",
        displayName: "Request Changes",
        description: "Return project for revisions",
        icon: "rotate-ccw",
        buttonVariant: "destructive",
        requiredRole: "OWNER",
        requireComment: true,
        actions: JSON.stringify([
          {
            type: "notify",
            target: "performer",
            template: "changes_requested",
          },
        ]),
      },
    }),
    // RETURNED -> IN_PROGRESS
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: projectTemplate.id,
          fromStateId: stateMap.RETURNED.id,
          toStateId: stateMap.IN_PROGRESS.id,
        },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        fromStateId: stateMap.RETURNED.id,
        toStateId: stateMap.IN_PROGRESS.id,
        name: "resume_work",
        displayName: "Resume Work",
        description: "Continue working on revisions",
        icon: "play",
        buttonVariant: "default",
        requiredRole: "EDITOR",
      },
    }),
    // APPROVED -> DELIVERED
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: projectTemplate.id,
          fromStateId: stateMap.APPROVED.id,
          toStateId: stateMap.DELIVERED.id,
        },
      },
      update: {},
      create: {
        templateId: projectTemplate.id,
        fromStateId: stateMap.APPROVED.id,
        toStateId: stateMap.DELIVERED.id,
        name: "deliver",
        displayName: "Mark as Delivered",
        description: "Complete project delivery",
        icon: "package-check",
        buttonVariant: "default",
        requiredRole: "OWNER",
        requireConfirmation: true,
        confirmationMessage:
          "Mark this project as delivered? This action is final.",
      },
    }),
  ]);

  console.log("  ✅ Created PROJECT transitions");

  // ============================================
  // FILE WORKFLOW TEMPLATE
  // ============================================

  const fileTemplate = await prisma.workflowTemplate.upsert({
    where: { code: "FILE_REVIEW" },
    update: {},
    create: {
      name: "File Review",
      code: "FILE_REVIEW",
      description: "Standard workflow for BIM file lifecycle and review",
      entityType: "FILE",
      isDefault: true,
      isSystem: true,
      version: 1,
    },
  });

  console.log("  ✅ Created FILE_REVIEW template");

  // File States
  const fileStates = await Promise.all([
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: fileTemplate.id, name: "UPLOADED" },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        name: "UPLOADED",
        displayName: "Uploaded",
        description: "File has been uploaded",
        color: "#6B7280",
        icon: "upload",
        order: 0,
        isInitial: true,
        isFinal: false,
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: fileTemplate.id, name: "PROCESSING" },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        name: "PROCESSING",
        displayName: "Processing",
        description: "File is being processed/translated",
        color: "#3B82F6",
        icon: "loader",
        order: 1,
        isInitial: false,
        isFinal: false,
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: fileTemplate.id, name: "READY" },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        name: "READY",
        displayName: "Ready",
        description: "File is ready for review",
        color: "#10B981",
        icon: "check-circle",
        order: 2,
        isInitial: false,
        isFinal: false,
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: fileTemplate.id, name: "IN_REVIEW" },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        name: "IN_REVIEW",
        displayName: "In Review",
        description: "File is being reviewed",
        color: "#F59E0B",
        icon: "eye",
        order: 3,
        isInitial: false,
        isFinal: false,
        requiredRole: "EDITOR",
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: { templateId: fileTemplate.id, name: "APPROVED" },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        name: "APPROVED",
        displayName: "Approved",
        description: "File has been approved",
        color: "#8B5CF6",
        icon: "badge-check",
        order: 4,
        isInitial: false,
        isFinal: true,
      },
    }),
    prisma.workflowState.upsert({
      where: {
        templateId_name: {
          templateId: fileTemplate.id,
          name: "NEEDS_REVISION",
        },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        name: "NEEDS_REVISION",
        displayName: "Needs Revision",
        description: "File requires changes",
        color: "#EF4444",
        icon: "alert-triangle",
        order: 5,
        isInitial: false,
        isFinal: false,
      },
    }),
  ]);

  const fileStateMap = Object.fromEntries(fileStates.map((s) => [s.name, s]));

  // File Transitions
  await Promise.all([
    // UPLOADED -> PROCESSING (auto by system)
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: fileTemplate.id,
          fromStateId: fileStateMap.UPLOADED.id,
          toStateId: fileStateMap.PROCESSING.id,
        },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        fromStateId: fileStateMap.UPLOADED.id,
        toStateId: fileStateMap.PROCESSING.id,
        name: "start_processing",
        displayName: "Start Processing",
        icon: "loader",
        buttonVariant: "outline",
      },
    }),
    // PROCESSING -> READY
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: fileTemplate.id,
          fromStateId: fileStateMap.PROCESSING.id,
          toStateId: fileStateMap.READY.id,
        },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        fromStateId: fileStateMap.PROCESSING.id,
        toStateId: fileStateMap.READY.id,
        name: "mark_ready",
        displayName: "Mark Ready",
        icon: "check",
        buttonVariant: "default",
      },
    }),
    // READY -> IN_REVIEW
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: fileTemplate.id,
          fromStateId: fileStateMap.READY.id,
          toStateId: fileStateMap.IN_REVIEW.id,
        },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        fromStateId: fileStateMap.READY.id,
        toStateId: fileStateMap.IN_REVIEW.id,
        name: "submit_for_review",
        displayName: "Submit for Review",
        icon: "send",
        buttonVariant: "default",
        requiredRole: "EDITOR",
      },
    }),
    // IN_REVIEW -> APPROVED
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: fileTemplate.id,
          fromStateId: fileStateMap.IN_REVIEW.id,
          toStateId: fileStateMap.APPROVED.id,
        },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        fromStateId: fileStateMap.IN_REVIEW.id,
        toStateId: fileStateMap.APPROVED.id,
        name: "approve",
        displayName: "Approve",
        icon: "check",
        buttonVariant: "default",
        requiredRole: "OWNER",
      },
    }),
    // IN_REVIEW -> NEEDS_REVISION
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: fileTemplate.id,
          fromStateId: fileStateMap.IN_REVIEW.id,
          toStateId: fileStateMap.NEEDS_REVISION.id,
        },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        fromStateId: fileStateMap.IN_REVIEW.id,
        toStateId: fileStateMap.NEEDS_REVISION.id,
        name: "request_revision",
        displayName: "Request Revision",
        icon: "alert-triangle",
        buttonVariant: "destructive",
        requiredRole: "OWNER",
        requireComment: true,
      },
    }),
    // NEEDS_REVISION -> READY (after fix)
    prisma.workflowTransition.upsert({
      where: {
        templateId_fromStateId_toStateId: {
          templateId: fileTemplate.id,
          fromStateId: fileStateMap.NEEDS_REVISION.id,
          toStateId: fileStateMap.READY.id,
        },
      },
      update: {},
      create: {
        templateId: fileTemplate.id,
        fromStateId: fileStateMap.NEEDS_REVISION.id,
        toStateId: fileStateMap.READY.id,
        name: "resubmit",
        displayName: "Resubmit",
        description: "Submit revised file",
        icon: "refresh-cw",
        buttonVariant: "default",
        requiredRole: "EDITOR",
      },
    }),
  ]);

  console.log("  ✅ Created FILE transitions");

  console.log("✅ Workflow seeding complete!");
}

seedWorkflows()
  .catch((e) => {
    console.error("❌ Error seeding workflows:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
