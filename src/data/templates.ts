import { CycleTemplateId } from '../types/workout';

export type TemplateCard = {
  id: CycleTemplateId;
  name: string;
  description: string;
  tags: string[];
  idealDays: number[];  // e.g., [3, 4, 5] means works best with 3-5 days/week
};

export const TEMPLATES: TemplateCard[] = [
  {
    id: 'full_body',
    name: 'Full Body',
    description: 'Beginner-friendly, Time-efficient',
    tags: ['Beginner-friendly', 'Time-efficient', 'Balanced'],
    idealDays: [2, 3, 4],
  },
  {
    id: 'upper_lower',
    name: 'Upper/Lower Split',
    description: 'Classic, Balanced',
    tags: ['Intermediate', 'Balanced', 'Recovery-friendly'],
    idealDays: [3, 4, 5],
  },
  {
    id: 'ppl',
    name: 'Push/Pull/Legs',
    description: 'Hypertrophy, Popular',
    tags: ['Hypertrophy', 'Volume', 'Intermediate'],
    idealDays: [3, 4, 5, 6],
  },
  {
    id: 'bro_split',
    name: 'Bro Split',
    description: 'Bodybuilding, Volume',
    tags: ['Bodybuilding', 'Volume', 'Advanced'],
    idealDays: [4, 5, 6],
  },
  {
    id: 'strength_531',
    name: 'Strength Focus (5/3/1-inspired)',
    description: 'Progressive Overload',
    tags: ['Strength', 'Powerlifting', 'Progressive'],
    idealDays: [3, 4],
  },
  {
    id: 'powerbuilding',
    name: 'Powerbuilding',
    description: 'Strength, Hypertrophy',
    tags: ['Strength', 'Hypertrophy', 'Advanced'],
    idealDays: [4, 5],
  },
  {
    id: 'hybrid',
    name: 'Hybrid Athlete',
    description: 'Strength, Conditioning',
    tags: ['Conditioning', 'Strength', 'Athletic'],
    idealDays: [3, 4, 5],
  },
  {
    id: 'custom',
    name: 'Create Your Own',
    description: 'Paste your own workout plan or build from scratch.',
    tags: ['Custom', 'Flexible'],
    idealDays: [1, 2, 3, 4, 5, 6, 7],
  },
];

export function getTemplates(): TemplateCard[] {
  return TEMPLATES;
}

export function getTemplateById(id: CycleTemplateId): TemplateCard | undefined {
  return TEMPLATES.find(t => t.id === id);
}

