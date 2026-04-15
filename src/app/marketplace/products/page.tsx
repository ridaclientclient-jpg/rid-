'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit3, Trash2, Package, Pill, UtensilsCrossed, ShoppingBag,
  X, Filter, Check, ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  sold: number;
  image?: string;
}

const initialProducts: Product[] = [
  { id: '1', name: 'Ibuprofeno 600mg', description: 'Antiinflamatorio, caja 20 tabletas', price: 3500, category: 'Farmacia', inStock: true, sold: 145 },
  { id: '2', name: 'Paracetamol 500mg', description: 'Analgésico, caja 30 tabletas', price: 2200, category: 'Farmacia', inStock: true, sold: 128 },
  { id: '3', name: 'Vitamina C 1000mg', description: 'Suplemento, frasco 60 cápsulas', price: 5100, category: 'Farmacia', inStock: true, sold: 76 },
  { id: '4', name: 'Omeprazol 20mg', description: 'Protector gástrico, caja 14 cápsulas', price: 4200, category: 'Farmacia', inStock: true, sold: 64 },
  { id: '5', name: 'Casado Tradicional', description: 'Arroz, frijoles, ensalada, plátano', price: 4500, category: 'Comida', inStock: true, sold: 98 },
  { id: '6', name: 'Sopa de Mariscos', description: 'Con camarones, pescado y calamar', price: 6500, category: 'Comida', inStock: true, sold: 52 },
  { id: '7', name: 'Ensalada César', description: 'Lechuga, pollo, crutones, parmesano', price: 3800, category: 'Comida', inStock: false, sold: 41 },
  { id: '8', name: 'Arroz Integral 1kg', description: 'Arroz integral de grano largo', price: 2800, category: 'Tiendas', inStock: true, sold: 87 },
  { id: '9', name: 'Aceite de Oliva 500ml', description: 'Extra virgen, first cold press', price: 7500, category: 'Tiendas', inStock: true, sold: 63 },
  { id: '10', name: 'Jabón de Avena', description: 'Natural, hipoalergénico, 150g', price: 1800, category: 'Tiendas', inStock: true, sold: 54 },
  { id: '11', name: 'Café Molido 250g', description: 'Café gourmet costarricense', price: 3200, category: 'Tiendas', inStock: false, sold: 92 },
  { id: '12', name: 'Crema Hidratante 200ml', description: 'Piel seca, con aloe vera', price: 4500, category: 'Tiendas', inStock: true, sold: 33 },
];

const categoryIcons: Record<string, React.ReactNode> = {
  Farmacia: <Pill className="w-5 h-5" />,
  Comida: <UtensilsCrossed className="w-5 h-5" />,
  Tiendas: <ShoppingBag className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  Farmacia: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
  Comida: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  Tiendas: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
};

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', category: 'Farmacia', inStock: true });

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, filterCategory]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', description: '', price: '', category: 'Farmacia', inStock: true });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category,
      inStock: product.inStock,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.price) {
      toast.error('Nombre y precio son obligatorios');
      return;
    }
    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? { ...p, name: formData.name, description: formData.description, price: Number(formData.price), category: formData.category, inStock: formData.inStock }
            : p
        )
      );
      toast.success('Producto actualizado correctamente');
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        category: formData.category,
        inStock: formData.inStock,
        sold: 0,
      };
      setProducts((prev) => [newProduct, ...prev]);
      toast.success('Producto creado correctamente');
    }
    setShowModal(false);
  };

  const handleDelete = (product: Product) => {
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    toast.success(`"${product.name}" eliminado`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Productos</h1>
          <p className="text-gray-400 text-sm mt-1">{products.length} productos en total</p>
        </div>
        <motion.button
          onClick={openAddModal}
          className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 self-start"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          Agregar Producto
        </motion.button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['Todos', 'Farmacia', 'Comida', 'Tiendas'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                filterCategory === cat
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-2xl overflow-hidden group hover:glow-cyan transition-all duration-300"
            >
              {/* Image placeholder */}
              <div className={`h-36 bg-gradient-to-br ${categoryColors[product.category]} flex items-center justify-center relative`}>
                {categoryIcons[product.category]}
                {/* Stock indicator */}
                <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${
                  product.inStock
                    ? 'bg-emerald-500/20 text-emerald-400 backdrop-blur-sm'
                    : 'bg-red-500/20 text-red-400 backdrop-blur-sm'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${product.inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {product.inStock ? 'En stock' : 'Agotado'}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{product.name}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{product.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryBadgeColors[product.category]}`}>
                      {product.category}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{product.sold} vendidos</p>
                  </div>
                  <p className="text-lg font-bold text-white">₡{product.price.toLocaleString()}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
                  <button
                    onClick={() => openEditModal(product)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      toast('¿Eliminar este producto?', {
                        action: {
                          label: 'Eliminar',
                          onClick: () => handleDelete(product),
                        },
                      });
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron productos</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div
              className="relative w-full max-w-md glass-strong rounded-2xl p-6 z-10"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">Nombre del producto</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Ibuprofeno 600mg"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción breve del producto"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-medium">Precio (₡)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="3500"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-medium">Categoría</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                    >
                      <option value="Farmacia" className="bg-gray-900">Farmacia</option>
                      <option value="Comida" className="bg-gray-900">Comida</option>
                      <option value="Tiendas" className="bg-gray-900">Tiendas</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-sm text-white font-medium">En stock</p>
                    <p className="text-xs text-gray-500">Producto disponible para venta</p>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, inStock: !formData.inStock })}
                    className={`w-12 h-6 rounded-full transition-colors duration-200 flex items-center ${
                      formData.inStock ? 'bg-cyan-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      formData.inStock ? 'translate-x-6.5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  onClick={handleSave}
                  className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Check className="w-4 h-4" />
                  {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
