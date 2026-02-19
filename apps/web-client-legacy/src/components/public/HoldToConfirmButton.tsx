import React, { useState, useRef, useEffect } from 'react';

interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  disabled?: boolean;
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  onConfirm,
  disabled = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const HOLD_DURATION = 1800; // 1.8 seconds (between 1.5-2s)

  useEffect(() => {
    if (isHolding && !disabled) {
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Date.now() - startTimeRef.current;
          const newProgress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
          setProgress(newProgress);

          if (newProgress >= 100) {
            handleRelease();
            onConfirm();
          }
        }
      }, 16); // ~60fps
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!isHolding) {
        setProgress(0);
        startTimeRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isHolding, disabled, onConfirm]);

  const handlePress = () => {
    if (!disabled) {
      setIsHolding(true);
    }
  };

  const handleRelease = () => {
    setIsHolding(false);
    setProgress(0);
  };

  return (
    <button
      className={`holdBtn ${isHolding ? 'holdBtn--holding' : ''} ${disabled ? 'holdBtn--disabled' : ''}`}
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      onTouchStart={handlePress}
      onTouchEnd={handleRelease}
      disabled={disabled}
    >
      <div className="holdBtn__progress" style={{ width: `${progress}%` }} />
      <span className="holdBtn__text">
        {isHolding ? 'משחררת...' : 'החזיקי כדי לאשר'}
      </span>
    </button>
  );
};

