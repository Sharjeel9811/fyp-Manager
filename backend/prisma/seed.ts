import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create departments
  const csDept = await prisma.department.create({
    data: {
      name: 'Computer Science',
      code: 'CS',
    },
  });

  const seDept = await prisma.department.create({
    data: {
      name: 'Software Engineering',
      code: 'SE',
    },
  });

  // Create academic session
  const session = await prisma.academicSession.create({
    data: {
      name: 'Fall 2024',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-06-30'),
      isActive: true,
    },
  });

  // Create admin
  const adminPassword = await argon2.hash('password123');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@fypmanager.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
    },
  });

  // Create supervisor
  const supervisorPassword = await argon2.hash('password123');
  const supervisorUser = await prisma.user.create({
    data: {
      email: 'supervisor@fypmanager.com',
      passwordHash: supervisorPassword,
      role: 'SUPERVISOR',
      firstName: 'John',
      lastName: 'Smith',
      emailVerified: true,
    },
  });

  const supervisor = await prisma.supervisorProfile.create({
    data: {
      userId: supervisorUser.id,
      employeeId: 'SUP-001',
      departmentId: csDept.id,
      researchInterests: 'AI, Machine Learning, Web Development',
      availability: true,
      maxSupervisees: 5,
    },
  });

  // Create student
  const studentPassword = await argon2.hash('password123');
  const studentUser = await prisma.user.create({
    data: {
      email: 'student@fypmanager.com',
      passwordHash: studentPassword,
      role: 'STUDENT',
      firstName: 'Alice',
      lastName: 'Johnson',
      emailVerified: true,
    },
  });

  const student = await prisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      studentId: 'STU-001',
      departmentId: csDept.id,
      phone: '+1234567890',
    },
  });

  // Create project
  const project = await prisma.project.create({
    data: {
      title: 'AI-Powered Chatbot for University Help Desk',
      status: 'IN_PROGRESS',
      departmentId: csDept.id,
      academicSessionId: session.id,
    },
  });

  // Create proposal
  await prisma.proposal.create({
    data: {
      projectId: project.id,
      title: 'AI-Powered Chatbot for University Help Desk',
      abstract: 'This project aims to develop an intelligent chatbot system to handle student inquiries.',
      problemStatement: 'Current help desk system is overwhelmed with repetitive queries.',
      objectives: '1. Develop NLP-based chatbot\n2. Integrate with knowledge base\n3. Provide 24/7 support',
      methodology: 'Agile development with NLP using TensorFlow',
      technologyStack: 'React, Node.js, Python, TensorFlow, PostgreSQL',
      expectedOutcomes: 'A functional chatbot that can answer 80% of common queries',
      status: 'PROPOSAL_APPROVED',
      submittedAt: new Date('2024-10-01'),
      reviewedAt: new Date('2024-10-15'),
    },
  });

  // Assign supervisor
  await prisma.supervisorAssignment.create({
    data: {
      projectId: project.id,
      supervisorId: supervisor.id,
    },
  });

  // Add student to project
  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      studentId: student.id,
    },
  });

  // Create milestones
  await prisma.milestone.create({
    data: {
      projectId: project.id,
      title: 'Literature Review',
      description: 'Complete literature review and analysis',
      startDate: new Date('2024-10-01'),
      dueDate: new Date('2024-11-01'),
      status: 'COMPLETED',
      completionPercentage: 100,
    },
  });

  await prisma.milestone.create({
    data: {
      projectId: project.id,
      title: 'System Design',
      description: 'Create system architecture and design documents',
      startDate: new Date('2024-11-01'),
      dueDate: new Date('2024-12-01'),
      status: 'IN_PROGRESS',
      completionPercentage: 60,
    },
  });

  await prisma.milestone.create({
    data: {
      projectId: project.id,
      title: 'Implementation',
      description: 'Develop the chatbot system',
      startDate: new Date('2025-01-01'),
      dueDate: new Date('2025-03-01'),
      status: 'NOT_STARTED',
      completionPercentage: 0,
    },
  });

  // Create evaluation rubric
  const rubric = await prisma.evaluationRubric.create({
    data: {
      name: 'Standard FYP Evaluation Rubric',
      description: 'Standard evaluation criteria for final year projects',
      isActive: true,
      totalWeight: 100,
    },
  });

  await prisma.rubricCriterion.createMany({
    data: [
      { rubricId: rubric.id, name: 'Problem Definition', description: 'Clarity of problem statement', maxScore: 10, weight: 10, order: 1 },
      { rubricId: rubric.id, name: 'Technical Implementation', description: 'Quality of implementation', maxScore: 30, weight: 30, order: 2 },
      { rubricId: rubric.id, name: 'Innovation', description: 'Originality and creativity', maxScore: 20, weight: 20, order: 3 },
      { rubricId: rubric.id, name: 'Documentation', description: 'Report quality', maxScore: 20, weight: 20, order: 4 },
      { rubricId: rubric.id, name: 'Presentation', description: 'Presentation skills', maxScore: 20, weight: 20, order: 5 },
    ],
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.();
  });
