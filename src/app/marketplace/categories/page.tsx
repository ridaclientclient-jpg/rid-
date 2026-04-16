'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill, UtensilsCrossed, ShoppingBag, Plus, Pencil, X, Check,
  ChevronRight, Package, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';

interface Subcategory {
  id: string;
  name: string;
  productCount: number;
}

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  productCount: number;
  subcategories: Subcategory[];
}

const initialCategories: Category[] = [
  {
    id: '1',
    name: 'Farmacia',
    icon: <Pill className="w-8 h-8" />,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500 to-green-500',
    productCount: 68,
    subcategories: [
      { id: 's1', name: 'Medicamentos', productCount: 35 },
      { id: 's2', name: 'Vitaminas', productCount: 18 },
      { id: 's3', name: 'Cuidado Personal', productCount: 15 },
    ],
  },
  {
    id: '2',
    name: 'Comida',
    icon: <UtensilsCrossed className="w-8 h-8" />,
    color: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-500',
    productCount: 52,
    subcategories: [
      { id: 's4', name: 'Almuerzos', productCount: 22 },
      { id: 's5', name: 'Cenas', productCount: 15 },
      { id: 's6', name: 'Postres', productCount: 10 },
      { id: 's7', name: 'Bebidas', productCount: 5 },
    ],
  },
  {
    id: '3',
    name: 'Tiendas',
    icon: <ShoppingBag className="w-8 h-8" />,
    color: 'text-blue-400',
    gradient: 'from-blue-500 to-cyan-500',
    productCount: 36,
    subcategories: [
      { id: 's8', name: 'Abarrotes', productCount: 20 },
      { id: 's9', name: 'Limpieza', productCount: 16 },
    ],
  },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [newSubcategory, setNewSubcategory] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  const handleEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const handleSaveCategory = (catId: string) => {
    if (!editingCatName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, name: editingCatName.trim() } : c))
    );
    setEditingCatId(null);
    toast.success('Categoría actualizada');
  };

  const handleAddSubcategory = (catId: string) => {
    if (!newSubcategory.trim()) {
      toast.error('Nombre de subcategoría requerido');
      return;
    }
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? {
              ...c,
              subcategories: [
                ...c.subcategories,
                { id: Date.now().toString(), name: newSubcategory.trim(), productCount: 0 },
              ],
            }
          : c
      )
    );
    setNewSubcategory('');
    setAddingSubFor(null);
    toast.success('Subcategoría agregada');
  };

  const handleDeleteSubcategory = (catId: string, subId: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) }
          : c
      )
    );
    toast.success('Subcategoría eliminada');
  };

  const totalProducts = categories.reduce((acc, c) => acc + c.productCount, 0);
  const totalSubcategories = categories.reduce((acc, c) => acc + c.subcategories.length, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
          <p className="text-gray-400 text-sm mt-1">
            {categories.length} categorías · {totalSubcategories} subcategorías · {totalProducts} productos
          </p>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            className="glass rounded-2xl overflow-hidden group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            {/* Card header with gradient */}
            <div className={`h-2 bg-gradient-to-r ${cat.gradient}`} />

            <div className="p-6">
              {/* Icon & name */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center text-white shadow-lg`}>
                    {cat.icon}
                  </div>
                  <div>
                    {editingCatId === cat.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500 w-32"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory(cat.id)}
                        />
                        <button
                          onClick={() => handleSaveCategory(cat.id)}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingCatId(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{cat.subcategories.length} subcategorías</p>
                  </div>
                </div>
                <button
                  onClick={() => handleEditCategory(cat)}
                  className="text-gray-500 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-white font-semibold">{cat.productCount}</span>
                  <span className="text-gray-500">productos</span>
                </div>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${cat.gradient}`}
                    style={{ width: `${(cat.productCount / totalProducts) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{Math.round((cat.productCount / totalProducts) * 100)}%</span>
              </div>

              {/* Subcategories toggle */}
              <button
                onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm text-gray-400"
              >
                <span>Subcategorías ({cat.subcategories.length})</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedCat === cat.id ? 'rotate-90' : ''}`} />
              </button>

              {/* Subcategories list */}
              <AnimatePresence>
                {expandedCat === cat.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {cat.subcategories.map((sub) => (
                        <motion.div
                          key={sub.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] group/sub"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <GripVertical className="w-3 h-3 text-gray-600" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-300">{sub.name}</p>
                            <p className="text-[10px] text-gray-600">{sub.productCount} productos</p>
                          </div>
                          <button
                            onClick={() => handleDeleteSubcategory(cat.id, sub.id)}
                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-all p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}

                      {/* Add subcategory input */}
                      {addingSubFor === cat.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={newSubcategory}
                            onChange={(e) => setNewSubcategory(e.target.value)}
                            placeholder="Nueva subcategoría"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(cat.id)}
                          />
                          <button
                            onClick={() => handleAddSubcategory(cat.id)}
                            className="text-emerald-400 hover:text-emerald-300 p-1.5"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setAddingSubFor(null); setNewSubcategory(''); }}
                            className="text-gray-400 hover:text-white p-1.5"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingSubFor(cat.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/10 text-xs text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors mt-2"
                        >
                          <Plus className="w-3 h-3" />
                          Agregar subcategoría
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}

        {/* Add new category card */}
        <motion.div
          className="glass rounded-2xl overflow-hidden flex items-center justify-center min-h-[300px] cursor-pointer hover:glow-cyan transition-all duration-300"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => toast.info('Creación de categorías próximamente')}
        >
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3 border border-dashed border-white/20">
              <Plus className="w-6 h-6 text-gray-500" />
            </div>
            <p className="text-sm text-gray-500">Agregar Categoría</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
