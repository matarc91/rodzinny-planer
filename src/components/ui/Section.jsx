import { COLORS } from '../../utils/constants.js';

export function Section({ title, children, action }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-lg font-bold flex items-center gap-2">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
