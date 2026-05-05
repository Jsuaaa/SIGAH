import * as personsService from '../services/persons.service';
import { personView, personsView } from '../views/person.view';
import { asyncHandler } from '../utils/asyncHandler';

export const create = asyncHandler(async (req, res) => {
  const person = await personsService.create(req.body);
  res.status(201).json({ success: true, data: personView(person) });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const person = await personsService.update(id, req.body);
  res.json({ success: true, data: personView(person) });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await personsService.remove(id);
  res.status(204).send();
});

export const listByFamily = asyncHandler(async (req, res) => {
  const family_id = Number(req.params.id);
  const persons = await personsService.listByFamily(family_id);
  res.json({ success: true, data: personsView(persons) });
});

export const findByDocument = asyncHandler(async (req, res) => {
  const document = (req.query.document as string).trim();
  const result = await personsService.findByDocument(document);
  res.json({ success: true, data: result });
});
