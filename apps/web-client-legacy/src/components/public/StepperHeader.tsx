import React from 'react';

interface StepperHeaderProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export const StepperHeader: React.FC<StepperHeaderProps> = ({ currentStep, totalSteps, labels }) => {
  return (
    <div className="stepper">
      <div className="stepper__track">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          
          return (
            <React.Fragment key={idx}>
              <div className="stepper__step">
                <div
                  className={`stepper__circle ${isActive ? 'stepper__circle--active' : ''} ${isCompleted ? 'stepper__circle--completed' : ''}`}
                >
                  {isCompleted ? '✓' : stepNum}
                </div>
                <div className="stepper__label">{labels[idx]}</div>
              </div>
              {idx < totalSteps - 1 && (
                <div
                  className={`stepper__line ${isCompleted ? 'stepper__line--completed' : ''}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

