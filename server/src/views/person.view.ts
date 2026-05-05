import type { Person } from '../types/entities';

export function personView(person: Person): Person {
  return person;
}

export function personsView(persons: Person[]): Person[] {
  return persons.map(personView);
}
