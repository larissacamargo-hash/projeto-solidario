export const CATEGORIES = [
  'Notebooks & PCs',
  'Periféricos',
  'Smartphones & Tablets',
  'Redes & Cabos',
  'Componentes & Peças',
  'Outros',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CONDITIONS = [
  'Novo',
  'Revisado / Funcional',
  'Para Reparo',
] as const;

export type Condition = (typeof CONDITIONS)[number];

export const RECIPIENT_TYPES = [
  'Estudante',
  'Escola Pública',
  'ONG / Projeto Social',
  'Família',
] as const;

export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export type AppView =
  | 'dashboard'
  | 'donations'
  | 'inventory'
  | 'distributions';

export const FIELD_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  MAX_ID_LEN: 128,
  MIN_NAME_LEN: 2,
  MAX_NAME_LEN: 120,
  MAX_LOCATION_LEN: 80,
  MAX_RESPONSIBLE_LEN: 100,
  MAX_NOTES_LEN: 500,
} as const;

export interface InventoryItem {
  id: string;
  ownerId: string;
  name: string;
  category: Category;
  condition: Condition;
  availableQty: number;
  totalReceived: number;
  totalDistributed: number;
  location: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface Donation {
  id: string;
  ownerId: string;
  inventoryItemId: string;
  itemName: string;
  category: Category;
  condition: Condition;
  quantity: number;
  donorName: string;
  receivedDate: string;
  notes: string;
  createdAtMs: number;
}

export interface Distribution {
  id: string;
  ownerId: string;
  inventoryItemId: string;
  itemName: string;
  category: Category;
  quantity: number;
  recipientName: string;
  recipientType: RecipientType;
  responsiblePerson: string;
  distributedDate: string;
  notes: string;
  createdAtMs: number;
}

export interface NewDonationInput {
  itemName: string;
  category: Category;
  condition: Condition;
  quantity: number;
  donorName: string;
  receivedDate: string;
  location: string;
  notes: string;
  existingInventoryId?: string;
}

export interface NewDistributionInput {
  inventoryItemId: string;
  quantity: number;
  recipientName: string;
  recipientType: RecipientType;
  responsiblePerson: string;
  distributedDate: string;
  notes: string;
}
