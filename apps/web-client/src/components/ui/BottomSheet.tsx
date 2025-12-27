import React, { useEffect } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="bottomSheet__backdrop" onClick={onClose} />
      <div className="bottomSheet">
        <div className="bottomSheet__handle" />
        {title && (
          <div className="bottomSheet__header">
            <h2 className="bottomSheet__title">{title}</h2>
            <button className="bottomSheet__close" onClick={onClose} aria-label="סגור">
              ×
            </button>
          </div>
        )}
        <div className="bottomSheet__content">{children}</div>
      </div>
    </>
  );
};

