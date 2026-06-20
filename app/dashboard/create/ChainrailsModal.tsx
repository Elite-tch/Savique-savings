import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { chains, tokens, usePaymentModal, PaymentModal } from '@chainrails/react';
import { toast } from 'react-hot-toast';

interface ChainrailsModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
  amount: string; // fiat amount as string
  onSuccess: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

export const ChainrailsModal: React.FC<ChainrailsModalProps> = ({ open, onClose, address, amount, onSuccess, onLoadingChange }) => {
  const [mounted, setMounted] = useState(false);
  const cr = usePaymentModal({ sessionToken: null });

  useEffect(() => {
    setMounted(true);
  }, []);

  const createSession = async () => {
    try {
      if (onLoadingChange) onLoadingChange(true);
      const res = await fetch(`/api/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationChain: chains.ARBITRUM,
          token: tokens.USDC,
          recipient: address,
          amount,
        }),
      });
      const data = await res.json();
      cr.updateSession(data);
      cr.open();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create payment session');
    } finally {
      if (onLoadingChange) onLoadingChange(false);
    }
  };

  // Open the modal when component mounts and `open` is true
  useEffect(() => {
    if (open) {
      createSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Listen for success via the modal's onClose (Chainrails will call close after payment)
  const handleClose = () => {
    onClose();
    onSuccess();
  };

  return createPortal(
    <div className=" chainrails-modal-wrapper iframe fixed inset-0 md:left-64 z-[99999] flex items-center justify-center p-4 pointer-events-none">
      <div className="flex items-center justify-center pointer-events-auto">
        {/* We use scale(0.8) to forcefully shrink the entire Chainrails UI by 20% */}
        <PaymentModal
          {...cr}
          onClose={handleClose}
          style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}
        />
      </div>
    </div>,
    document.body
  );

};
