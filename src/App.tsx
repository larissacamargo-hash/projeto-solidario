import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  ArrowRightLeft,
  Database,
  FileText,
  Laptop,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from './firebase';
import {
  SEED_DISTRIBUTIONS,
  SEED_DONATIONS,
  SEED_INVENTORY,
} from './data/seedData';
import {
  deleteDonationCloud,
  registerDistributionCloud,
  registerDonationCloud,
  seedSampleDataCloud,
  updateInventoryDetailsCloud,
} from './services/firestoreService';
import {
  AppView,
  Category,
  Condition,
  Distribution,
  Donation,
  InventoryItem,
  NewDistributionInput,
  NewDonationInput,
} from './types';
import { ChartsSection } from './components/ChartsSection';
import { DonationsView } from './components/DonationsView';
import { InventoryView } from './components/InventoryView';
import { DistributionsView } from './components/DistributionsView';
import { formatProtocolCode, ReceiptDocument, ReceiptModal } from './components/ReceiptModal';

const WORKSHOP_PHOTO_URL = '/src/assets/images/hero_solidario_workshop_1794912740240.jpg';
const COORDINATOR_AVATAR_URL = '/src/assets/images/coordenacao_avatar_1794912741328.jpg';

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Painel de Gerenciamento de Doações',
  donations: 'Cadastro e Histórico de Doações',
  inventory: 'Controle de Itens Disponíveis',
  distributions: 'Registro de Distribuição',
};

