import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Category,
  Condition,
  FIELD_LIMITS,
  InventoryItem,
  NewDistributionInput,
  NewDonationInput,
} from '../types';
import { SEED_DISTRIBUTIONS, SEED_DONATIONS, SEED_INVENTORY } from '../data/seedData';

function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}-${rand}`;
}

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export async function registerDonationCloud(
  ownerId: string,
  input: NewDonationInput,
  existingItems: InventoryItem[]
): Promise<void> {
  const itemName = clampString(input.itemName, FIELD_LIMITS.MAX_NAME_LEN);
  const donorName = clampString(input.donorName, FIELD_LIMITS.MAX_NAME_LEN);
  const location = clampString(input.location || 'Triagem Principal', FIELD_LIMITS.MAX_LOCATION_LEN);
  const notes = clampString(input.notes || '', FIELD_LIMITS.MAX_NOTES_LEN);
  const quantity = Math.max(1, Math.min(100000, Math.floor(input.quantity)));

  if (itemName.length < FIELD_LIMITS.MIN_NAME_LEN || donorName.length < FIELD_LIMITS.MIN_NAME_LEN) {
    throw new Error('Preencha o nome do item e do doador com pelo menos 2 caracteres.');
  }
  if (!FIELD_LIMITS.DATE_REGEX.test(input.receivedDate)) {
    throw new Error('Data de recebimento inválida.');
  }

  // Match existing inventory item if selected or exact name + category + condition match
  const matchedItem =
    existingItems.find((i) => i.id === input.existingInventoryId) ||
    existingItems.find(
      (i) =>
        i.name.toLowerCase() === itemName.toLowerCase() &&
        i.category === input.category &&
        i.condition === input.condition
    );

  const donationId = generateSafeId('don');
  const inventoryItemId = matchedItem ? matchedItem.id : generateSafeId('inv');

  try {
    await runTransaction(db, async (tx) => {
      const invRef = doc(db, 'inventory', inventoryItemId);
      const donRef = doc(db, 'donations', donationId);

      if (matchedItem) {
        const snap = await tx.get(invRef);
        if (!snap.exists()) {
          throw new Error('Item de estoque não encontrado.');
        }
        const current = snap.data();
        tx.update(invRef, {
          availableQty: (current.availableQty as number) + quantity,
          totalReceived: (current.totalReceived as number) + quantity,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(invRef, {
          id: inventoryItemId,
          ownerId,
          name: itemName,
          category: input.category,
          condition: input.condition,
          availableQty: quantity,
          totalReceived: quantity,
          totalDistributed: 0,
          location,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      tx.set(donRef, {
        id: donationId,
        ownerId,
        inventoryItemId,
        itemName: matchedItem ? matchedItem.name : itemName,
        category: matchedItem ? matchedItem.category : input.category,
        condition: matchedItem ? matchedItem.condition : input.condition,
        quantity,
        donorName,
        receivedDate: input.receivedDate,
        notes,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'donations');
  }
}

export async function registerDistributionCloud(
  ownerId: string,
  input: NewDistributionInput
): Promise<void> {
  const recipientName = clampString(input.recipientName, FIELD_LIMITS.MAX_NAME_LEN);
  const responsiblePerson = clampString(
    input.responsiblePerson,
    FIELD_LIMITS.MAX_RESPONSIBLE_LEN
  );
  const notes = clampString(input.notes || '', FIELD_LIMITS.MAX_NOTES_LEN);
  const quantity = Math.max(1, Math.min(100000, Math.floor(input.quantity)));

  if (
    recipientName.length < FIELD_LIMITS.MIN_NAME_LEN ||
    responsiblePerson.length < FIELD_LIMITS.MIN_NAME_LEN
  ) {
    throw new Error('Informe o beneficiário e o responsável pela entrega.');
  }
  if (!FIELD_LIMITS.DATE_REGEX.test(input.distributedDate)) {
    throw new Error('Data de distribuição inválida.');
  }

  const distributionId = generateSafeId('dist');

  try {
    await runTransaction(db, async (tx) => {
      const invRef = doc(db, 'inventory', input.inventoryItemId);
      const distRef = doc(db, 'distributions', distributionId);

      const snap = await tx.get(invRef);
      if (!snap.exists()) {
        throw new Error('Equipamento não encontrado no estoque.');
      }
      const inv = snap.data();
      const currentAvail = inv.availableQty as number;
      if (currentAvail < quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${currentAvail} unidade(s).`);
      }

      tx.update(invRef, {
        availableQty: currentAvail - quantity,
        totalDistributed: (inv.totalDistributed as number) + quantity,
        updatedAt: serverTimestamp(),
      });

      tx.set(distRef, {
        id: distributionId,
        ownerId,
        inventoryItemId: input.inventoryItemId,
        itemName: inv.name,
        category: inv.category,
        quantity,
        recipientName,
        recipientType: input.recipientType,
        responsiblePerson,
        distributedDate: input.distributedDate,
        notes,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Estoque insuficiente') ||
        error.message.includes('não encontrado'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, 'distributions');
  }
}

export async function updateInventoryDetailsCloud(
  itemId: string,
  updates: {
    name: string;
    category: Category;
    condition: Condition;
    location: string;
  }
): Promise<void> {
  const path = `inventory/${itemId}`;
  try {
    await updateDoc(doc(db, 'inventory', itemId), {
      name: clampString(updates.name, FIELD_LIMITS.MAX_NAME_LEN),
      category: updates.category,
      condition: updates.condition,
      location: clampString(updates.location || 'Triagem Principal', FIELD_LIMITS.MAX_LOCATION_LEN),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDonationCloud(donationId: string): Promise<void> {
  const path = `donations/${donationId}`;
  try {
    await deleteDoc(doc(db, 'donations', donationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleDataCloud(ownerId: string): Promise<void> {
  const userTag = ownerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'user';
  try {
    const batch = writeBatch(db);

    for (const item of SEED_INVENTORY) {
      const scopedId = `${item.id}-${userTag}`;
      const ref = doc(collection(db, 'inventory'), scopedId);
      batch.set(ref, {
        id: scopedId,
        ownerId,
        name: item.name,
        category: item.category,
        condition: item.condition,
        availableQty: item.availableQty,
        totalReceived: item.totalReceived,
        totalDistributed: item.totalDistributed,
        location: item.location,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const don of SEED_DONATIONS) {
      const scopedDonId = `${don.id}-${userTag}`;
      const scopedInvId = `${don.inventoryItemId}-${userTag}`;
      const ref = doc(collection(db, 'donations'), scopedDonId);
      batch.set(ref, {
        id: scopedDonId,
        ownerId,
        inventoryItemId: scopedInvId,
        itemName: don.itemName,
        category: don.category,
        condition: don.condition,
        quantity: don.quantity,
        donorName: don.donorName,
        receivedDate: don.receivedDate,
        notes: don.notes,
        createdAt: serverTimestamp(),
      });
    }

    for (const dist of SEED_DISTRIBUTIONS) {
      const scopedDistId = `${dist.id}-${userTag}`;
      const scopedInvId = `${dist.inventoryItemId}-${userTag}`;
      const ref = doc(collection(db, 'distributions'), scopedDistId);
      batch.set(ref, {
        id: scopedDistId,
        ownerId,
        inventoryItemId: scopedInvId,
        itemName: dist.itemName,
        category: dist.category,
        quantity: dist.quantity,
        recipientName: dist.recipientName,
        recipientType: dist.recipientType,
        responsiblePerson: dist.responsiblePerson,
        distributedDate: dist.distributedDate,
        notes: dist.notes,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed');
  }
}
