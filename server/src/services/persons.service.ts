import {
  PersonModel,
  type CreatePersonInput,
  type UpdatePersonInput,
} from '../models/person.model';
import type { Person, PersonWithFamily } from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreatePersonInput, UpdatePersonInput };

export async function create(input: CreatePersonInput): Promise<Person> {
  return PersonModel.create(input);
}

export async function update(id: number, input: UpdatePersonInput): Promise<Person> {
  return PersonModel.update(id, input);
}

export async function remove(id: number): Promise<void> {
  await PersonModel.remove(id);
}

export async function listByFamily(family_id: number): Promise<Person[]> {
  return PersonModel.listByFamily(family_id);
}

export async function findByDocument(document: string): Promise<PersonWithFamily> {
  const result = await PersonModel.findByDocument(document);
  if (!result) {
    throw new AppError('Person not found', 404);
  }
  return result;
}