const VIEW_SUBTITLES: Record<AppView, string> = {
  dashboard:
    'Acompanhamento consolidado de entradas, triagem técnica, entregas e indicadores de impacto.',
  donations:
    'Registre novas doações recebidas, emita comprovantes e atualize automaticamente o estoque.',
  inventory:
    'Visualize lotes disponíveis, bancadas de armazenamento, giro de estoque e prontidão técnica.',
  distributions:
    'Formalize a saída de equipamentos e emita termos de cessão para estudantes, escolas e ONGs.',
};

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Image fallback states
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  // Printable Receipt / Term Modal
  const [activeReceipt, setActiveReceipt] = useState<ReceiptDocument | null>(null);

  // Auth & Cloud sync state
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [seedingCloud, setSeedingCloud] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Cloud state
  const [cloudInventory, setCloudInventory] = useState<InventoryItem[]>([]);
  const [cloudDonations, setCloudDonations] = useState<Donation[]>([]);
  const [cloudDistributions, setCloudDistributions] = useState<Distribution[]>([]);

  // Local demonstration state (used before Google login)
  const [localInventory, setLocalInventory] = useState<InventoryItem[]>(SEED_INVENTORY);
  const [localDonations, setLocalDonations] = useState<Donation[]>(SEED_DONATIONS);
  const [localDistributions, setLocalDistributions] =
    useState<Distribution[]>(SEED_DISTRIBUTIONS);

  // Navigation context
  const [preselectedDistItemId, setPreselectedDistItemId] = useState<string | null>(null);
  const [donationCatFilter, setDonationCatFilter] = useState<Category | 'Todas'>('Todas');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setCloudInventory([]);
      setCloudDonations([]);
      setCloudDistributions([]);
      setLoadingCloud(false);
      return;
    }

    setLoadingCloud(true);
    let loadedInv = false;
    let loadedDon = false;
    let loadedDist = false;

    const markLoaded = () => {
      if (loadedInv && loadedDon && loadedDist) {
        setLoadingCloud(false);
      }
    };

    const invQuery = query(collection(db, 'inventory'), where('ownerId', '==', user.uid));
    const donQuery = query(collection(db, 'donations'), where('ownerId', '==', user.uid));
    const distQuery = query(collection(db, 'distributions'), where('ownerId', '==', user.uid));

    const unsubInv = onSnapshot(
      invQuery,
      (snap) => {
        setCloudInventory(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id,
              ownerId: data.ownerId,
              name: data.name,
              category: data.category,
              condition: data.condition,
              availableQty: Number(data.availableQty || 0),
              totalReceived: Number(data.totalReceived || 0),
              totalDistributed: Number(data.totalDistributed || 0),
              location: data.location || 'Triagem Principal',
              createdAtMs: toMillis(data.createdAt),
              updatedAtMs: toMillis(data.updatedAt),
            };
          })
        );
        loadedInv = true;
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'inventory')
    );

    const unsubDon = onSnapshot(
      donQuery,
      (snap) => {
        setCloudDonations(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id,
              ownerId: data.ownerId,
              inventoryItemId: data.inventoryItemId,
              itemName: data.itemName,
              category: data.category,
              condition: data.condition,
              quantity: Number(data.quantity || 0),
              donorName: data.donorName,
              receivedDate: data.receivedDate,
              notes: data.notes || '',
              createdAtMs: toMillis(data.createdAt),
            };
          })
        );
        loadedDon = true;
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'donations')
    );

    const unsubDist = onSnapshot(
      distQuery,
      (snap) => {
        setCloudDistributions(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id,
              ownerId: data.ownerId,
              inventoryItemId: data.inventoryItemId,
              itemName: data.itemName,
              category: data.category,
              quantity: Number(data.quantity || 0),
              recipientName: data.recipientName,
              recipientType: data.recipientType,
              responsiblePerson: data.responsiblePerson,
              distributedDate: data.distributedDate,
              notes: data.notes || '',
              createdAtMs: toMillis(data.createdAt),
            };
          })
        );
        loadedDist = true;
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'distributions')
    );

    return () => {
      unsubInv();
      unsubDon();
      unsubDist();
    };
  }, [authReady, user]);

  const inventory = user ? cloudInventory : localInventory;
  const donations = user ? cloudDonations : localDonations;
  const distributions = user ? cloudDistributions : localDistributions;

  const metrics = useMemo(() => {
    const totalReceived = inventory.reduce((acc, i) => acc + i.totalReceived, 0);
    const totalAvailable = inventory.reduce((acc, i) => acc + i.availableQty, 0);
    const totalDistributed = inventory.reduce((acc, i) => acc + i.totalDistributed, 0);
    const repairCount = inventory
      .filter((i) => i.condition === 'Para Reparo')
      .reduce((acc, i) => acc + i.availableQty, 0);
    const readyCount = totalAvailable - repairCount;
    const transferRate =
      totalReceived > 0 ? Math.round((totalDistributed / totalReceived) * 100) : 0;
    const avgPerDonation =
      donations.length > 0 ? (totalReceived / donations.length).toFixed(1) : '0.0';
    const uniqueRecipients = new Set(distributions.map((d) => d.recipientName.trim().toLowerCase()))
      .size;

    return {
      totalReceived,
      totalAvailable,
      totalDistributed,
      repairCount,
      readyCount,
      transferRate,
      avgPerDonation,
      uniqueRecipients,
    };
  }, [inventory, donations.length, distributions]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Não foi possível concluir o login com Google.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleRegisterDonation = async (input: NewDonationInput) => {
    if (user) {
      await registerDonationCloud(user.uid, input, cloudInventory);
      return;
    }

    const now = Date.now();
    const matched =
      localInventory.find((i) => i.id === input.existingInventoryId) ||
      localInventory.find(
        (i) =>
          i.name.toLowerCase() === input.itemName.toLowerCase() &&
          i.category === input.category &&
          i.condition === input.condition
      );

    const invId = matched ? matched.id : `inv-${now}`;
    if (matched) {
      setLocalInventory((prev) =>
        prev.map((item) =>
          item.id === matched.id
            ? {
                ...item,
                availableQty: item.availableQty + input.quantity,
                totalReceived: item.totalReceived + input.quantity,
                updatedAtMs: now,
              }
            : item
        )
      );
    } else {
      setLocalInventory((prev) => [
        {
          id: invId,
          ownerId: 'demo-local',
          name: input.itemName,
          category: input.category,
          condition: input.condition,
          availableQty: input.quantity,
          totalReceived: input.quantity,
          totalDistributed: 0,
          location: input.location || 'Triagem Principal',
          createdAtMs: now,
          updatedAtMs: now,
        },
        ...prev,
      ]);
    }

    setLocalDonations((prev) => [
      {
        id: `don-${now}`,
        ownerId: 'demo-local',
        inventoryItemId: invId,
        itemName: matched ? matched.name : input.itemName,
        category: matched ? matched.category : input.category,
        condition: matched ? matched.condition : input.condition,
        quantity: input.quantity,
        donorName: input.donorName,
        receivedDate: input.receivedDate,
        notes: input.notes,
        createdAtMs: now,
      },
      ...prev,
    ]);
  };

  const handleDeleteDonation = async (donationId: string) => {
    if (user) {
      await deleteDonationCloud(donationId);
      return;
    }
    setLocalDonations((prev) => prev.filter((d) => d.id !== donationId));
  };

  const handleRegisterDistribution = async (input: NewDistributionInput) => {
    if (user) {
      await registerDistributionCloud(user.uid, input);
      return;
    }

    const now = Date.now();
    const target = localInventory.find((i) => i.id === input.inventoryItemId);
    if (!target) throw new Error('Equipamento não encontrado no estoque.');
    if (target.availableQty < input.quantity) {
      throw new Error(`Estoque insuficiente. Disponível: ${target.availableQty}.`);
    }

    setLocalInventory((prev) =>
      prev.map((item) =>
        item.id === target.id
          ? {
              ...item,
              availableQty: item.availableQty - input.quantity,
              totalDistributed: item.totalDistributed + input.quantity,
              updatedAtMs: now,
            }
          : item
      )
    );

    setLocalDistributions((prev) => [
      {
        id: `dist-${now}`,
        ownerId: 'demo-local',
        inventoryItemId: target.id,
        itemName: target.name,
        category: target.category,
        quantity: input.quantity,
        recipientName: input.recipientName,
        recipientType: input.recipientType,
        responsiblePerson: input.responsiblePerson,
        distributedDate: input.distributedDate,
        notes: input.notes,
        createdAtMs: now,
      },
      ...prev,
    ]);
  };

  const handleUpdateInventoryDetails = async (
    itemId: string,
    updates: { name: string; category: Category; condition: Condition; location: string }
  ) => {
    if (user) {
      await updateInventoryDetailsCloud(itemId, updates);
      return;
    }
    setLocalInventory((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              condition: updates.condition,
              location: updates.location || item.location,
              updatedAtMs: Date.now(),
            }
          : item
      )
    );
  };

  const handleSeedCloud = async () => {
    if (!user) return;
    setSeedingCloud(true);
    try {
      await seedSampleDataCloud(user.uid);
    } finally {
      setSeedingCloud(false);
    }
  };

  const navigateTo = (view: AppView, keepFilter = false) => {
    if (view === 'donations' && !keepFilter) {
      setDonationCatFilter('Todas');
    }
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const navItems: { id: AppView; label: string }[] = [
    { id: 'dashboard', label: 'Visão Geral' },
    { id: 'donations', label: 'Doações' },
    { id: 'inventory', label: 'Estoque' },
    { id: 'distributions', label: 'Distribuição' },
  ];

  const recentDonations = useMemo(
    () =>
      [...donations]
        .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate) || b.createdAtMs - a.createdAtMs)
        .slice(0, 5),
    [donations]
  );

  const recentDistributions = useMemo(
    () =>
      [...distributions]
        .sort(
          (a, b) =>
            b.distributedDate.localeCompare(a.distributedDate) || b.createdAtMs - a.createdAtMs
        )
        .slice(0, 5),
    [distributions]
  );

  const isEmptyCloud = Boolean(
    user && !loadingCloud && inventory.length === 0 && donations.length === 0
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      {/* Top Bar Contract: [Brand title, one line] — [4-5 single-line nav links] — [1 primary action] */}
      <header className="sticky top-0 z-40 h-16 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1360px] mx-auto h-full px-4 sm:px-8 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Solidário Tech
          </button>

          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`relative py-5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('donations')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Doação
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir navegação"
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* Workspace Control & Coordinator Strip */}
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 shrink-0 hidden sm:flex items-center justify-center">
              {!avatarImgFailed ? (
                <img
                  src={COORDINATOR_AVATAR_URL}
                  alt="Coordenação Projeto Solidário Tech"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-sm font-bold text-slate-700 dark:text-slate-200">
                  ST
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {VIEW_TITLES[activeView]}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                {VIEW_SUBTITLES[activeView]}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Modo Claro
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  Modo Escuro
                </>
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg pl-3 pr-1.5 py-1">
                <span className="text-xs text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Salvar na Nuvem (Google)
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm px-4 py-3 rounded-xl">
            {authError}
          </div>
        )}

        {loadingCloud ? (
          <div className="space-y-6">
            <div className="h-28 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
            <div className="h-72 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
          </div>
        ) : isEmptyCloud && activeView === 'dashboard' ? (
          <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8">
            <Database className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Sua base em nuvem está pronta
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Ainda não há doações cadastradas na sua conta. Comece cadastrando o primeiro equipamento ou carregue um conjunto de exemplos para testar os gráficos.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => navigateTo('donations')}
                className="px-4 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Cadastrar Primeira Doação
              </button>
              <button
                type="button"
                disabled={seedingCloud}
                onClick={handleSeedCloud}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {seedingCloud ? 'Carregando exemplos...' : 'Carregar Dados de Exemplo'}
              </button>
            </div>
          </section>
        ) : (
          <>
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                {/* Editorial Workshop Showcase (2-Column Balanced Split) */}
                <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Centro de Recondicionamento Digital · Operação Ativa
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Triagem técnica e entrega transparente de equipamentos para inclusão digital
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                        Cada equipamento recebido passa por conferência, limpeza e revisão de sistema antes de ser liberado no estoque e destinado a escolas públicas, ONGs e estudantes.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-6 text-xs">
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">Prontos p/ entrega</div>
                          <div className="font-mono text-base font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                            {metrics.readyCount} un.
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">Bancada de reparo</div>
                          <div className="font-mono text-base font-semibold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
                            {metrics.repairCount} un.
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">Taxa de repasse</div>
                          <div className="font-mono text-base font-semibold text-sky-700 dark:text-sky-400 tabular-nums mt-0.5">
                            {metrics.transferRate}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => navigateTo('distributions')}
                          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          Registrar Entrega
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 relative min-h-[220px] bg-slate-900 overflow-hidden">
                    {!heroImgFailed ? (
                      <img
                        src={WORKSHOP_PHOTO_URL}
                        alt="Voluntários testando e preparando notebooks doados na oficina do Projeto Solidário Tech"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-800 to-slate-950 text-slate-300">
                        <Laptop className="w-8 h-8 text-emerald-400 mb-2" />
                        <span className="text-xs font-medium">
                          Oficina de Triagem &amp; Recondicionamento
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 text-xs text-slate-100">
                      <div className="font-semibold">Laboratório de Triagem Solidário Tech</div>
                      <div className="text-slate-300 mt-0.5">
                        Testes de hardware, higienização e emissão de termo de cessão
                      </div>
                    </div>
                  </div>
                </section>

                {/* Unified 4-Column Metric Strip with hairline dividers */}
                <section
                  aria-label="Indicadores principais"
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800"
                >
                  <div className="p-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Unidades Recebidas
                    </div>
                    <div className="mt-2 font-mono text-3xl font-semibold text-slate-900 dark:text-white tabular-nums">
                      {metrics.totalReceived}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {donations.length} entradas · média {metrics.avgPerDonation} un./doação
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Disponíveis em Estoque
                    </div>
                    <div className="mt-2 font-mono text-3xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {metrics.totalAvailable}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {metrics.readyCount} prontos · {metrics.repairCount} em reparo
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Unidades Distribuídas
                    </div>
                    <div className="mt-2 font-mono text-3xl font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                      {metrics.totalDistributed}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {distributions.length} entregas · {metrics.transferRate}% de repasse
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Beneficiários Atendidos
                    </div>
                    <div className="mt-2 font-mono text-3xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {metrics.uniqueRecipients}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Estudantes, escolas e ONGs
                    </div>
                  </div>
                </section>

                {/* Interactive Charts */}
                <ChartsSection
                  donations={donations}
                  distributions={distributions}
                  inventory={inventory}
                  onSelectCategory={(cat) => {
                    setDonationCatFilter(cat);
                    navigateTo('donations', true);
                  }}
                />

                {/* Recent Activity Split */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Últimas Doações Recebidas
                      </h2>
                      <button
                        type="button"
                        onClick={() => navigateTo('donations')}
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Ver histórico
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {recentDonations.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                          Sem registros recentes.
                        </div>
                      ) : (
                        recentDonations.map((d) => (
                          <div
                            key={d.id}
                            className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {d.itemName}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                <span className="font-mono">{formatProtocolCode('DOA', d.id)}</span>
                                <span aria-hidden="true" className="mx-1.5">
                                  ·
                                </span>
                                {d.donorName}
                                <span aria-hidden="true" className="mx-1.5">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">{d.receivedDate}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                +{d.quantity} un.
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveReceipt({ kind: 'donation', data: d })}
                                title="Ver comprovante"
                                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Últimas Distribuições
                      </h2>
                      <button
                        type="button"
                        onClick={() => navigateTo('distributions')}
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Ver histórico
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {recentDistributions.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                          Sem registros recentes.
                        </div>
                      ) : (
                        recentDistributions.map((dist) => (
                          <div
                            key={dist.id}
                            className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {dist.recipientName}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                <span className="font-mono">{formatProtocolCode('ENT', dist.id)}</span>
                                <span aria-hidden="true" className="mx-1.5">
                                  ·
                                </span>
                                {dist.itemName}
                                <span aria-hidden="true" className="mx-1.5">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">
                                  {dist.distributedDate}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                                -{dist.quantity} un.
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveReceipt({ kind: 'distribution', data: dist })
                                }
                                title="Ver termo de entrega"
                                className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeView === 'donations' && (
              <DonationsView
                donations={donations}
                inventory={inventory}
                initialCategoryFilter={donationCatFilter}
                onRegisterDonation={handleRegisterDonation}
                onDeleteDonation={handleDeleteDonation}
                onOpenReceipt={(don) => setActiveReceipt({ kind: 'donation', data: don })}
              />
            )}

            {activeView === 'inventory' && (
              <InventoryView
                inventory={inventory}
                onDistributeItem={(item) => {
                  setPreselectedDistItemId(item.id);
                  navigateTo('distributions');
                }}
                onUpdateDetails={handleUpdateInventoryDetails}
              />
            )}

            {activeView === 'distributions' && (
              <DistributionsView
                inventory={inventory}
                distributions={distributions}
                preselectedItemId={preselectedDistItemId}
                onRegisterDistribution={handleRegisterDistribution}
                onOpenReceipt={(dist) => setActiveReceipt({ kind: 'distribution', data: dist })}
              />
            )}
          </>
        )}
      </main>

      <ReceiptModal document={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </div>
  );
}
