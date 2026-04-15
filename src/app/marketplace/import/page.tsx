'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Download, FileText, CheckCircle, XCircle, Clock,
  AlertCircle, FileSpreadsheet, Trash2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface ImportRecord {
  id: string;
  fileName: string;
  date: string;
  productsImported: number;
  status: 'success' | 'partial' | 'error';
  errors: number;
}

const initialHistory: ImportRecord[] = [
  { id: '1', fileName: 'productos_farmacia_ene2024.csv', date: '2024-01-14', productsImported: 45, status: 'success', errors: 0 },
  { id: '2', fileName: 'comida_enero.csv', date: '2024-01-10', productsImported: 38, status: 'success', errors: 0 },
  { id: '3', fileName: 'tiendas_import.csv', date: '2024-01-08', productsImported: 22, status: 'partial', errors: 3 },
  { id: '4', fileName: 'nuevos_productos.csv', date: '2024-01-05', productsImported: 0, status: 'error', errors: 12 },
  { id: '5', fileName: 'stock_actualizado.csv', date: '2024-01-02', productsImported: 67, status: 'success', errors: 0 },
];

const statusConfig = {
  success: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Exitoso' },
  partial: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Parcial' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15', label: 'Error' },
};

export default function ImportPage() {
  const [history, setHistory] = useState<ImportRecord[]>(initialHistory);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importingFile, setImportingFile] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const simulateImport = (fileName: string) => {
    setImporting(true);
    setImportingFile(fileName);
    setImportProgress(0);

    const totalProducts = Math.floor(Math.random() * 50) + 10;
    let current = 0;

    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 5) + 1;
      if (current >= totalProducts) {
        current = totalProducts;
        clearInterval(interval);

        const newRecord: ImportRecord = {
          id: Date.now().toString(),
          fileName,
          date: new Date().toISOString().split('T')[0],
          productsImported: totalProducts,
          status: Math.random() > 0.2 ? 'success' : 'partial',
          errors: Math.random() > 0.2 ? 0 : Math.floor(Math.random() * 3) + 1,
        };

        setTimeout(() => {
          setImporting(false);
          setImportProgress(0);
          setImportingFile('');
          setHistory((prev) => [newRecord, ...prev]);
          toast.success(`Importación completada: ${totalProducts} productos`);
        }, 500);
      }
      setImportProgress(Math.round((current / totalProducts) * 100));
    }, 200);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Solo se aceptan archivos CSV');
      return;
    }
    simulateImport(file.name);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDownloadTemplate = () => {
    toast.success('Plantilla CSV descargada (simulada)');
  };

  const handleDeleteRecord = (id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
    toast.success('Registro eliminado');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">CSV Import</h1>
          <p className="text-gray-400 text-sm mt-1">Importa productos masivamente desde archivos CSV</p>
        </div>
        <motion.button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors self-start"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Download className="w-4 h-4" />
          Descargar Plantilla
        </motion.button>
      </div>

      {/* Upload Area */}
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !importing && fileInputRef.current?.click()}
        className={`glass rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragging ? 'glow-cyan border-cyan-500/50' : importing ? 'opacity-50 cursor-not-allowed' : 'hover:glow-cyan'
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = '';
          }}
        />

        <motion.div
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6"
          animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
        >
          {importing ? (
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-cyan-400" />
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {importing ? (
            <motion.div
              key="importing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto"
            >
              <p className="text-white font-semibold mb-2">Importando: {importingFile}</p>
              <Progress value={importProgress} className="h-2 mb-2" />
              <p className="text-sm text-cyan-400">Importando... {importProgress}%</p>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-white font-semibold mb-1">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-gray-400 text-sm mb-4">o haz clic para seleccionar</p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Formato: .CSV
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Máximo: 10MB
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  UTF-8
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* CSV Format Guide */}
      <motion.div
        className="glass rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          Formato del CSV
        </h3>
        <div className="bg-black/30 rounded-xl p-4 overflow-x-auto">
          <code className="text-xs text-gray-400 whitespace-nowrap block">
            nombre,descripcion,precio,categoria,en_stock,imagen_url
            <br />
            &quot;Ibuprofeno 600mg&quot;,&quot;Antiinflamatorio, caja 20 tabletas&quot;,3500,Farmacia,true,
            <br />
            &quot;Casado Tradicional&quot;,&quot;Arroz, frijoles, ensalada&quot;,4500,Comida,true,
          </code>
        </div>
        <p className="text-[11px] text-gray-600 mt-3">
          * Columnas obligatorias: nombre, precio, categoría. Las demás son opcionales.
        </p>
      </motion.div>

      {/* Import History */}
      <motion.div
        className="glass rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Historial de Importaciones</h2>
            <p className="text-xs text-gray-500 mt-0.5">{history.length} importaciones realizadas</p>
          </div>
        </div>

        <div className="space-y-3">
          {history.map((record, i) => {
            const config = statusConfig[record.status];
            const StatusIcon = config.icon;
            return (
              <motion.div
                key={record.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              >
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <StatusIcon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{record.fileName}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {record.date}
                    </span>
                    <span>{record.productsImported} productos</span>
                    {record.errors > 0 && (
                      <span className="text-red-400">{record.errors} errores</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                    record.status === 'success'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : record.status === 'partial'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>
                    {config.label}
                  </span>
                  <button
                    onClick={() => {
                      toast('¿Eliminar este registro?', {
                        action: {
                          label: 'Eliminar',
                          onClick: () => handleDeleteRecord(record.id),
                        },
                      });
                    }}
                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {history.length === 0 && (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-10 h-10 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No hay importaciones registradas</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
