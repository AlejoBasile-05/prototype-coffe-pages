/**
 * Acceso a datos del equipo (staff).
 *
 * ⚠️ Esta tabla NO tiene credenciales: la identidad vive en Supabase Auth.
 * Acá solo se autoriza (quién es del equipo y con qué rol).
 */
import "server-only";

import type { StaffRole } from "@prisma/client";

import { prisma } from "@/server/infra/prisma";

export interface StaffMemberRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: StaffRole;
  /** ISO 8601: el DTO no expone objetos `Date`. */
  readonly createdAt: string;
}

const STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

type StaffRecord = {
  id: string;
  email: string;
  name: string | null;
  role: StaffRole;
  createdAt: Date;
};

const toStaffMemberRecord = (member: StaffRecord): StaffMemberRecord => ({
  ...member,
  createdAt: member.createdAt.toISOString(),
});

export const findStaffById = async (id: string): Promise<StaffMemberRecord | null> => {
  const member: StaffRecord | null = await prisma.staffMember.findUnique({
    where: { id },
    select: STAFF_SELECT,
  });
  return member ? toStaffMemberRecord(member) : null;
};

/** La búsqueda es case-insensitive: los emails se persisten en minúsculas. */
export const findStaffByEmail = async (email: string): Promise<StaffMemberRecord | null> => {
  const member: StaffRecord | null = await prisma.staffMember.findUnique({
    where: { email: email.toLowerCase() },
    select: STAFF_SELECT,
  });
  return member ? toStaffMemberRecord(member) : null;
};

export const createStaffMember = async (input: {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: StaffRole;
}): Promise<StaffMemberRecord> => {
  const member: StaffRecord = await prisma.staffMember.create({
    data: { ...input, email: input.email.toLowerCase() },
    select: STAFF_SELECT,
  });
  return toStaffMemberRecord(member);
};
