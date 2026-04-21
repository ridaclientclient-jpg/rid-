'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface RideRatingModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  driverName: string;
  driverId: string;
  userId: string;
}

export default function RideRatingModal({
  open,
  onClose,
  rideId,
  driverName,
  driverId,
  userId,
}: RideRatingModalProps) {
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      toast.error('Por favor selecciona una calificacion');
      return;
    }

    setIsSubmitting(true);
    try {
      // Insert review into reviews table
      const { error: reviewError } = await supabase.from('reviews').insert({
        ride_id: rideId,
        reviewer_id: userId,
        reviewee_id: driverId,
        rating: selectedRating,
        comment: comment.trim() || null,
      });

      if (reviewError) {
        console.error('Review insert error:', reviewError);
        // Don't block user — still update ride rating
      }

      // Update rides.rider_rating field
      const { error: rideError } = await supabase
        .from('rides')
        .update({ rider_rating: selectedRating })
        .eq('id', rideId);

      if (rideError) {
        console.error('Ride rating update error:', rideError);
      }

      toast.success('Gracias por tu calificacion!');
      onClose();
    } catch (err) {
      console.error('Submit rating error:', err);
      toast.error('Error al enviar calificacion. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const displayRating = hoverRating || selectedRating;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleSkip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-md mx-4 mb-4 rounded-2xl glass-strong p-6 overflow-hidden"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <Star className="w-8 h-8 text-yellow-400" />
              </motion.div>

              <h2 className="text-xl font-bold text-white mb-1">
                Como fue tu viaje?
              </h2>
              <p className="text-sm text-gray-400">
                Califica a {driverName}
              </p>
            </div>

            {/* Star Rating */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 focus:outline-none transition-transform"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Star
                    className={`w-10 h-10 transition-all duration-200 ${
                      star <= displayRating
                        ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                        : 'text-gray-600 hover:text-gray-400'
                    }`}
                  />
                </motion.button>
              ))}
            </div>

            {/* Rating label */}
            {displayRating > 0 && (
              <motion.p
                className="text-center text-sm text-yellow-400/80 mb-4"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                key={displayRating}
              >
                {displayRating === 1 && 'Malo'}
                {displayRating === 2 && 'Regular'}
                {displayRating === 3 && 'Bueno'}
                {displayRating === 4 && 'Muy bueno'}
                {displayRating === 5 && 'Excelente'}
              </motion.p>
            )}

            {/* Comment textarea */}
            <div className="mb-5">
              <textarea
                value={comment}
                onChange={(e) => {
                  if (e.target.value.length <= 300) {
                    setComment(e.target.value);
                  }
                }}
                placeholder="Deja un comentario (opcional)..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
              <p className="text-right text-xs text-gray-500 mt-1">
                {comment.length}/300
              </p>
            </div>

            {/* Submit Button */}
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedRating === 0}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm btn-neon disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
              whileHover={selectedRating > 0 ? { scale: 1.02 } : {}}
              whileTap={selectedRating > 0 ? { scale: 0.98 } : {}}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  />
                  Enviando...
                </span>
              ) : (
                'Enviar calificacion'
              )}
            </motion.button>

            {/* Skip link */}
            <button
              type="button"
              onClick={handleSkip}
              className="w-full mt-3 text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-1"
            >
              Omitir
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
